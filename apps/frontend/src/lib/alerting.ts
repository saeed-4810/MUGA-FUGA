/**
 * Browser-side alerting helpers.
 *
 * The frontend cannot page on-call directly. What it CAN do:
 *   - tag Sentry events with `alert.kind` and `alert.severity` so the
 *     Sentry alert rules in `docs/api/alerting-runbook.md` (A6, A7) work,
 *   - emit a "stuck-loading" alert when a fetch sits in flight too long
 *     (catches silent backend regressions before the user complains),
 *   - emit a console-grade event in dev so the developer sees parity with
 *     the production alert path.
 */
import * as Sentry from "@sentry/react";

export type FrontendAlertKind = "stuck_loading" | "render_error" | "auth_state_lost" | "synthetic";

export type FrontendAlertSeverity = "page" | "notify" | "info";

export interface FrontendAlertEvent {
  kind: FrontendAlertKind;
  severity: FrontendAlertSeverity;
  message: string;
  context?: Record<string, unknown>;
}

const LEVEL: Record<FrontendAlertSeverity, Sentry.SeverityLevel> = {
  page: "error",
  notify: "warning",
  info: "info",
};

export const emitFrontendAlert = (event: FrontendAlertEvent): void => {
  Sentry.withScope((scope) => {
    scope.setTag("alert_kind", event.kind);
    scope.setTag("alert_severity", event.severity);
    if (event.context) scope.setContext("alert_context", event.context);
    scope.setLevel(LEVEL[event.severity]);
    Sentry.captureMessage(`[ALERT ${event.severity}] ${event.kind}: ${event.message}`);
  });

  // Local breadcrumb for dev visibility (production console is silent
  // unless the user opens devtools).

  console.warn("[muga.alert]", event.severity, event.kind, event.message, event.context ?? {});
};

/**
 * Wrap a Promise-returning operation with a "stuck loading" watchdog.
 * If the operation hasn't settled within `budgetMs`, we emit a notify-level
 * alert and the operation continues. The alert fires AT MOST ONCE per call.
 */
export const withWatchdog = async <T>(
  label: string,
  op: () => Promise<T>,
  budgetMs = 8000
): Promise<T> => {
  let fired = false;
  const timer = setTimeout(() => {
    fired = true;
    emitFrontendAlert({
      kind: "stuck_loading",
      severity: "notify",
      message: `Operation '${label}' exceeded ${budgetMs}ms`,
      context: { label, budget_ms: budgetMs },
    });
  }, budgetMs);
  try {
    return await op();
  } finally {
    clearTimeout(timer);
    if (fired) {
      // record that it eventually completed
      Sentry.addBreadcrumb({
        type: "info",
        category: "alert",
        message: `stuck_loading.recovered: ${label}`,
        level: "info",
      });
    }
  }
};
