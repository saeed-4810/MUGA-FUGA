import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  I18N_NAMESPACES,
  SUPPORTED_LOCALES,
  normalizeLocale,
  resources,
} from "./resources";

describe("i18n bundled resources", () => {
  it("U-I18N-001 — exposes EN/NL namespaces from one bundled source", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(SUPPORTED_LOCALES).toEqual(["en", "nl"]);
    expect(I18N_NAMESPACES).toContain("admin");
    expect(resources.en.auth.login.title).toBeTruthy();
    expect(resources.nl.admin.queue.title).toBeTruthy();
  });

  it("U-I18N-002 — normalizes explicit and fallback locales", () => {
    expect(normalizeLocale("nl-NL")).toBe("nl");
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
  });
});
