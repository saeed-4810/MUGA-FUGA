import type { RequestHandler } from "express";

import type { Env } from "../config/env.js";
import { Role, type AuthUser } from "../domain/auth.js";
import { Errors } from "../domain/errors.js";
import { emitAlert } from "../lib/alerting.js";
import { auth as adminAuth } from "../lib/firebase.js";

const BEARER_PREFIX = /^Bearer\s+/i;
const SESSION_COOKIE_NAME = "__session";
const SESSION_HEADER_NAME = "x-muga-session";

type DecodedAuthClaims = {
  uid: string;
  email?: string;
  email_verified?: boolean;
  role?: string;
};

const parseCookieHeader = (header: string): Record<string, string> =>
  Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...valueParts] = part.split("=");
        return [name, decodeURIComponent(valueParts.join("="))];
      })
      .filter(([name]) => Boolean(name))
  );

const getSessionCookie = (
  cookieHeader: string,
  sessionHeader: string | undefined
): string | undefined => parseCookieHeader(cookieHeader)[SESSION_COOKIE_NAME] ?? sessionHeader;

const toAuthUser = (decoded: DecodedAuthClaims): AuthUser => {
  const email = decoded.email;
  if (!email) throw Errors.unauthenticated("Token missing email");

  const parsedRole = Role.safeParse(decoded.role ?? "customer");
  return {
    uid: decoded.uid,
    email,
    role: parsedRole.success ? parsedRole.data : "customer",
    emailVerified: decoded.email_verified ?? false,
  };
};

const isExpiredAuthError = (err: unknown): boolean =>
  err instanceof Error && err.message.toLowerCase().includes("expired");

export const requireAuth = (env: Env): RequestHandler => {
  return async (req, _res, next) => {
    try {
      const header = req.header("authorization") ?? "";
      const hasBearerPrefix = BEARER_PREFIX.test(header);
      const authClient = adminAuth(env);
      const decoded = hasBearerPrefix
        ? await (async () => {
            const token = header.replace(BEARER_PREFIX, "");
            if (!token) throw Errors.unauthenticated("Empty bearer token");
            return authClient.verifyIdToken(token, true);
          })()
        : await (async () => {
            const sessionCookie = getSessionCookie(
              req.header("cookie") ?? "",
              req.header(SESSION_HEADER_NAME)
            );
            if (!sessionCookie) throw Errors.unauthenticated("Missing bearer token");
            return authClient.verifySessionCookie(sessionCookie, true);
          })();

      req.user = toAuthUser(decoded);
      next();
    } catch (err) {
      void emitAlert(env, {
        kind: "auth_failure",
        severity: "info",
        message: (err as Error).message ?? "auth verification failed",
        context: {
          requestId: req.requestId ?? "unknown",
          route: `${req.method} ${req.path}`,
        },
      });
      if (isExpiredAuthError(err)) {
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
