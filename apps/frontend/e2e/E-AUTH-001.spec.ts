/**
 * E-AUTH-001 — Google sign-in flow (observable behaviour).
 *
 * Real OAuth-with-Google in a headless browser is brittle (CAPTCHA, throttling,
 * no test harness from Google). This spec covers what we CAN deterministically
 * assert end-to-end without crossing the Google popup boundary:
 *
 *   1. /login renders as a chrome-less overlay with brand + locale + theme + sign-in button
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
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.sessionStorage.removeItem("muga:e2e-user"));
  });

  test("E-AUTH-001a — /login renders sign-in CTA + brand + chrome-less overlay", async ({
    page,
  }) => {
    await page.goto("/login");
    // Brand mark visible: desktop uses the FUGA logo in the hero; mobile keeps
    // the compact MUGA text mark in the auth column.
    const visibleFugaLogo = page.getByRole("img", { name: /fuga/i }).filter({ visible: true });
    const visibleMugaText = page.getByText("MUGA", { exact: true }).filter({ visible: true });
    await expect(visibleFugaLogo.or(visibleMugaText).first()).toBeVisible();
    // Pre-auth overlay: locale + theme controls are rendered inside the login
    // main content. AppShell chrome is intentionally NOT mounted on /login.
    const main = page.getByRole("main");
    await expect(main.getByTestId("locale-switcher")).toBeVisible();
    await expect(main.getByTestId("theme-toggle")).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    // Sign-in CTA is the call-to-action on the login page.
    await expect(main.getByRole("button", { name: /sign in with google/i })).toBeVisible();
  });

  test("E-AUTH-001b — unauthenticated visit to /products redirects to /login", async ({ page }) => {
    await page.goto("/products");
    await page.waitForURL(/\/login$/, { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("main").getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("E-AUTH-001c — unauthenticated visit to /admin/queue redirects to /login", async ({
    page,
  }) => {
    await page.goto("/admin/queue");
    await page.waitForURL(/\/login$/, { waitUntil: "commit" });
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
    const switcher = page.getByRole("main").getByTestId("locale-switcher");
    await switcher.selectOption("nl");
    // Round-trip through a navigation to assert the choice survives
    await page.reload();
    await expect(switcher).toHaveValue("nl");
  });
});
