import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { Errors, AppError } from "../src/domain/errors.js";
import { buildErrorHandler, errorHandler, notFoundHandler } from "../src/middleware/error.js";
import { requestIdMiddleware } from "../src/middleware/requestId.js";

const buildApp = (
  handler: (req: Request, res: Response, next: NextFunction) => unknown,
  errHandler = errorHandler
) => {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.get("/boom", handler);
  app.use(notFoundHandler);
  app.use(errHandler);
  return app;
};

describe("error handler — turning thrown errors into the API error envelope", () => {
  it("T-ERR-001 — AppError flows through with its status + code + the requestId echoed back to the caller", async () => {
    const app = buildApp((_req, _res, next) => next(Errors.forbidden("nope")));
    const res = await request(app).get("/boom").set("x-request-id", "rid_test_err001");
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: "FORBIDDEN",
      message: "nope",
      requestId: "rid_test_err001",
    });
    expect(res.headers["x-request-id"]).toBe("rid_test_err001");
  });

  it("T-ERR-002 — ZodError gets turned into a 400 VALIDATION_ERROR with the zod issues attached", async () => {
    const app = buildApp((_req, _res, next) => {
      try {
        z.object({ x: z.number() }).parse({ x: "not-a-number" });
        next();
      } catch (err) {
        next(err);
      }
    });
    const res = await request(app).get("/boom");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details.issues).toBeInstanceOf(Array);
  });

  it("T-ERR-003 — random Error → 500 INTERNAL with a safe message; we never leak internal details", async () => {
    const app = buildApp((_req, _res, next) =>
      next(new Error("internal SQL error: db_password=hunter2"))
    );
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ code: "INTERNAL", message: "Internal server error" });
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
  });

  it("T-ERR-004 — hitting an unknown route → 404 envelope echoes the method + path so the caller knows what they hit", async () => {
    const app = buildApp((_req, _res, next) => next());
    const res = await request(app).get("/this-route-does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(res.body.message).toContain("GET /this-route-does-not-exist");
  });

  it("T-ERR-005 — Errors.notFound and Errors.validation build the expected AppError shape", () => {
    const notFound = Errors.notFound("artist");
    expect(notFound).toBeInstanceOf(AppError);
    expect(notFound.status).toBe(404);

    const invalid = Errors.validation({ field: "name" });
    expect(invalid.status).toBe(400);
    expect(invalid.details).toEqual({ field: "name" });
  });

  it("T-ERR-006 — Errors.unauthenticated / conflict / internal all use the right HTTP status", () => {
    expect(Errors.unauthenticated().status).toBe(401);
    expect(Errors.conflict("name already exists").status).toBe(409);
    expect(Errors.internal().status).toBe(500);
  });

  it("T-ERR-007 — buildErrorHandler calls the onUnhandled hook for unknown errors (this is what wires up Sentry/PagerDuty)", async () => {
    const onUnhandled = vi.fn();
    const app = buildApp(
      (_req, _res, next) => next(new Error("kaboom")),
      buildErrorHandler(onUnhandled)
    );
    const res = await request(app).get("/boom").set("x-request-id", "rid_test_err007");
    expect(res.status).toBe(500);
    expect(onUnhandled).toHaveBeenCalledTimes(1);
    expect(onUnhandled.mock.calls[0]![0]).toMatchObject({
      requestId: "rid_test_err007",
      method: "GET",
      path: "/boom",
    });
    expect((onUnhandled.mock.calls[0]![0] as { error: Error }).error.message).toBe("kaboom");
  });

  it("T-ERR-008b — when no requestId middleware ran, both handlers fall back to requestId='unknown' (no NPE)", async () => {
    const app = express();
    app.get("/boom", (_req, _res, next) => next(Errors.notFound("artist")));
    app.use(notFoundHandler);
    app.use(errorHandler);

    const onBoom = await request(app).get("/boom");
    expect(onBoom.body.requestId).toBe("unknown");

    const onMissing = await request(app).get("/some-other-path");
    expect(onMissing.body.requestId).toBe("unknown");
  });

  it("T-ERR-008 — onUnhandled is NOT called for AppError or ZodError (those are 'expected' errors)", async () => {
    const onUnhandled = vi.fn();
    const handler = buildErrorHandler(onUnhandled);

    const appWithAppError = buildApp(
      (_req, _res, next) => next(Errors.notFound("artist")),
      handler
    );
    await request(appWithAppError).get("/boom");

    const appWithZodError = buildApp((_req, _res, next) => {
      try {
        z.object({ x: z.number() }).parse({ x: "no" });
        next();
      } catch (e) {
        next(e);
      }
    }, handler);
    await request(appWithZodError).get("/boom");

    expect(onUnhandled).not.toHaveBeenCalled();
  });
});
