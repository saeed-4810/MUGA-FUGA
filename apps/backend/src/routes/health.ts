import { Router, type Router as ExpressRouter } from "express";

import type { Env } from "../config/env.js";
import { emitAlert } from "../lib/alerting.js";
import { db } from "../lib/firebase.js";

/**
 * GET /health        — shallow liveness (no external dependencies)
 * GET /healthz/ready — deep readiness (pings Firestore; respects latency budget)
 *
 * Both are unauthenticated by design; uptime checks call them.
 */
export const healthRouter = (env?: Env): ExpressRouter => {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "muga-backend",
      timestamp: new Date().toISOString(),
    });
  });

  // Deep readiness — only mounted when `env` is provided (i.e. in a real
  // app build). The shallow `/health` is also exported so unit tests can
  // mount the router with no env.
  if (env) {
    router.get("/healthz/ready", async (_req, res, next) => {
      const started = Date.now();
      try {
        // Cheap Firestore ping: one document read on a metadata doc that
        // does not need to exist (a missing doc is still a successful round-trip).
        await db(env).collection("_meta").doc("ping").get();
        const ms = Date.now() - started;

        if (ms > env.ALERT_READY_LATENCY_BUDGET_MS) {
          await emitAlert(env, {
            kind: "ready_check_slow",
            severity: "notify",
            message: `Ready check exceeded latency budget (${ms}ms > ${env.ALERT_READY_LATENCY_BUDGET_MS}ms)`,
            context: { latency_ms: ms, budget_ms: env.ALERT_READY_LATENCY_BUDGET_MS },
          });
        }

        res.json({
          status: "ready",
          firestore: "ok",
          latency_ms: ms,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        const ms = Date.now() - started;
        await emitAlert(env, {
          kind: "ready_check_failed",
          severity: "page",
          message: `Ready check failed (${(err as Error).message})`,
          context: { latency_ms: ms },
        });
        next(err);
      }
    });
  }

  return router;
};
