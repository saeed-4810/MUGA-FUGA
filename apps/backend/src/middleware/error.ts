import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

import { AppError, type ErrorEnvelope } from "../domain/errors.js";

const buildEnvelope = (
  code: string,
  message: string,
  requestId: string,
  details?: Record<string, unknown>
): ErrorEnvelope => {
  const env: ErrorEnvelope = { code, message, requestId };
  if (details !== undefined) env.details = details;
  return env;
};

/**
 * onUnhandledError is invoked once per unknown error reaching the handler.
 * Wired in `app.ts` to `emitAlert(env, ...)` so the production app pages
 * the on-call. Defaults to a no-op so unit tests don't need env loading.
 */
export type UnhandledErrorHook = (info: {
  error: unknown;
  requestId: string;
  method: string;
  path: string;
}) => void;

export const buildErrorHandler =
  (onUnhandled: UnhandledErrorHook = () => undefined): ErrorRequestHandler =>
  (err, req, res, _next) => {
    const requestId = req.requestId ?? "unknown";

    if (err instanceof AppError) {
      res.status(err.status).json(buildEnvelope(err.code, err.message, requestId, err.details));
      return;
    }

    if (err instanceof ZodError) {
      res.status(400).json(
        buildEnvelope("VALIDATION_ERROR", "Invalid request payload", requestId, {
          issues: err.issues,
        })
      );
      return;
    }

    onUnhandled({
      error: err,
      requestId,
      method: req.method,
      path: req.path,
    });

    // Unknown — never leak internals.
    res.status(500).json(buildEnvelope("INTERNAL", "Internal server error", requestId));
  };

/** Backward-compatible default handler with no-op alerting (used by tests). */
export const errorHandler: ErrorRequestHandler = buildErrorHandler();

export const notFoundHandler: RequestHandler = (req, res) => {
  const requestId = req.requestId ?? "unknown";
  res
    .status(404)
    .json(buildEnvelope("NOT_FOUND", `Route ${req.method} ${req.path} not found`, requestId));
};
