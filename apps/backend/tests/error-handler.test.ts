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

describe("T-ERR-001..006: error envelope", () => {
  it("T-ERR-001 — AppError yields its status + code + requestId echoed", async () => {
    const app = buildApp((_req, _res, next) => next(Errors.forbidden("nope")));
    const res = await request(app).get("/boom").set("x-request-id", "req-abc");
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "FORBIDDEN", message: "nope", requestId: "req-abc" });
    expect(res.headers["x-request-id"]).toBe("req-abc");
  });

  it("T-ERR-002 — ZodError returns 400 VALIDATION_ERROR with issues", async () => {
    const app = buildApp((_req, _res, next) => {
      try {
        z.object({ x: z.number() }).parse({ x: "no" });
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

  it("T-ERR-003 — unknown error returns 500 without leaking details", async () => {
    const app = buildApp((_req, _res, next) => next(new Error("internal SQL error: secret")));
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ code: "INTERNAL", message: "Internal server error" });
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });

  it("T-ERR-004 — notFoundHandler returns 404 envelope with method/path", async () => {
    const app = buildApp((_req, _res, next) => next());
    const res = await request(app).get("/missing");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(res.body.message).toContain("GET /missing");
  });

  it("T-ERR-005 — Errors.notFound and Errors.validation produce expected shapes", () => {
    const a = Errors.notFound("widget");
    expect(a).toBeInstanceOf(AppError);
    expect(a.status).toBe(404);

    const b = Errors.validation({ field: "x" });
    expect(b.status).toBe(400);
    expect(b.details).toEqual({ field: "x" });
  });

  it("T-ERR-006 — Errors.unauthenticated, conflict, internal default messages", () => {
    expect(Errors.unauthenticated().status).toBe(401);
    expect(Errors.conflict("dup").status).toBe(409);
    expect(Errors.internal().status).toBe(500);
  });

  it("T-ERR-007 — buildErrorHandler invokes onUnhandled hook for unknown errors with route context", async () => {
    const onUnhandled = vi.fn();
    const app = buildApp(
      (_req, _res, next) => next(new Error("kaboom")),
      buildErrorHandler(onUnhandled)
    );
    const res = await request(app).get("/boom").set("x-request-id", "rid-99");
    expect(res.status).toBe(500);
    expect(onUnhandled).toHaveBeenCalledTimes(1);
    expect(onUnhandled.mock.calls[0]![0]).toMatchObject({
      requestId: "rid-99",
      method: "GET",
      path: "/boom",
    });
    expect((onUnhandled.mock.calls[0]![0] as { error: Error }).error.message).toBe("kaboom");
  });

  it("T-ERR-008b — handlers fall back to requestId='unknown' when middleware did not set one", async () => {
    // Build an app WITHOUT requestIdMiddleware so req.requestId is undefined.
    const app = express();
    app.get("/boom", (_req, _res, next) => next(Errors.notFound("widget")));
    app.use(notFoundHandler);
    app.use(errorHandler);

    const a = await request(app).get("/boom");
    expect(a.body.requestId).toBe("unknown");

    const b = await request(app).get("/missing");
    expect(b.body.requestId).toBe("unknown");
  });

  it("T-ERR-008 — buildErrorHandler does NOT invoke onUnhandled for AppError or ZodError", async () => {
    const onUnhandled = vi.fn();
    const handler = buildErrorHandler(onUnhandled);

    const appA = buildApp((_req, _res, next) => next(Errors.notFound("x")), handler);
    await request(appA).get("/boom");

    const appB = buildApp((_req, _res, next) => {
      try {
        z.object({ x: z.number() }).parse({ x: "no" });
        next();
      } catch (e) {
        next(e);
      }
    }, handler);
    await request(appB).get("/boom");

    expect(onUnhandled).not.toHaveBeenCalled();
  });
});
