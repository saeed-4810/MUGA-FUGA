/**
 * E-AUTH-001 — Google sign-in flow (observable behaviour).
 *
 * Real OAuth-with-Google in a headless browser is brittle (CAPTCHA, throttling,
 * no test harness from Google). This spec covers what we CAN deterministically
 * assert end-to-end without crossing the Google popup boundary:
 *
 *   1. /login renders with brand + locale + theme + sign-in button
 *   2. Clicking the protected /products route while unauthenticated redirects to /login
 *   3. Clicking the protected /admin/queue route while unauthenticated redirects to /login
 *   4. Clicking the sign-in button opens (or attempts to open) a popup
 *      navigating to accounts.google.com — this is the boundary; we close it.
 *   5. The locale switcher persists across navigations
 *
 * Sign-in completion + token bootstrap is covered at the unit layer
 * (src/context/AuthContext.test.tsx U-AUTH-CTX-003) where the popup is mocked.
 */
import { test, expect } from "@playwright/test";

test.describe("E-AUTH-001 — Google sign-in flow", () => {
  test("E-AUTH-001a — /login renders sign-in CTA + brand + chrome", async ({ page }) => {
    await page.goto("/login");
    // Brand mark visible (filter to the visible one — sidebar copy is hidden on mobile)
    await expect(
      page.getByText("MUGA", { exact: true }).filter({ visible: true }).first()
    ).toBeVisible();
    // Pre-auth chrome: locale + theme always reachable from the header
    // (banner). The LoginPage also renders an in-page copy in <main>, so we
    // scope to the banner to keep the locator unambiguous and to assert the
    // chrome the user actually sees on every other route too.
    const banner = page.getByRole("banner");
    await expect(banner.getByTestId("locale-switcher")).toBeVisible();
    await expect(banner.getByTestId("theme-toggle")).toBeVisible();
    // Sign-in CTA is the call-to-action on the login page. The header
    // <UserMenu /> renders an identical button when unauthenticated, so we
    // scope the locator to the <main> landmark to disambiguate.
    await expect(
      page.getByRole("main").getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("E-AUTH-001b — unauthenticated visit to /products redirects to /login", async ({ page }) => {
    await page.goto("/products");
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("main").getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("E-AUTH-001c — unauthenticated visit to /admin/queue redirects to /login", async ({
    page,
  }) => {
    await page.goto("/admin/queue");
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("E-AUTH-001d — sign-in click opens a popup pointing at Google accounts", async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    // Scope to <main> — the header <UserMenu /> renders the same label when
    // unauthenticated, which would otherwise trip strict mode.
    const cta = page.getByRole("main").getByRole("button", { name: /sign in with google/i });
    await expect(cta).toBeVisible();
    // If firebase isn't configured in this environment the button is disabled
    // and a banner explains why — accept that as the valid alternative branch.
    if (await cta.isDisabled()) {
      await expect(page.getByRole("status")).toBeVisible();
      return;
    }
    // Otherwise the click opens a popup navigating to accounts.google.com.
    // We don't complete the OAuth dance — we just verify the popup is a
    // Google sign-in attempt, then close it.
    const [popup] = await Promise.all([
      context.waitForEvent("page", { timeout: 10_000 }),
      cta.click(),
    ]);
    await popup.waitForLoadState("domcontentloaded").catch(() => undefined);
    expect(popup.url()).toMatch(/accounts\.google\.com|firebaseapp\.com/);
    await popup.close();
  });

  test("E-AUTH-001e — locale switcher persists across navigations", async ({ page }) => {
    await page.goto("/login");
    // Use the header (banner) switcher — the LoginPage also renders an
    // in-page copy in <main>, which would trip strict mode on the global
    // testid query. The header copy is the one users see across the app.
    const switcher = page.getByRole("banner").getByTestId("locale-switcher");
    await switcher.selectOption("nl");
    // Round-trip through a navigation to assert the choice survives
    await page.reload();
    await expect(switcher).toHaveValue("nl");
  });
});
