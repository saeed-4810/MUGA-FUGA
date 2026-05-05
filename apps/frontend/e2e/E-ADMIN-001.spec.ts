/**
 * E-ADMIN-001 — Admin approval queue (observable behaviour).
 *
 * The full approve/reject flow needs an admin-claim ID token, which the
 * Playwright runner doesn't have without a service-account dance. This
 * spec covers the route plumbing that we CAN deterministically assert
 * end-to-end:
 *
 *   1. /admin/queue without auth redirects to /login
 *   2. signed-in customer hitting /admin/queue sees the role-mismatch
 *      forbidden card (covered at the unit layer; e2e cannot fake a
 *      customer ID token without admin tooling)
 *   3. The /login route renders chrome correctly when a deep link to
 *      /admin/queue forces a redirect
 *
 * Approve/reject behaviour is covered at the unit layer in
 * src/pages/AdminQueuePage.test.tsx (U-ADMIN-004a..c), where the
 * api client is mocked deterministically.
 */
import { test, expect } from "@playwright/test";

test.describe("E-ADMIN-001 — admin approval queue", () => {
  test("E-ADMIN-001a — /admin/queue without auth redirects to /login", async ({ page }) => {
    await page.goto("/admin/queue");
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
  });

  test("E-ADMIN-001b — login chrome stays usable after a deep-link redirect", async ({ page }) => {
    await page.goto("/admin/queue");
    await page.waitForURL(/\/login$/);
    // Theme toggle + locale switcher must remain reachable after the redirect.
    await expect(page.getByTestId("theme-toggle")).toBeVisible();
    await expect(page.getByTestId("locale-switcher")).toBeVisible();
  });
});
