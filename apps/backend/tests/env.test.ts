import { describe, expect, it } from "vitest";

import { loadEnv } from "../src/config/env.js";

const baseValid = {
  FIREBASE_PROJECT_ID: "muga-staging",
  FIREBASE_STORAGE_BUCKET: "muga-staging.appspot.com",
};

describe("T-ENV-001..003: env validation", () => {
  it("T-ENV-001 — loads valid environment with defaults", () => {
    const env = loadEnv(baseValid as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe("development");
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(["http://localhost:5173"]);
  });

  it("T-ENV-002 — splits comma-separated CORS origins and trims", () => {
    const env = loadEnv({
      ...baseValid,
      CORS_ALLOWED_ORIGINS: "https://a.com, https://b.com ,",
    } as NodeJS.ProcessEnv);
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(["https://a.com", "https://b.com"]);
  });

  it("T-ENV-003 — rejects missing FIREBASE_PROJECT_ID", () => {
    expect(() =>
      loadEnv({ FIREBASE_STORAGE_BUCKET: "x.appspot.com" } as NodeJS.ProcessEnv)
    ).toThrowError(/FIREBASE_PROJECT_ID/);
  });

  it("T-ENV-004 — coerces numeric env values", () => {
    const env = loadEnv({
      ...baseValid,
      PORT: "8080",
      SENTRY_TRACES_SAMPLE_RATE: "0.5",
    } as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(8080);
    expect(env.SENTRY_TRACES_SAMPLE_RATE).toBe(0.5);
  });

  it("T-ENV-005 — splits and lowercases initial admin emails", () => {
    const env = loadEnv({
      ...baseValid,
      INITIAL_ADMIN_EMAILS: " ALICE@MUGA.app, bob@muga.app ",
    } as NodeJS.ProcessEnv);
    expect(env.INITIAL_ADMIN_EMAILS).toEqual(["alice@muga.app", "bob@muga.app"]);
  });
});
