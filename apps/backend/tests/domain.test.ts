import { describe, expect, it } from "vitest";

import { Role } from "../src/domain/auth.js";
import { CreateProductInput, ProductSchema, UpdateProductInput } from "../src/domain/product.js";
import { SignedUploadInput } from "../src/lib/signedUpload.js";

describe("Zod domain schemas", () => {
  it("T-DOM-001 — CreateProductInput accepts a normal { name, artistId, coverArtPath } payload", () => {
    const ok = CreateProductInput.parse({
      name: "Midnights",
      artistId: "art_taylor_swift",
      coverArtPath: "cover-art/usr_saeed_h/midnights.jpg",
    });
    expect(ok.name).toBe("Midnights");
  });

  it("T-DOM-002 — CreateProductInput rejects an empty name", () => {
    expect(() =>
      CreateProductInput.parse({
        name: "",
        artistId: "art_taylor_swift",
        coverArtPath: "cover-art/usr_saeed_h/x",
      })
    ).toThrow();
  });

  it("T-DOM-003 — UpdateProductInput is a partial — single fields and {} are both fine", () => {
    expect(UpdateProductInput.parse({ name: "Midnights (3am Edition)" }).name).toBe(
      "Midnights (3am Edition)"
    );
    expect(UpdateProductInput.parse({})).toEqual({});
  });

  it("T-DOM-004 — SignedUploadInput rejects unsupported image types like GIF", () => {
    expect(() => SignedUploadInput.parse({ contentType: "image/gif", fileSize: 1024 })).toThrow();
  });

  it("T-DOM-005 — SignedUploadInput rejects files bigger than the 5 MB cap", () => {
    expect(() =>
      SignedUploadInput.parse({ contentType: "image/jpeg", fileSize: 99_999_999 })
    ).toThrow();
  });

  it("T-DOM-006 — Role + ProductSchema sanity check", () => {
    expect(Role.parse("admin")).toBe("admin");
    expect(Role.parse("customer")).toBe("customer");
    expect(() => Role.parse("guest")).toThrow();
    expect(() =>
      ProductSchema.parse({
        id: "prod_midnights",
        name: "Midnights",
        artistId: "art_taylor_swift",
        coverArtPath: "cover-art/usr_saeed_h/midnights.jpg",
        status: "pending",
        ownerUid: "usr_saeed_h",
        ownerEmail: "saeedh582@gmail.com",
        createdAt: "2026-05-08T00:00:00.000Z",
        updatedAt: "2026-05-08T00:00:00.000Z",
      })
    ).not.toThrow();
  });
});
