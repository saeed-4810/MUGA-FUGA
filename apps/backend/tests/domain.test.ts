import { describe, expect, it } from "vitest";

import { Role } from "../src/domain/auth.js";
import { CreateProductInput, ProductSchema, UpdateProductInput } from "../src/domain/product.js";
import { SignedUploadInput } from "../src/lib/signedUpload.js";

describe("T-DOM-001..006: domain schemas", () => {
  it("T-DOM-001 — CreateProductInput accepts a valid payload", () => {
    const ok = CreateProductInput.parse({
      name: "First Light",
      artistId: "art-1",
      coverArtPath: "cover-art/abc/123.jpg",
    });
    expect(ok.name).toBe("First Light");
  });

  it("T-DOM-002 — CreateProductInput rejects empty name", () => {
    expect(() =>
      CreateProductInput.parse({ name: "", artistId: "art-1", coverArtPath: "p" })
    ).toThrow();
  });

  it("T-DOM-003 — UpdateProductInput allows partial", () => {
    expect(UpdateProductInput.parse({ name: "renamed" }).name).toBe("renamed");
    expect(UpdateProductInput.parse({})).toEqual({});
  });

  it("T-DOM-004 — SignedUploadInput rejects unsupported content type", () => {
    expect(() => SignedUploadInput.parse({ contentType: "image/gif", fileSize: 1024 })).toThrow();
  });

  it("T-DOM-005 — SignedUploadInput rejects oversized files", () => {
    expect(() =>
      SignedUploadInput.parse({ contentType: "image/jpeg", fileSize: 99_999_999 })
    ).toThrow();
  });

  it("T-DOM-006 — Role enum and ProductSchema are well-formed", () => {
    expect(Role.parse("admin")).toBe("admin");
    expect(Role.parse("customer")).toBe("customer");
    expect(() => Role.parse("guest")).toThrow();
    expect(() =>
      ProductSchema.parse({
        id: "p1",
        name: "Album",
        artistId: "art-1",
        coverArtPath: "cover-art/u/1.jpg",
        status: "pending",
        ownerUid: "u1",
        ownerEmail: "u@muga.app",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      })
    ).not.toThrow();
  });
});
