import { beforeEach, describe, expect, it, vi } from "vitest";

const certMock = vi.fn((credentials: Record<string, string>) => ({ kind: "cert", credentials }));
const applicationDefaultMock = vi.fn(() => ({ kind: "adc" }));
const getAppsMock = vi.fn();
const initializeAppMock = vi.fn((options: unknown) => ({ name: "initialized", options }));
const getAuthMock = vi.fn((app: unknown) => ({ app }));

vi.mock("firebase-admin/app", () => ({
  applicationDefault: () => applicationDefaultMock(),
  cert: (credentials: Record<string, string>) => certMock(credentials),
  getApps: () => getAppsMock(),
  initializeApp: (options: unknown) => initializeAppMock(options),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: (app: unknown) => getAuthMock(app),
}));

const loadModule = async () => {
  vi.resetModules();
  return import("./firebase-admin");
};

beforeEach(() => {
  certMock.mockClear();
  applicationDefaultMock.mockClear();
  getAppsMock.mockReset();
  initializeAppMock.mockClear();
  getAuthMock.mockClear();
  delete process.env["FIREBASE_PROJECT_ID"];
  delete process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
});

describe("firebase admin singleton", () => {
  it("reuses an existing Firebase Admin app", async () => {
    const existing = { name: "existing" };
    getAppsMock.mockReturnValue([existing]);
    const { getFirebaseAdminApp, getFirebaseAdminAuth } = await loadModule();

    expect(getFirebaseAdminApp()).toBe(existing);
    expect(getFirebaseAdminAuth()).toEqual({ app: existing });
    expect(initializeAppMock).not.toHaveBeenCalled();
  });

  it("initializes with application default credentials", async () => {
    getAppsMock.mockReturnValue([]);
    process.env["FIREBASE_PROJECT_ID"] = "muga-staging";
    const { getFirebaseAdminApp } = await loadModule();

    expect(getFirebaseAdminApp()).toEqual({
      name: "initialized",
      options: { credential: { kind: "adc" }, projectId: "muga-staging" },
    });
    expect(applicationDefaultMock).toHaveBeenCalledTimes(1);
  });

  it("initializes with service account JSON and memoizes the app", async () => {
    getAppsMock.mockReturnValue([]);
    process.env["FIREBASE_SERVICE_ACCOUNT_JSON"] = JSON.stringify({ client_email: "x" });
    const { getFirebaseAdminApp } = await loadModule();

    const first = getFirebaseAdminApp();
    const second = getFirebaseAdminApp();

    expect(first).toBe(second);
    expect(certMock).toHaveBeenCalledWith({ client_email: "x" });
    expect(initializeAppMock).toHaveBeenCalledTimes(1);
  });
});
