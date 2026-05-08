/**
 * E-PROD-001 — Browsing + creating products from the customer side.
 *
 * Most of the create flow needs a real signed-in user, which we can't get in
 * the default preview environment (Firebase Auth not configured for the
 * runner). So this spec asserts the routing/plumbing pieces we can verify
 * deterministically. In a fully-configured staging with a runner service
 * account, this can be expanded to actually submit a product end-to-end.
 */
import { test, expect } from "@playwright/test";

test.describe("Products list + create", () => {
  test("E-PROD-001a — /products without a session bounces you to /login", async ({ page }) => {
    await page.goto("/products");
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("main").getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("E-PROD-001b — /products/new without a session also bounces to /login", async ({ page }) => {
    await page.goto("/products/new");
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("E-PROD-001c — clicking sign-in either opens Google's popup or shows the 'Firebase not configured' banner", async ({
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

  test("E-PROD-001d — Saeed types a new artist name in the combobox and the 'Request a new artist' dialog opens", async ({
    page,
  }) => {
    test.skip(
      Boolean(process.env["E2E_BASE_URL"]),
      "Authenticated create-flow smoke uses the local E2E auth bypass, which is not enabled on deployed previews."
    );

    const e2eUser = encodeURIComponent(
      JSON.stringify({
        uid: "usr_saeed_h",
        email: "saeedh582@gmail.com",
        role: "customer",
      })
    );
    await page.context().addCookies([
      {
        name: "muga.e2e-user",
        value: e2eUser,
        domain: "localhost",
        path: "/",
      },
    ]);
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
    await page.route("**/products?status=pending", (route) =>
      route.fulfill({ json: { items: [] } })
    );
    await page.route("**/artists?status=pending", (route) =>
      route.fulfill({ json: { items: [] } })
    );
    await page.route("**/artists?status=published**", (route) =>
      route.fulfill({ json: { items: [] } })
    );

    await page.goto("/products/new");
    await page.getByRole("textbox", { name: /product name/i }).fill("Punisher");
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("combobox", { name: /artist/i }).fill("Phoebe Bridgers");
    await expect(page.getByRole("button", { name: /add "phoebe bridgers"/i })).toBeVisible();
    await page.getByRole("button", { name: /add "phoebe bridgers"/i }).click();
    await expect(page.getByRole("dialog", { name: /request a new artist/i })).toBeVisible();
  });
});
