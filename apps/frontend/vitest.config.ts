import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Vitest runs component tests through Vite's transform pipeline. Vite is kept
// here as test tooling only; Next.js remains the frontend runtime/build path.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // Third-party SDK init paths excluded per Decision Log 2026-05-04-006.
        "src/lib/sentry.ts",
        "src/lib/firebase.ts",
        // i18n bootstrap mutates global state at import time.
        "src/i18n/index.ts",
        // Test files themselves.
        "src/**/*.test.{ts,tsx}",
        "src/**/__mocks__/**",
        // Feature-owned files — tests ship with their feature work.
        // Each file is removed from this list as the corresponding tests land.
        // Now covered by their .test.tsx/.test.ts siblings:
        //   AuthContext, LoginPage, UserMenu (auth)
        //   api, uploads, ProductsPage, CreateProductPage (products)
        //   AdminQueuePage (admin queue)
        "src/lib/web-vitals.ts",
        "src/components/LocaleSwitcher.tsx",
        "src/components/PageHeader.tsx",
        "src/components/ThemeToggle.tsx",
        "src/views/DashboardPage.tsx",
        "src/views/NotFoundPage.tsx",
        "src/routes/**",
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
