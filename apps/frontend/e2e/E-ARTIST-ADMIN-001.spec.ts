/**
 * E-ARTIST-ADMIN-001 — admin artists route plumbing.
 *
 * Full artist CRUD/moderation needs an admin-claim ID token and is covered in
 * src/pages/admin/ArtistsPage.test.tsx. This browser spec asserts the route
 * guard behaviour that can run deterministically without admin tooling.
 */
import { expect, test } from "@playwright/test";

test.describe("E-ARTIST-ADMIN-001 — admin artists route", () => {
  test("E-ARTIST-ADMIN-001a — /admin/artists without auth redirects to /login", async ({
    page,
  }) => {
    await page.goto("/admin/artists");
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("main").getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("E-ARTIST-ADMIN-001b — login chrome remains usable after redirect", async ({ page }) => {
    await page.goto("/admin/artists");
    await page.waitForURL(/\/login$/);
    const banner = page.getByRole("banner");
    await expect(banner.getByTestId("theme-toggle")).toBeVisible();
    await expect(banner.getByTestId("locale-switcher")).toBeVisible();
  });

  test("E-ARTIST-ADMIN-001c — customer hitting /admin/artists sees forbidden card", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem(
        "muga:e2e-user",
        JSON.stringify({ uid: "e2e-customer", email: "customer@example.com", role: "customer" })
      );
    });
    await page.goto("/admin/artists");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: /create artist/i })).toHaveCount(0);
  });
});
