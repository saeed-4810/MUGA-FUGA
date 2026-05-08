import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { requestIdMiddleware } from "../src/middleware/requestId.js";

describe("requestIdMiddleware — every response gets a traceable id", () => {
  const buildApp = () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get("/", (req, res) => res.json({ id: req.requestId }));
    return app;
  };

  it("T-REQ-001 — no incoming x-request-id → we mint a fresh UUID and echo it on the response", async () => {
    const res = await request(buildApp()).get("/");
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers["x-request-id"]).toBe(res.body.id);
  });

  it("T-REQ-002 — caller sends a sensible x-request-id → we keep theirs (so distributed traces line up)", async () => {
    const res = await request(buildApp()).get("/").set("x-request-id", "trace_abcdef_001");
    expect(res.body.id).toBe("trace_abcdef_001");
  });

  it("T-REQ-003 — caller sends a ridiculous 200-char id → we throw it away and mint a UUID instead", async () => {
    const oversize = "a".repeat(200);
    const res = await request(buildApp()).get("/").set("x-request-id", oversize);
    expect(res.body.id).not.toBe(oversize);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
