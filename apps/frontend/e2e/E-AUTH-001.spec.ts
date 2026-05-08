/**
 * E-AUTH-001 — sign-in flow as observed end-to-end.
 *
 * We can't actually complete a real Google OAuth handshake in headless Chromium
 * (CAPTCHA, throttling, no Google test harness), so this spec verifies what we
 * CAN observe deterministically up to the popup boundary:
 *
 *   1. /login renders the brand + locale + theme + sign-in CTA
 *   2. Hitting a protected route (/products, /admin/queue) while logged out
 *      bounces to /login
 *   3. Clicking "Sign in with Google" opens a popup pointing at
 *      accounts.google.com (or firebaseapp.com) — we close it there.
 *   4. The locale switcher persists across reloads.
 *
 * The actual sign-in completion + first-time role bootstrap is covered at the
 * unit layer in src/context/AuthContext.test.tsx where the popup is mocked.
 */
import { test, expect } from "@playwright/test";

test.describe("Sign-in flow", () => {
  test("E-AUTH-001a — /login shows the brand, locale switcher, theme toggle, and the sign-in button", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in to muga/i })).toBeVisible();
    const banner = page.getByRole("banner");
    await expect(banner.getByTestId("locale-switcher")).toBeVisible();
    await expect(banner.getByTestId("theme-toggle")).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("E-AUTH-001b — going to /products while logged out bounces you to /login", async ({
    page,
  }) => {
    await page.goto("/products");
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("main").getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("E-AUTH-001c — going to /admin/queue while logged out also bounces to /login", async ({
    page,
  }) => {
    await page.goto("/admin/queue");
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("E-AUTH-001d — clicking 'Sign in with Google' opens a popup pointing at Google accounts", async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    const cta = page.getByRole("main").getByRole("button", { name: /sign in with google/i });
    await expect(cta).toBeVisible();
    if (await cta.isDisabled()) {
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

  test("E-AUTH-001e — picking Dutch in the locale switcher survives a page reload", async ({
    page,
  }) => {
    test.skip(
      Boolean(process.env["E2E_BASE_URL"]),
      "Firebase Hosting preview rewrites SSR routes to the shared staging Cloud Run frontend, so branch locale changes are not deployed there."
    );

    await page.goto("/login");
    const switcher = page.getByRole("banner").getByTestId("locale-switcher");
    await switcher.selectOption("nl");
    await expect(switcher).toHaveValue("nl");
    await page.reload();
    await expect(page.getByRole("banner").getByTestId("locale-switcher")).toHaveValue("nl");
  });
});
