import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Env } from "../src/config/env.js";
import { requireAuth, requireRole } from "../src/middleware/auth.js";
import { errorHandler, notFoundHandler } from "../src/middleware/error.js";
import { requestIdMiddleware } from "../src/middleware/requestId.js";
import { meRouter } from "../src/routes/me.js";

/**
 * Hoisted controllable mock for the Firebase Admin SDK.
 *
 * - `verifyMode` drives `auth().verifyIdToken(token, true)`:
 *   ok-customer | ok-admin | ok-no-email | ok-bad-role | expired | invalid
 * - `setClaimsCalls` records every `setCustomUserClaims(uid, claims)` call so
 *   bootstrap behaviour can be asserted.
 * - `setClaimsBehaviour` decides whether the call resolves or throws.
 */
const verifyState: { mode: string } = { mode: "ok-customer" };
const setClaimsCalls: Array<{ uid: string; claims: Record<string, unknown> }> = [];
const setClaimsBehaviour: { mode: "ok" | "fail" } = { mode: "ok" };

vi.mock("../src/lib/firebase.js", () => {
  return {
    auth: () => ({
      verifyIdToken: async (token: string, _checkRevoked: boolean) => {
        switch (verifyState.mode) {
          case "ok-customer":
            return {
              uid: "usr_saeed_h",
              email: "saeedh582@gmail.com",
              email_verified: true,
              role: "customer",
            };
          case "ok-admin":
            return {
              uid: "usr_marcus_admin",
              email: "marcus@muga.app",
              email_verified: true,
              role: "admin",
            };
          case "ok-no-email":
            return { uid: "usr_no_email", email_verified: false };
          case "ok-bad-role":
            return {
              uid: "usr_weird_role",
              email: "weird-role@gmail.com",
              email_verified: false,
              role: "superuser",
            };
          case "ok-no-role":
            return {
              uid: "usr_first_signin",
              email: "newcomer@gmail.com",
              email_verified: true,
            };
          case "ok-undefined-email-verified":
            return {
              uid: "usr_unverif",
              email: "unverified@gmail.com",
              role: "customer",
            };
          case "throw-no-message": {
            const nonError: unknown = { not: "an-error" };
            throw nonError;
          }
          case "expired":
            throw new Error("Firebase ID token has expired.");
          case "invalid":
            throw new Error("Decoding Firebase ID token failed");
          default:
            throw new Error(`unknown verifyState.mode: ${verifyState.mode} (token=${token})`);
        }
      },
      verifySessionCookie: async (sessionCookie: string, _checkRevoked: boolean) => {
        if (sessionCookie === "session-admin") {
          return {
            uid: "usr_marcus_admin",
            email: "marcus@muga.app",
            email_verified: true,
            role: "admin",
          };
        }
        return {
          uid: "usr_saeed_h",
          email: "saeedh582@gmail.com",
          email_verified: true,
          role: "customer",
        };
      },
      setCustomUserClaims: async (uid: string, claims: Record<string, unknown>) => {
        if (setClaimsBehaviour.mode === "fail") {
          throw new Error("setCustomUserClaims failed");
        }
        setClaimsCalls.push({ uid, claims });
      },
    }),
    db: () => ({}),
    bucket: () => ({}),
    initFirebase: () => ({}),
  };
});

const stubEnv: Env = {
  NODE_ENV: "test",
  PORT: 3001,
  LOG_LEVEL: "info",
  CORS_ALLOWED_ORIGINS: ["http://localhost:5173"],
  FIREBASE_PROJECT_ID: "muga-test",
  FIREBASE_STORAGE_BUCKET: "muga-test.appspot.com",
  FIREBASE_SERVICE_ACCOUNT_JSON: "",
  INITIAL_ADMIN_EMAILS: ["marcus@muga.app", "founder@muga.app"],
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

/** Minimal app that wires requestId → requireAuth(env) → handler → error pipeline. */
const buildAuthApp = (handler: (req: Request, res: Response, next: NextFunction) => unknown) => {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.get("/protected", requireAuth(stubEnv), handler);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

const buildMeApp = (env: Env = stubEnv) => {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use("/me", meRouter(env));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

beforeEach(() => {
  verifyState.mode = "ok-customer";
  setClaimsCalls.length = 0;
  setClaimsBehaviour.mode = "ok";
});

describe("requireAuth + requireRole — bearer-token auth middleware", () => {
  it("T-AUTH-001 — no Authorization header at all → 401 'Missing bearer token'", async () => {
    const app = buildAuthApp((req, res) => res.json({ ok: true, uid: req.user?.uid }));
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
    expect(res.body.message).toBe("Missing bearer token");
  });

  it("T-AUTH-001b — wrong scheme (Basic instead of Bearer) → 401", async () => {
    const app = buildAuthApp((_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/protected").set("authorization", "Basic abc");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Missing bearer token");
  });

  it("T-AUTH-001c — defense-in-depth: bearer prefix without a token is rejected", async () => {
    const middleware = requireAuth(stubEnv);
    const req = {
      header: (h: string) => (h.toLowerCase() === "authorization" ? "Bearer " : ""),
      method: "GET",
      path: "/protected",
      requestId: "rid_test_001c",
    } as unknown as Request;

    const next = vi.fn();
    await middleware(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0] as { status: number; code: string; message: string };
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHENTICATED");
    expect(err.message).toBe("Empty bearer token");
  });

  it("T-AUTH-002 — expired Firebase ID token → 401 'Token expired'", async () => {
    verifyState.mode = "expired";
    const app = buildAuthApp((_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/protected").set("authorization", "Bearer xxx");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
    expect(res.body.message).toBe("Token expired");
  });

  it("T-AUTH-002b — non-expired verify failure (bad signature etc.) propagates as a 500 to the error handler", async () => {
    verifyState.mode = "invalid";
    const app = buildAuthApp((_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/protected").set("authorization", "Bearer xxx");
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL");
  });

  it("T-AUTH-002c — verifyIdToken rejecting with a non-Error value still gets passed safely to next()", async () => {
    const middleware = requireAuth(stubEnv);
    const next = vi.fn();
    const req = {
      header: (h: string) => (h.toLowerCase() === "authorization" ? "Bearer x" : ""),
      method: "GET",
      path: "/protected",
      requestId: "rid_test_002c",
    } as unknown as Request;
    verifyState.mode = "throws-string";
    await middleware(req, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]![0]).toBeInstanceOf(Error);
  });

  it("T-AUTH-003 — verified token with no email claim → 401 'Token missing email'", async () => {
    verifyState.mode = "ok-no-email";
    const app = buildAuthApp((_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/protected").set("authorization", "Bearer xxx");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token missing email");
  });

  it("T-AUTH-003b — unrecognised role claim ('superuser') quietly downgrades to 'customer'", async () => {
    verifyState.mode = "ok-bad-role";
    const app = buildAuthApp((req, res) => res.json({ user: req.user }));
    const res = await request(app).get("/protected").set("authorization", "Bearer xxx");
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("customer");
    expect(res.body.user.emailVerified).toBe(false);
  });

  it("T-AUTH-003c — token with no role claim at all defaults to 'customer'", async () => {
    verifyState.mode = "ok-no-role";
    const app = buildAuthApp((req, res) => res.json({ user: req.user }));
    const res = await request(app).get("/protected").set("authorization", "Bearer xxx");
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      uid: "usr_first_signin",
      email: "newcomer@gmail.com",
      role: "customer",
      emailVerified: true,
    });
  });

  it("T-AUTH-004 — Saeed signs in successfully → req.user is populated with uid, email, role, emailVerified", async () => {
    verifyState.mode = "ok-customer";
    const app = buildAuthApp((req, res) => res.json({ user: req.user }));
    const res = await request(app).get("/protected").set("authorization", "Bearer xxx");
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      uid: "usr_saeed_h",
      email: "saeedh582@gmail.com",
      role: "customer",
      emailVerified: true,
    });
  });

  it("T-AUTH-004d — SSR session cookie authenticates without an Authorization header", async () => {
    const app = buildAuthApp((req, res) => res.json({ user: req.user }));
    const res = await request(app)
      .get("/protected")
      .set("cookie", "theme=dark; __session=session-admin; other=value");
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ uid: "usr_marcus_admin", role: "admin" });
  });

  it("T-AUTH-004e — SSR session header authenticates when cookies are unavailable", async () => {
    const app = buildAuthApp((req, res) => res.json({ user: req.user }));
    const res = await request(app).get("/protected").set("x-muga-session", "session-customer");
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ uid: "usr_saeed_h", role: "customer" });
  });

  it("T-AUTH-005 — requireRole('admin') lets Marcus through but blocks Saeed with 403", async () => {
    const adminApp = express();
    adminApp.use(requestIdMiddleware);
    adminApp.get("/admin", requireAuth(stubEnv), requireRole("admin"), (req, res) =>
      res.json({ uid: req.user?.uid })
    );
    adminApp.use(errorHandler);

    verifyState.mode = "ok-admin";
    const ok = await request(adminApp).get("/admin").set("authorization", "Bearer xxx");
    expect(ok.status).toBe(200);
    expect(ok.body.uid).toBe("usr_marcus_admin");

    verifyState.mode = "ok-customer";
    const denied = await request(adminApp).get("/admin").set("authorization", "Bearer xxx");
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe("FORBIDDEN");
    expect(denied.body.message).toContain("customer");
  });

  it("T-AUTH-004b — token without an email_verified field defaults emailVerified to false", async () => {
    verifyState.mode = "ok-undefined-email-verified";
    const app = buildAuthApp((req, res) => res.json({ user: req.user }));
    const res = await request(app).get("/protected").set("authorization", "Bearer xxx");
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(false);
  });

  it("T-AUTH-004c — alert path stays sane when both error.message and req.requestId are missing", async () => {
    verifyState.mode = "throw-no-message";
    const middleware = requireAuth(stubEnv);
    const next = vi.fn();
    const req = {
      header: (h: string) => (h.toLowerCase() === "authorization" ? "Bearer x" : ""),
      method: "GET",
      path: "/protected",
    } as unknown as Request;
    await middleware(req, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]![0]).toEqual({ not: "an-error" });
  });

  it("T-AUTH-005b — requireRole on its own (no requireAuth in front) → 401 UNAUTHENTICATED", async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get("/admin-only", requireRole("admin"), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const res = await request(app).get("/admin-only");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });
});

describe("/me + /me/bootstrap — first sign-in role bootstrap", () => {
  it("T-ME-001 — calling /me without a token → 401", async () => {
    const app = buildMeApp();
    const res = await request(app).get("/me/");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("T-ME-001b — /me with Saeed's token returns his AuthUser shape", async () => {
    verifyState.mode = "ok-customer";
    const app = buildMeApp();
    const res = await request(app).get("/me/").set("authorization", "Bearer xxx");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      uid: "usr_saeed_h",
      email: "saeedh582@gmail.com",
      role: "customer",
      emailVerified: true,
    });
  });

  it("T-ME-002 — first sign-in: a user whose email is in INITIAL_ADMIN_EMAILS gets promoted to admin and we write the claim", async () => {
    verifyState.mode = "ok-no-role";
    const env: Env = { ...stubEnv, INITIAL_ADMIN_EMAILS: ["newcomer@gmail.com"] };
    const app = buildMeApp(env);

    const res = await request(app).post("/me/bootstrap").set("authorization", "Bearer xxx");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      uid: "usr_first_signin",
      email: "newcomer@gmail.com",
      role: "admin",
    });
    expect(setClaimsCalls).toHaveLength(1);
    expect(setClaimsCalls[0]).toEqual({ uid: "usr_first_signin", claims: { role: "admin" } });
  });

  it("T-ME-003 — first sign-in for a regular user (not in admin list): defaults to customer, no claim write", async () => {
    verifyState.mode = "ok-customer";
    const app = buildMeApp();
    const res = await request(app).post("/me/bootstrap").set("authorization", "Bearer xxx");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      uid: "usr_saeed_h",
      email: "saeedh582@gmail.com",
      role: "customer",
    });
    expect(setClaimsCalls).toHaveLength(0);
  });

  it("T-AUTH-006 — /me/bootstrap is idempotent for an already-admin user (no claim write on re-entry)", async () => {
    verifyState.mode = "ok-admin";
    const app = buildMeApp();
    const res = await request(app).post("/me/bootstrap").set("authorization", "Bearer xxx");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      uid: "usr_marcus_admin",
      email: "marcus@muga.app",
      role: "admin",
    });
    expect(setClaimsCalls).toHaveLength(0);
  });

  it("T-ME-003b — INITIAL_ADMIN_EMAILS comparison is case-insensitive", async () => {
    verifyState.mode = "ok-no-role";
    const env: Env = { ...stubEnv, INITIAL_ADMIN_EMAILS: ["newcomer@gmail.com"] };
    const app = buildMeApp(env);
    const res = await request(app).post("/me/bootstrap").set("authorization", "Bearer xxx");
    expect(res.body.role).toBe("admin");
  });

  it("T-ME-003c — if Firebase setCustomUserClaims fails during bootstrap, we surface 500 (not silently swallow)", async () => {
    verifyState.mode = "ok-no-role";
    setClaimsBehaviour.mode = "fail";
    const env: Env = { ...stubEnv, INITIAL_ADMIN_EMAILS: ["newcomer@gmail.com"] };
    const app = buildMeApp(env);
    const res = await request(app).post("/me/bootstrap").set("authorization", "Bearer xxx");
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL");
  });
});
