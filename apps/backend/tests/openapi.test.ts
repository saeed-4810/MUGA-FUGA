import { describe, expect, it } from "vitest";

import { openApiSpec } from "../src/config/openapi.js";

describe("OpenAPI spec — sanity check the hand-curated paths + schemas", () => {
  it("T-DOCS-001 — every CTR endpoint we ship is declared", () => {
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

  it("T-DOCS-002 — bearerAuth security scheme + ErrorEnvelope are both declared (any client codegen relies on these)", () => {
    expect(openApiSpec.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    expect(openApiSpec.components.schemas.ErrorEnvelope.required).toEqual(
      expect.arrayContaining(["code", "message", "requestId"])
    );
  });
});
