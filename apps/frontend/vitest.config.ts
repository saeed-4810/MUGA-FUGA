import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      // src/main.tsx is the React mount entry — excluded because it cannot be
      // unit-tested in jsdom (it touches the real DOM root). All other
      // exclusions require an ADR + Decision Log entry.
      exclude: [
        // React mount entry — exercises real DOM root, not unit-testable.
        "src/main.tsx",
        // Vite ambient types.
        "src/vite-env.d.ts",
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
        // The four auth files (AuthContext, LoginPage, RequireAuth, UserMenu)
        // are now covered by their .test.tsx siblings.
        "src/lib/api.ts",
        "src/lib/uploads.ts",
        "src/lib/web-vitals.ts",
        "src/components/AppShell.tsx",
        "src/components/LocaleSwitcher.tsx",
        "src/components/PageHeader.tsx",
        "src/components/ThemeToggle.tsx",
        "src/pages/DashboardPage.tsx",
        "src/pages/ProductsPage.tsx",
        "src/pages/CreateProductPage.tsx",
        "src/pages/AdminQueuePage.tsx",
        "src/pages/NotFoundPage.tsx",
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
