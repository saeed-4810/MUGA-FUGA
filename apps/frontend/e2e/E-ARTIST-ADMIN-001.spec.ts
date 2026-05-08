/**
 * E-ARTIST-ADMIN-001 — admin artists route guard, observable end-to-end.
 *
 * Full artist CRUD/moderation needs an admin ID token and is covered in
 * src/pages/admin/ArtistsPage.test.tsx. This browser spec just verifies the
 * route guards that we can run deterministically without admin tooling.
 */
import { expect, test } from "@playwright/test";

test.describe("Admin artists route guard", () => {
  test("E-ARTIST-ADMIN-001a — /admin/artists without a session bounces to /login", async ({
    page,
  }) => {
    await page.goto("/admin/artists");
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("main").getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("E-ARTIST-ADMIN-001b — login chrome (theme + locale) still works after the deep-link redirect", async ({
    page,
  }) => {
    await page.goto("/admin/artists");
    await page.waitForURL(/\/login$/);
    const banner = page.getByRole("banner");
    await expect(banner.getByTestId("theme-toggle")).toBeVisible();
    await expect(banner.getByTestId("locale-switcher")).toBeVisible();
  });

  test("E-ARTIST-ADMIN-001c — Saeed (customer) hitting /admin/artists sees the forbidden card, not the create UI", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem(
        "muga:e2e-user",
        JSON.stringify({
          uid: "usr_saeed_h",
          email: "saeedh582@gmail.com",
          role: "customer",
        })
      );
    });
    await page.goto("/admin/artists");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: /create artist/i })).toHaveCount(0);
  });
});
