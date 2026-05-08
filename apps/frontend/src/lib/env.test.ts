import { describe, expect, it } from "vitest";

import { getDefaultLocale, getPublicEnv, getSupportedLocales } from "./env";

describe("P-ARCH-NEXTJS-001: public environment helpers", () => {
  it("resolves known keys without throwing in browser-compatible code", () => {
    expect(
      getPublicEnv("API_URL") === undefined || typeof getPublicEnv("API_URL") === "string"
    ).toBe(true);
  });

  it("returns configured and default locale lists", () => {
    expect(Array.isArray(getSupportedLocales())).toBe(true);
    expect(getSupportedLocales("en,nl, es")).toEqual(["en", "nl", "es"]);
    expect(getSupportedLocales(null)).toEqual(["en", "nl"]);
  });

  it("returns configured and default fallback locales", () => {
    expect(typeof getDefaultLocale()).toBe("string");
    expect(getDefaultLocale("nl")).toBe("nl");
    expect(getDefaultLocale(null)).toBe("en");
  });
});
