import type * as ReactModule from "react";
import { describe, expect, it, vi } from "vitest";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "muga.locale" && cookieValue.current ? { value: cookieValue.current } : undefined,
  }),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return { ...actual, cache: <T extends (...args: never[]) => unknown>(fn: T) => fn };
});

describe("server locale", () => {
  it("U-I18N-SSR-001 — reads and normalizes the locale cookie", async () => {
    vi.resetModules();
    cookieValue.current = "nl-NL";
    const { getServerLocale } = await import("./locale");
    await expect(getServerLocale()).resolves.toBe("nl");
  });

  it("U-I18N-SSR-002 — falls back to English when the cookie is absent", async () => {
    vi.resetModules();
    cookieValue.current = undefined;
    const { getServerLocale } = await import("./locale");
    await expect(getServerLocale()).resolves.toBe("en");
  });
});
