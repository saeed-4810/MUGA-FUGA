import { describe, expect, it } from "vitest";

import type { Env } from "../src/config/env.js";
import { storageMediaUrl } from "../src/lib/mediaUrl.js";

describe("storageMediaUrl", () => {
  it("encodes Firebase Storage object paths into public media URLs", () => {
    const env = { FIREBASE_STORAGE_BUCKET: "muga-staging-cover-art" } as Env;

    expect(storageMediaUrl(env, "cover-art/usr_saeed_h/my cover.jpg")).toBe(
      "https://firebasestorage.googleapis.com/v0/b/muga-staging-cover-art/o/cover-art%2Fusr_saeed_h%2Fmy%20cover.jpg?alt=media"
    );
  });
});
