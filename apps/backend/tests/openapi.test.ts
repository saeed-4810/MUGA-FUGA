import { describe, expect, it } from "vitest";

import { openApiSpec } from "../src/config/openapi.js";

describe("OpenAPI spec — sanity check the hand-curated paths + schemas", () => {
  it("T-DOCS-001 — every CTR endpoint we ship is declared", () => {
    const paths = Object.keys(openApiSpec.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/health",
        "/healthz/ready",
        "/me",
        "/me/bootstrap",
        "/products/signed-upload",
        "/products",
        "/products/{id}",
        "/products/{id}/approve",
        "/products/{id}/reject",
        "/artists/signed-upload",
        "/artists",
        "/artists/{id}",
        "/artists/{id}/approve",
        "/artists/{id}/reject",
      ])
    );
  });

  it("T-DOCS-001b — every public server URL uses the /api base path shown to reviewers", () => {
    expect(openApiSpec.servers.map((server) => server.url)).toEqual(
      expect.arrayContaining([
        "http://localhost:3001/api",
        "https://muga-staging.web.app/api",
        "https://muga-production.web.app/api",
      ])
    );
  });

  it("T-DOCS-002 — bearerAuth security scheme + ErrorEnvelope are both declared (any client codegen relies on these)", () => {
    expect(openApiSpec.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    expect(openApiSpec.components.schemas.ErrorEnvelope.required).toEqual(
      expect.arrayContaining(["code", "message", "requestId"])
    );
  });

  it("T-DOCS-003 — docs expose current response schemas for product, artist, and readiness surfaces", () => {
    expect(openApiSpec.components.schemas.Product.required).toEqual(
      expect.arrayContaining(["artistId", "artist", "coverArtPath"])
    );
    expect(openApiSpec.components.schemas.Artist.required).toEqual(
      expect.arrayContaining(["name_lc", "slug", "status"])
    );
    expect(openApiSpec.components.schemas.ReadinessResponse.required).toEqual(
      expect.arrayContaining(["status", "firestore", "latency_ms"])
    );
  });
});
