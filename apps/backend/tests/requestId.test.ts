import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { requestIdMiddleware } from "../src/middleware/requestId.js";

describe("T-REQ-001..003: request id propagation", () => {
  const buildApp = () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get("/", (req, res) => res.json({ id: req.requestId }));
    return app;
  };

  it("T-REQ-001 — generates a uuid when no header present", async () => {
    const res = await request(buildApp()).get("/");
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers["x-request-id"]).toBe(res.body.id);
  });

  it("T-REQ-002 — echoes incoming x-request-id when reasonable", async () => {
    const res = await request(buildApp()).get("/").set("x-request-id", "client-supplied-123");
    expect(res.body.id).toBe("client-supplied-123");
  });

  it("T-REQ-003 — replaces oversize x-request-id with generated uuid", async () => {
    const oversize = "a".repeat(200);
    const res = await request(buildApp()).get("/").set("x-request-id", oversize);
    expect(res.body.id).not.toBe(oversize);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
