import type * as ReactModule from "react";
import { describe, expect, it, vi } from "vitest";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "muga.theme" && cookieValue.current ? { value: cookieValue.current } : undefined,
  }),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return { ...actual, cache: <T extends (...args: never[]) => unknown>(fn: T) => fn };
});

describe("server theme", () => {
  it("U-THEME-SSR-001 — reads valid theme cookies", async () => {
    vi.resetModules();
    cookieValue.current = "dark";
    const { getServerTheme, getServerThemeClass } = await import("./theme");
    await expect(getServerTheme()).resolves.toBe("dark");
    expect(getServerThemeClass("dark")).toBe("dark");
  });

  it("U-THEME-SSR-002 — falls back to system for missing or invalid cookies", async () => {
    vi.resetModules();
    cookieValue.current = "blue";
    const { getServerTheme, getServerThemeClass } = await import("./theme");
    await expect(getServerTheme()).resolves.toBe("system");
    expect(getServerThemeClass("system")).toBeUndefined();
  });
});
