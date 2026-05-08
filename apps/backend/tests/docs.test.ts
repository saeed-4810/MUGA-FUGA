import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { docsRouter } from "../src/routes/docs.js";

/**
 * T-DOCS-001..002 — OpenAPI live routes (CTR-DOCS)
 *
 * Covers /api/docs (Swagger UI) + /api/openapi.json.
 */
describe("/api/docs + /api/openapi.json — live OpenAPI surface", () => {
  const buildApp = () => {
    const app = express();
    app.use(docsRouter());
    return app;
  };

  it("T-DOCS-001 — /api/openapi.json serves a valid OpenAPI 3.x document with title + paths", async () => {
    const res = await request(buildApp()).get("/api/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(typeof res.body.info).toBe("object");
    expect(res.body.info.title).toBeTruthy();
    expect(typeof res.body.paths).toBe("object");
  });

  it("T-DOCS-002 — /api/docs serves the Swagger UI HTML page", async () => {
    const res = await request(buildApp()).get("/api/docs/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toMatch(/swagger/i);
  });
});
