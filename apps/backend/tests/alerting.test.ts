import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type { Env } from "../src/config/env.js";
import { emitAlert } from "../src/lib/alerting.js";

const baseEnv: Env = {
  NODE_ENV: "test",
  PORT: 3001,
  LOG_LEVEL: "info",
  CORS_ALLOWED_ORIGINS: ["http://localhost:5173"],
  FIREBASE_PROJECT_ID: "muga-test",
  FIREBASE_STORAGE_BUCKET: "muga-test.appspot.com",
  FIREBASE_SERVICE_ACCOUNT_JSON: "",
  INITIAL_ADMIN_EMAILS: [],
  SENTRY_DSN: "",
  SENTRY_ENVIRONMENT: "test",
  SENTRY_TRACES_SAMPLE_RATE: 0,
  SENTRY_PROFILES_SAMPLE_RATE: 0,
  FIRESTORE_EMULATOR_HOST: "",
  FIREBASE_AUTH_EMULATOR_HOST: "",
  FIREBASE_STORAGE_EMULATOR_HOST: "",
  SLACK_WEBHOOK_URL: "",
  PAGERDUTY_INTEGRATION_KEY: "",
  ALERT_EMAIL_RECIPIENTS: [],
  ALERT_READY_LATENCY_BUDGET_MS: 2000,
};

describe("emitAlert — structured alert pipeline", () => {
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("T-ALERT-001 — info-level alerts go to logger.info and don't ping Slack at all", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    await emitAlert(
      { ...baseEnv, SLACK_WEBHOOK_URL: "https://hooks.slack.test/abc" },
      { kind: "auth_failure", severity: "info", message: "single auth failure event" },
      logger
    );
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    const payload = logger.info.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      alert: { kind: "auth_failure", severity: "info" },
      message: "single auth failure event",
    });
  });

  it("T-ALERT-002 — notify-level alerts log as warn (so log-based metrics catch them)", async () => {
    await emitAlert(
      baseEnv,
      {
        kind: "ready_check_slow",
        severity: "notify",
        message: "readiness probe slow",
        context: { latency_ms: 3000 },
      },
      logger
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const payload = logger.warn.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      alert: { kind: "ready_check_slow", severity: "notify" },
      latency_ms: 3000,
    });
  });

  it("T-ALERT-003 — page-level alerts also use warn (the SEV is the differentiator, not the log level)", async () => {
    await emitAlert(
      baseEnv,
      { kind: "ready_check_failed", severity: "page", message: "service is down" },
      logger
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("T-ALERT-004 — when SLACK_WEBHOOK_URL is set, page/notify alerts also POST to Slack with an attachment", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await emitAlert(
      { ...baseEnv, SLACK_WEBHOOK_URL: "https://hooks.slack.test/abc" },
      {
        kind: "unhandled_error",
        severity: "page",
        message: "boom",
        context: { route: "POST /products", requestId: "rid_inv_001" },
      },
      logger
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://hooks.slack.test/abc");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.attachments[0].title).toContain("PAGE");
    expect(body.attachments[0].title).toContain("unhandled_error");
    expect(body.attachments[0].fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "route", value: "POST /products" }),
        expect.objectContaining({ title: "requestId", value: "rid_inv_001" }),
      ])
    );
  });

  it("T-ALERT-005 — Slack webhook failing is non-fatal — emitAlert never throws", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("network down"));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    await expect(
      emitAlert(
        { ...baseEnv, SLACK_WEBHOOK_URL: "https://hooks.slack.test/x" },
        { kind: "unhandled_error", severity: "page", message: "x" },
        logger
      )
    ).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("T-ALERT-005b — non-string context values get JSON-stringified into Slack fields", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    await emitAlert(
      { ...baseEnv, SLACK_WEBHOOK_URL: "https://hooks.slack.test/abc" },
      {
        kind: "synthetic",
        severity: "notify",
        message: "complex context",
        context: { count: 7, nested: { foo: "bar" } },
      },
      logger
    );
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string);
    const fields: Array<{ title: string; value: string }> = body.attachments[0].fields;
    expect(fields.find((f) => f.title === "count")!.value).toBe("7");
    expect(fields.find((f) => f.title === "nested")!.value).toBe('{"foo":"bar"}');
  });

  it("T-ALERT-006 — when SLACK_WEBHOOK_URL is blank we skip Slack entirely (no fetch call)", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    await emitAlert(baseEnv, { kind: "synthetic", severity: "notify", message: "drill" }, logger);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
