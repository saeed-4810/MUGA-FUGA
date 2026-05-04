/**
 * Structured alerting helpers.
 *
 * The single source of truth for "this should page someone" is a Pino log
 * line that includes an `alert.kind` JSON field. Cloud Monitoring picks
 * these up via log-based metrics defined in
 * `code/.github/monitoring/log-based-metrics.yaml`.
 *
 * For severe alerts we ALSO push to Slack synchronously (best-effort) and
 * tag Sentry. Everything is no-op safe when env vars are blank.
 */
import * as Sentry from "@sentry/node";

import type { Env } from "../config/env.js";

export type AlertKind =
  | "auth_failure" // single auth failure event (counted via log-based metric)
  | "upload_validation_fail" // single upload validation failure
  | "admin_action" // admin approve/reject (informational)
  | "ready_check_failed" // /healthz/ready degraded
  | "ready_check_slow" // /healthz/ready exceeded latency budget
  | "synthetic" // drill / smoke event
  | "unhandled_error"; // anything reaching the error handler

export type AlertSeverity = "page" | "notify" | "info";

export interface AlertEvent {
  kind: AlertKind;
  severity: AlertSeverity;
  message: string;
  /**
   * Free-form context. Keep keys snake_case and serialisable.
   * Common fields: requestId, userUid, userRole, route, statusCode.
   */
  context?: Record<string, unknown>;
}

type Logger = Pick<Console, "info" | "warn" | "error"> & {
  warn: (...args: unknown[]) => void;
};

const SLACK_COLOR: Record<AlertSeverity, string> = {
  page: "#cc2030",
  notify: "#f5a623",
  info: "#2563eb",
};

/**
 * Emit an alert. Returns a promise that resolves once external sinks
 * (Slack/Sentry) have been notified. Safe to `void` if you don't need to
 * wait — the Pino log line is always synchronous.
 */
export const emitAlert = async (
  env: Env,
  event: AlertEvent,
  logger: Logger = console
): Promise<void> => {
  // 1. Always emit a structured log line so log-based metrics + Cloud
  //    Monitoring see it. The `alert.*` namespace is what
  //    `log-based-metrics.yaml` filters on.
  const logPayload = {
    alert: {
      kind: event.kind,
      severity: event.severity,
    },
    message: event.message,
    ...event.context,
  };
  if (event.severity === "page" || event.severity === "notify") {
    logger.warn(logPayload);
  } else {
    logger.info(logPayload);
  }

  // 2. Sentry tag (no-op if Sentry not initialised)
  Sentry.withScope((scope) => {
    scope.setTag("alert_kind", event.kind);
    scope.setTag("alert_severity", event.severity);
    if (event.context) {
      scope.setContext("alert_context", event.context);
    }
    if (event.severity === "page") {
      scope.setLevel("error");
      Sentry.captureMessage(`[ALERT page] ${event.kind}: ${event.message}`);
    } else if (event.severity === "notify") {
      scope.setLevel("warning");
      Sentry.captureMessage(`[ALERT notify] ${event.kind}: ${event.message}`);
    }
  });

  // 3. Slack webhook (best-effort; never throws)
  if (env.SLACK_WEBHOOK_URL && event.severity !== "info") {
    try {
      await fetch(env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attachments: [
            {
              color: SLACK_COLOR[event.severity],
              title: `[${event.severity.toUpperCase()}] ${event.kind}`,
              text: event.message,
              fields: Object.entries(event.context ?? {}).map(([k, v]) => ({
                title: k,
                value: typeof v === "string" ? v : JSON.stringify(v),
                short: true,
              })),
              footer: `MUGA · ${env.SENTRY_ENVIRONMENT}`,
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        }),
      });
    } catch {
      // Swallow — alerting must never crash the request path.
    }
  }
};
