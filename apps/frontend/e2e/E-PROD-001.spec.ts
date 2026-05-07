/**
 * E-PROD-001 — Customer creates and browses products (observable behaviour).
 *
 * The signed-in create path uses the same localhost-only e2e user shim as
 * the auth context and mocks the backend/storage boundaries. OAuth completion
 * itself remains covered at the unit layer.
 */
import { test, expect } from "@playwright/test";

test.describe("E-PROD-001 — Products list + create", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.sessionStorage.removeItem("muga:e2e-user"));
  });

  test("E-PROD-001a — /products without auth redirects to /login", async ({ page }) => {
    await page.goto("/products");
    await page.waitForURL(/\/login$/, { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/login$/);
    // Scope to <main> — the header <UserMenu /> renders the same label when
    // unauthenticated, which would otherwise trip Playwright's strict mode.
    await expect(
      page.getByRole("main").getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("E-PROD-001b — /products/new without auth redirects to /login", async ({ page }) => {
    await page.goto("/products/new");
    await page.waitForURL(/\/login$/, { waitUntil: "commit" });
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
      await expect(page.getByRole("main")).toContainText(/google sign-in|secure|configured/i);
      return;
    }
    const popupPromise = context.waitForEvent("page", { timeout: 10_000 }).catch(() => null);
    await cta.click();
    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState("domcontentloaded").catch(() => undefined);
      expect(popup.url()).toMatch(/accounts\.google\.com|firebaseapp\.com/);
      await popup.close();
      return;
    }
    await expect(page.locator("iframe").first()).toBeVisible();
  });

  test("E-PROD-001d — customer can open request-artist dialog from create form", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem(
        "muga:e2e-user",
        JSON.stringify({ uid: "e2e-customer", email: "customer@example.com", role: "customer" })
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
    await page.getByLabel(/product name/i).fill("Artist Request Draft");
    await page.getByRole("button", { name: /^next$/i }).click();
    await page.getByRole("combobox", { name: /artist/i }).fill("E2E Artist");
    await expect(page.getByRole("button", { name: /add "e2e artist"/i })).toBeVisible();
    await page.getByRole("button", { name: /add "e2e artist"/i }).click();
    await expect(page.getByRole("dialog", { name: /request a new artist/i })).toBeVisible();
  });

  test("E-PROD-001e — customer completes create wizard and returns to products", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem(
        "muga:e2e-user",
        JSON.stringify({ uid: "e2e-customer", email: "customer@example.com", role: "customer" })
      );
    });
    await page.route("**/products?status=pending", (route) =>
      route.fulfill({ json: { items: [] } })
    );
    await page.route("**/artists?status=pending", (route) =>
      route.fulfill({ json: { items: [] } })
    );
    await page.route("**/artists?status=published**", (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: "artist-1",
              imageUrl: "https://cdn.example/artist.jpg",
              name: "E2E Artist",
              status: "published",
            },
          ],
        },
      })
    );
    await page.route("**/products/signed-upload", (route) =>
      route.fulfill({
        json: {
          uploadUrl: "http://localhost:5174/mock-cover-upload",
          objectPath: "cover-art/e2e/cover.jpg",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      })
    );
    await page.route("**/mock-cover-upload", (route) => route.fulfill({ status: 200, body: "" }));
    let productCreated = false;
    await page.route("**/products", async (route) => {
      if (route.request().method() === "POST") {
        expect(route.request().postDataJSON()).toEqual({
          name: "E2E Album",
          artistId: "artist-1",
          coverArtPath: "cover-art/e2e/cover.jpg",
        });
        productCreated = true;
        await route.fulfill({ json: { id: "prod-1" } });
        return;
      }
      await route.fulfill({
        json: {
          items: [
            {
              id: "prod-1",
              name: "E2E Album",
              artist: {
                id: "artist-1",
                imageUrl: "https://cdn.example/artist.jpg",
                name: "E2E Artist",
                status: "published",
              },
              coverArtPath: "cover-art/e2e/cover.jpg",
              coverArtUrl: "https://cdn.example/cover.jpg",
              status: "pending",
              ownerEmail: "customer@example.com",
              createdAt: new Date().toISOString(),
            },
          ],
        },
      });
    });

    await page.goto("/products/new");
    await page.getByLabel(/product name/i).fill("E2E Album");
    await page.getByRole("button", { name: /^next$/i }).click();
    await page.getByRole("combobox", { name: /artist/i }).fill("E2E Artist");
    await page.getByRole("option", { name: /e2e artist/i }).click();
    await expect(page.getByText("Published")).toBeVisible();
    await page.getByRole("button", { name: /^next$/i }).click();
    await page.getByLabel(/cover art/i).setInputFiles({
      name: "cover.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("cover"),
    });
    await expect(page.getByRole("dialog", { name: /edit cover art/i })).toBeVisible();
    await page.getByRole("button", { name: /^apply$/i }).click();
    await expect(page.getByRole("dialog", { name: /edit cover art/i })).toBeHidden();
    await page.getByRole("button", { name: /^next$/i }).click();
    await expect(page.getByRole("heading", { name: /^review$/i })).toBeVisible();
    await expect(page.getByAltText("Cover art preview")).toBeVisible();
    await page.getByRole("button", { name: /^submit$/i }).click();
    await expect(page).toHaveURL(/\/products$/);
    expect(productCreated).toBe(true);
    await expect(page.getByText("E2E Album")).toBeVisible();
    await expect(page.getByLabel("E2E Album by E2E Artist, Pending review")).toBeVisible();
    await expect(page.getByText("E2E Artist")).toBeVisible();
    await expect(page.getByText("Pending review")).toBeVisible();
    await expect(page.getByAltText("Cover art for E2E Album")).toBeVisible();
  });
});
