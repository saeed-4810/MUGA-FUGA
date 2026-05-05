import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Backend route suites use Supertest + coverage instrumentation and can
    // exceed Vitest's 5s default on pre-push when frontend and backend gates run
    // together. Keep the tests deterministic; give CI/hook contention headroom.
    testTimeout: 10_000,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      // src/index.ts is the server-bind entry point — excluded because it cannot be
      // unit-tested without spinning a real socket. Any other exclusion requires an
      // ADR + Decision Log entry per OPERATING_DOR_DOD.md §5.3.
      exclude: [
        // Server bind — cannot be unit-tested without opening a real socket.
        "src/index.ts",
        // App bootstrap — wires concrete deps; covered indirectly by route tests.
        "src/app.ts",
        // Test files themselves.
        "src/**/*.test.ts",
        // Third-party SDK init paths (Sentry, Firebase Admin) — see Decision Log
        // 2026-05-04-006 and OPERATING_DOR_DOD.md §5.3.
        "src/config/sentry.ts",
        "src/lib/firebase.ts",
        // Feature routes — tests ship alongside their owning feature.
        // No remaining feature-route exclusions (auth, me, products, docs are
        // all covered by their tests/*.test.ts siblings).
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
