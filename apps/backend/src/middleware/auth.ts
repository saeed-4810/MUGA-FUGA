import type { RequestHandler } from "express";

import type { Env } from "../config/env.js";
import { Role, type AuthUser } from "../domain/auth.js";
import { Errors } from "../domain/errors.js";
import { emitAlert } from "../lib/alerting.js";
import { auth as adminAuth } from "../lib/firebase.js";

const BEARER = /^Bearer\s+(.+)$/i;

export const requireAuth = (env: Env): RequestHandler => {
  return async (req, _res, next) => {
    try {
      const header = req.header("authorization") ?? "";
      const match = header.match(BEARER);
      if (!match) throw Errors.unauthenticated("Missing bearer token");
      const token = match[1];
      if (!token) throw Errors.unauthenticated("Empty bearer token");

      const decoded = await adminAuth(env).verifyIdToken(token, true);
      const email = decoded.email;
      if (!email) throw Errors.unauthenticated("Token missing email");

      const claimRole = (decoded["role"] as string | undefined) ?? "customer";
      const parsedRole = Role.safeParse(claimRole);
      const role = parsedRole.success ? parsedRole.data : "customer";

      const user: AuthUser = {
        uid: decoded.uid,
        email,
        role,
        emailVerified: decoded.email_verified ?? false,
      };
      req.user = user;
      next();
    } catch (err) {
      // Emit per-event auth-failure log (drives the auth-spike alert via
      // log-based metric `muga_unauth_count`).
      void emitAlert(env, {
        kind: "auth_failure",
        severity: "info",
        message: (err as Error).message ?? "auth verification failed",
        context: {
          requestId: req.requestId ?? "unknown",
          route: `${req.method} ${req.path}`,
        },
      });
      if (err instanceof Error && err.message.toLowerCase().includes("expired")) {
        next(Errors.unauthenticated("Token expired"));
        return;
      }
      next(err);
    }
  };
};

export const requireRole =
  (...allowed: Array<AuthUser["role"]>): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      next(Errors.unauthenticated());
      return;
    }
    if (!allowed.includes(req.user.role)) {
      next(Errors.forbidden(`Role ${req.user.role} not allowed`));
      return;
    }
    next();
  };
