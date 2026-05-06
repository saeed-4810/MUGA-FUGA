/**
 * E-ARTIST-ADMIN-001 — admin artists route plumbing.
 *
 * Full artist CRUD/moderation needs an admin-claim ID token and is covered in
 * src/pages/admin/ArtistsPage.test.tsx. This browser spec asserts the route
 * guard behaviour that can run deterministically without admin tooling.
 */
import { expect, test } from "@playwright/test";

test.describe("E-ARTIST-ADMIN-001 — admin artists route", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.sessionStorage.removeItem("muga:e2e-user"));
  });

  test("E-ARTIST-ADMIN-001a — /admin/artists without auth redirects to /login", async ({
    page,
  }) => {
    await page.goto("/admin/artists");
    await page.waitForURL(/\/login$/, { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("main").getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("E-ARTIST-ADMIN-001b — login overlay remains usable after redirect", async ({ page }) => {
    await page.goto("/admin/artists");
    await page.waitForURL(/\/login$/, { waitUntil: "commit" });
    const main = page.getByRole("main");
    await expect(main.getByTestId("theme-toggle")).toBeVisible();
    await expect(main.getByTestId("locale-switcher")).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(0);
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
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /create artist/i })).toHaveCount(0);
  });
});
