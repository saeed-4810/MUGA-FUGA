/* eslint-disable import/order -- known false positive in mixed type+value
   internal-group imports. Hand-sorted alphabetically. */
import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Env } from "../src/config/env.js";
/* eslint-enable import/order */

const dbBehaviour: { mode: "fast-ok" | "slow-ok" | "fail" } = { mode: "fast-ok" };

vi.mock("../src/lib/firebase.js", () => {
  return {
    db: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => {
            if (dbBehaviour.mode === "fail") throw new Error("firestore unavailable");
            if (dbBehaviour.mode === "slow-ok") {
              await new Promise((r) => setTimeout(r, 30));
            }
            return { exists: false };
          },
        }),
      }),
    }),
    bucket: () => ({}),
    auth: () => ({}),
    initFirebase: () => ({}),
  };
});

import { healthRouter } from "../src/routes/health.js";

const stubEnv: Env = {
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

describe("health + readiness routes", () => {
  beforeEach(() => {
    dbBehaviour.mode = "fast-ok";
  });

  it("T-HEALTH-001 — GET /health is the cheap liveness probe — 200 with our service identity + a timestamp", async () => {
    const app = express().use(healthRouter());
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", service: "muga-backend" });
    expect(typeof res.body.timestamp).toBe("string");
    expect(() => new Date(res.body.timestamp).toISOString()).not.toThrow();
  });

  it("T-HEALTH-002 — without an env, the readiness probe simply isn't mounted (used in unit tests + local boot)", async () => {
    const app = express().use(healthRouter());
    const res = await request(app).get("/healthz/ready");
    expect(res.status).toBe(404);
  });

  it("T-HEALTH-003 — /healthz/ready pings Firestore; on a fast ping → ready + firestore:ok with a latency number", async () => {
    const app = express().use(healthRouter(stubEnv));
    const res = await request(app).get("/healthz/ready");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ready", firestore: "ok" });
    expect(typeof res.body.latency_ms).toBe("number");
  });

  it("T-HEALTH-004 — slow Firestore ping → still 200 (we're up) but a notify-level ready_check_slow alert fires", async () => {
    dbBehaviour.mode = "slow-ok";
    const tightEnv: Env = { ...stubEnv, ALERT_READY_LATENCY_BUDGET_MS: 5 };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const app = express().use(healthRouter(tightEnv));
    const res = await request(app).get("/healthz/ready");
    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalled();
    const payload = warn.mock.calls.find((c) => {
      const obj = c[0] as Record<string, unknown> | undefined;
      return obj && (obj as { alert?: { kind?: string } }).alert?.kind === "ready_check_slow";
    });
    expect(payload).toBeTruthy();
    warn.mockRestore();
  });

  it("T-HEALTH-005 — Firestore down → /healthz/ready returns 500 and a page-level ready_check_failed alert fires (this is what wakes the on-call)", async () => {
    dbBehaviour.mode = "fail";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const app = express()
      .use(healthRouter(stubEnv))
      .use(
        (
          err: unknown,
          _req: express.Request,
          res: express.Response,
          _next: express.NextFunction
        ) => {
          res.status(500).json({ error: (err as Error).message });
        }
      );
    const res = await request(app).get("/healthz/ready");
    expect(res.status).toBe(500);
    const fired = warn.mock.calls.find((c) => {
      const obj = c[0] as Record<string, unknown> | undefined;
      return obj && (obj as { alert?: { kind?: string } }).alert?.kind === "ready_check_failed";
    });
    expect(fired).toBeTruthy();
    warn.mockRestore();
  });
});
