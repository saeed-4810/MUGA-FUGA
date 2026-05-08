import { defineConfig, devices } from "@playwright/test";

const PORT = process.env["PORT"] ?? "5174";
const BASE_URL = process.env["E2E_BASE_URL"] ?? `http://localhost:${PORT}`;

// Playwright typedefs use exactOptionalPropertyTypes-incompatible optional
// fields. When E2E_BASE_URL is set we want NO webServer (tests run against a
// live remote); otherwise we spin up a local preview. Build the config in two
// shapes to keep the type-checker honest.
const baseConfig = {
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  reporter: process.env["CI"]
    ? ([["github"], ["html", { open: "never" }]] as [string, unknown][])
    : ([["list"]] as [string][]),
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry" as const,
    screenshot: "only-on-failure" as const,
    video: "retain-on-failure" as const,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
};

export default defineConfig(
  process.env["E2E_BASE_URL"]
    ? baseConfig
    : {
        ...baseConfig,
        webServer: {
          command: "E2E_AUTH_BYPASS=1 pnpm preview",
          port: Number(PORT),
          reuseExistingServer: !process.env["CI"],
          timeout: 60_000,
        },
      }
);
