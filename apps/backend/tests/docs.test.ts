import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { docsRouter } from "../src/routes/docs.js";

/**
 * T-DOCS-001..002 — OpenAPI live routes (CTR-DOCS)
 *
 * Covered by MUGA-3 (docs.ts removed from coverage.exclude).
 */
describe("T-DOCS-001..002: /api/docs + /api/openapi.json (CTR-DOCS)", () => {
  const buildApp = () => {
    const app = express();
    app.use(docsRouter());
    return app;
  };

  it("T-DOCS-001 — GET /api/openapi.json returns a valid OpenAPI 3.x document", async () => {
    const res = await request(buildApp()).get("/api/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(typeof res.body.info).toBe("object");
    expect(res.body.info.title).toBeTruthy();
    expect(typeof res.body.paths).toBe("object");
  });

  it("T-DOCS-002 — GET /api/docs serves Swagger UI HTML", async () => {
    const res = await request(buildApp()).get("/api/docs/");
    // Swagger UI responds 200 with HTML that links the OpenAPI JSON.
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toMatch(/swagger/i);
  });
});
