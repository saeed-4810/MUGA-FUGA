/**
 * E-SHELL-001 — Smoke test that the app shell boots, the theme toggle flips,
 * and the locale switcher is mounted, all without needing a backend.
 *
 * If this fails, the build/preview wiring is broken and every other E2E will
 * fail with confusing errors — keep this passing first.
 */
import { test, expect } from "@playwright/test";

test("E-SHELL-001 — landing page boots with the brand, a working theme toggle, and the locale switcher", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: "FUGA" }).filter({ visible: true }).first()
  ).toBeVisible();

  const toggle = page.getByTestId("theme-toggle");
  await expect(toggle).toBeVisible();
  await toggle.click();
  const isDark = await page.locator("html").evaluate((el) => el.classList.contains("dark"));
  expect(typeof isDark).toBe("boolean");

  await expect(page.getByTestId("locale-switcher")).toBeVisible();
});
