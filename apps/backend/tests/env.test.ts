import { describe, expect, it } from "vitest";

import { loadEnv } from "../src/config/env.js";

const baseValid = {
  FIREBASE_PROJECT_ID: "muga-staging",
  FIREBASE_STORAGE_BUCKET: "muga-staging.appspot.com",
};

describe("loadEnv — environment validation at boot", () => {
  it("T-ENV-001 — a minimally-valid env loads with sensible defaults", () => {
    const env = loadEnv(baseValid as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe("development");
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(["http://localhost:5173"]);
  });

  it("T-ENV-002 — CORS_ALLOWED_ORIGINS is split on commas and trimmed (so trailing commas don't make a blank entry)", () => {
    const env = loadEnv({
      ...baseValid,
      CORS_ALLOWED_ORIGINS: "https://muga.app, https://staging.muga.app ,",
    } as NodeJS.ProcessEnv);
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(["https://muga.app", "https://staging.muga.app"]);
  });

  it("T-ENV-003 — without FIREBASE_PROJECT_ID we fail loud at boot (we never want to silently fall back)", () => {
    expect(() =>
      loadEnv({ FIREBASE_STORAGE_BUCKET: "muga-staging.appspot.com" } as NodeJS.ProcessEnv)
    ).toThrowError(/FIREBASE_PROJECT_ID/);
  });

  it("T-ENV-004 — string env vars get coerced to numbers where the schema expects them (PORT, SENTRY_TRACES_SAMPLE_RATE)", () => {
    const env = loadEnv({
      ...baseValid,
      PORT: "8080",
      SENTRY_TRACES_SAMPLE_RATE: "0.5",
    } as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(8080);
    expect(env.SENTRY_TRACES_SAMPLE_RATE).toBe(0.5);
  });

  it("T-ENV-005 — INITIAL_ADMIN_EMAILS is split, trimmed, and lowercased so case doesn't bite us", () => {
    const env = loadEnv({
      ...baseValid,
      INITIAL_ADMIN_EMAILS: " MARCUS@MUGA.app, founder@muga.app ",
    } as NodeJS.ProcessEnv);
    expect(env.INITIAL_ADMIN_EMAILS).toEqual(["marcus@muga.app", "founder@muga.app"]);
  });
});
