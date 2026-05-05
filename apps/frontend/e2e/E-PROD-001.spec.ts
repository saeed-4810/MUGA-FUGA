/**
 * E-PROD-001 — Customer creates and browses products (observable behaviour).
 *
 * The full create-flow requires a signed-in user, so for environments
 * where Firebase Auth isn't reachable from the runner (the default
 * preview mode + the `isFirebaseConfigured` early-out) we assert the
 * route plumbing only.  In a fully-configured staging where the runner
 * has a service account or admin token (out of scope for this PR) the
 * flow can be expanded to actually submit a product.
 */
import { test, expect } from "@playwright/test";

test.describe("E-PROD-001 — Products list + create", () => {
  test("E-PROD-001a — /products without auth redirects to /login", async ({ page }) => {
    await page.goto("/products");
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveURL(/\/login$/);
    // Scope to <main> — the header <UserMenu /> renders the same label when
    // unauthenticated, which would otherwise trip Playwright's strict mode.
    await expect(
      page.getByRole("main").getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("E-PROD-001b — /products/new without auth redirects to /login", async ({ page }) => {
    await page.goto("/products/new");
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("E-PROD-001c — sign-in CTA leads to Google or shows the unconfigured banner", async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    // Scope to <main> — see note in E-PROD-001a.
    const cta = page.getByRole("main").getByRole("button", { name: /sign in with google/i });
    await expect(cta).toBeVisible();
    if (await cta.isDisabled()) {
      await expect(page.getByRole("status")).toBeVisible();
      return;
    }
    const [popup] = await Promise.all([
      context.waitForEvent("page", { timeout: 10_000 }),
      cta.click(),
    ]);
    await popup.waitForLoadState("domcontentloaded").catch(() => undefined);
    expect(popup.url()).toMatch(/accounts\.google\.com|firebaseapp\.com/);
    await popup.close();
  });
});
