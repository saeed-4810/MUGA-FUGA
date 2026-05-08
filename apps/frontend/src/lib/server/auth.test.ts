import type * as ReactModule from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
});
const verifySessionMock = vi.fn();

vi.mock("next/headers", () => ({ cookies: () => cookiesMock() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirectMock(path) }));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof ReactModule>("react");
  return { ...actual, cache: <T extends (...args: never[]) => unknown>(fn: T) => fn };
});
vi.mock("./firebase-admin", () => ({ getFirebaseAdminAuth: () => ({}) }));
vi.mock("./session", () => ({
  SESSION_COOKIE_NAME: "__session",
  verifyServerSessionCookie: (...args: unknown[]) => verifySessionMock(...args),
}));

import { getServerSession, requireServerRole, requireServerSession } from "./auth";

const adminUser = { uid: "usr_marcus_admin", email: "marcus@muga.app", role: "admin" as const };

describe("server auth route helpers", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockClear();
    verifySessionMock.mockReset();
    delete process.env["E2E_AUTH_BYPASS"];
  });

  it("returns null when no authenticated session cookie exists", async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined });
    verifySessionMock.mockResolvedValue({ status: "missing" });

    await expect(getServerSession()).resolves.toBeNull();
  });

  it("returns a session for authenticated cookies", async () => {
    cookiesMock.mockResolvedValue({ get: () => ({ value: "cookie-value" }) });
    verifySessionMock.mockResolvedValue({ status: "authenticated", user: adminUser });

    await expect(getServerSession()).resolves.toEqual({
      sessionCookie: "cookie-value",
      user: adminUser,
    });
  });

  it("returns an E2E bypass session only when explicitly enabled", async () => {
    process.env["E2E_AUTH_BYPASS"] = "1";
    const e2eAdmin = {
      ...adminUser,
      displayName: "Admin User",
      photoURL: "https://cdn.example.test/u.png",
    };
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === "muga.e2e-user"
          ? { value: encodeURIComponent(JSON.stringify(e2eAdmin)) }
          : undefined,
    });

    await expect(getServerSession()).resolves.toEqual({
      sessionCookie: "e2e-session",
      user: e2eAdmin,
    });
    expect(verifySessionMock).not.toHaveBeenCalled();
  });

  it("ignores malformed E2E bypass cookies", async () => {
    process.env["E2E_AUTH_BYPASS"] = "1";
    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === "muga.e2e-user" ? { value: "%" } : undefined),
    });
    verifySessionMock.mockResolvedValue({ status: "missing" });

    await expect(getServerSession()).resolves.toBeNull();
  });

  it("returns minimal E2E bypass users without optional profile fields", async () => {
    process.env["E2E_AUTH_BYPASS"] = "1";
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === "muga.e2e-user"
          ? { value: encodeURIComponent(JSON.stringify(adminUser)) }
          : undefined,
    });

    await expect(getServerSession()).resolves.toEqual({
      sessionCookie: "e2e-session",
      user: adminUser,
    });
  });

  it("ignores E2E bypass cookies with invalid user payloads", async () => {
    process.env["E2E_AUTH_BYPASS"] = "1";
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === "muga.e2e-user"
          ? {
              value: encodeURIComponent(
                JSON.stringify({
                  uid: "usr_marcus_admin",
                  email: "weird-role@gmail.com",
                  role: "owner",
                })
              ),
            }
          : undefined,
    });
    verifySessionMock.mockResolvedValue({ status: "missing" });

    await expect(getServerSession()).resolves.toBeNull();
  });

  it("redirects unauthenticated users to login", async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined });
    verifySessionMock.mockResolvedValue({ status: "missing" });

    await expect(requireServerSession()).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects authenticated users without the required role", async () => {
    cookiesMock.mockResolvedValue({ get: () => ({ value: "cookie-value" }) });
    verifySessionMock.mockResolvedValue({
      status: "authenticated",
      user: { uid: "usr_saeed_h", email: "saeedh582@gmail.com", role: "customer" },
    });

    await expect(requireServerRole("admin")).rejects.toThrow("redirect:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("returns the session when the required role matches", async () => {
    cookiesMock.mockResolvedValue({ get: () => ({ value: "cookie-value" }) });
    verifySessionMock.mockResolvedValue({ status: "authenticated", user: adminUser });

    await expect(requireServerRole("admin")).resolves.toEqual({
      sessionCookie: "cookie-value",
      user: adminUser,
    });
  });
});
