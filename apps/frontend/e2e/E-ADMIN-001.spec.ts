/**
 * E-ADMIN-001 — admin approval queue, end-to-end pieces we can actually verify.
 *
 * The full approve/reject loop needs a real admin ID token, which the runner
 * doesn't have without a service-account dance. So this spec asserts the
 * pieces we CAN deterministically prove in a real browser:
 *
 *   1. /admin/queue without a session bounces to /login
 *   2. The login chrome (theme toggle + locale switcher) stays usable after a
 *      deep-link redirect
 *
 * The approve/reject behaviour is covered at the unit layer in
 * src/pages/AdminQueuePage.test.tsx where the api client is mocked.
 */
import { test, expect } from "@playwright/test";

test.describe("Admin approval queue", () => {
  test("E-ADMIN-001a — /admin/queue without a session bounces to /login", async ({ page }) => {
    await page.goto("/admin/queue");
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("main").getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("E-ADMIN-001b — after a deep-link redirect, the login page chrome (theme + locale) is still wired", async ({
    page,
  }) => {
    await page.goto("/admin/queue");
    await page.waitForURL(/\/login$/);
    const banner = page.getByRole("banner");
    await expect(banner.getByTestId("theme-toggle")).toBeVisible();
    await expect(banner.getByTestId("locale-switcher")).toBeVisible();
  });
});
