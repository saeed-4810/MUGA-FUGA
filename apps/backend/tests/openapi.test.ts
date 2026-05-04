import { describe, expect, it } from "vitest";

import { openApiSpec } from "../src/config/openapi.js";

describe("T-DOCS-001..002: OpenAPI spec integrity", () => {
  it("T-DOCS-001 — declares all CTR endpoints", () => {
    const paths = Object.keys(openApiSpec.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/health",
        "/me",
        "/me/bootstrap",
        "/products/signed-upload",
        "/products",
        "/products/{id}",
        "/products/{id}/approve",
        "/products/{id}/reject",
      ])
    );
  });

  it("T-DOCS-002 — declares the bearerAuth security scheme and ErrorEnvelope schema", () => {
    expect(openApiSpec.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    expect(openApiSpec.components.schemas.ErrorEnvelope.required).toEqual(
      expect.arrayContaining(["code", "message", "requestId"])
    );
  });
});
