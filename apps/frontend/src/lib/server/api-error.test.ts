import { describe, expect, it } from "vitest";

import { toSerializableApiError } from "./api-error";

describe("server api error serialization", () => {
  it("preserves safe API error fields including details", () => {
    expect(
      toSerializableApiError(
        {
          status: 409,
          code: "CONFLICT",
          message: "duplicate",
          requestId: "rid_inv_001",
          details: { id: "art_taylor_swift" },
        },
        "fallback"
      )
    ).toEqual({
      status: 409,
      code: "CONFLICT",
      message: "duplicate",
      requestId: "rid_inv_001",
      details: { id: "art_taylor_swift" },
    });
  });

  it("falls back for unknown error shapes", () => {
    expect(toSerializableApiError(new Error("hidden"), "safe fallback")).toEqual({
      status: 500,
      code: "UNKNOWN",
      message: "hidden",
      requestId: "server",
    });
    expect(toSerializableApiError(null, "safe fallback")).toEqual({
      status: 500,
      code: "UNKNOWN",
      message: "safe fallback",
      requestId: "server",
    });
  });
});
