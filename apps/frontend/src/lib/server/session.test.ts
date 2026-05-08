import { describe, expect, it, vi } from "vitest";

import {
  createServerSessionCookie,
  isValidIdTokenInput,
  SESSION_EXPIRES_IN_MS,
  toSessionUser,
  verifyServerSessionCookie,
} from "./session";

describe("server session helpers", () => {
  it("validates ID token input", () => {
    expect(isValidIdTokenInput("token")).toBe(true);
    expect(isValidIdTokenInput(" ")).toBe(false);
    expect(isValidIdTokenInput(undefined)).toBe(false);
  });

  it("creates a session cookie with the configured max age", async () => {
    const createSessionCookie = vi.fn().mockResolvedValue("session-cookie");

    await expect(createServerSessionCookie({ createSessionCookie }, "id-token")).resolves.toBe(
      "session-cookie"
    );
    expect(createSessionCookie).toHaveBeenCalledWith("id-token", {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });
  });

  it("maps decoded claims to a safe session user", () => {
    expect(
      toSessionUser({ uid: "usr_marcus_admin", email: "marcus@muga.app", role: "admin" })
    ).toEqual({
      uid: "usr_marcus_admin",
      email: "marcus@muga.app",
      role: "admin",
    });
    expect(
      toSessionUser({
        uid: "u3",
        email: "saeed.dev@muga.app",
        name: "Named User",
        picture: "https://photos.example/u3.jpg",
      })
    ).toEqual({
      uid: "u3",
      email: "saeed.dev@muga.app",
      role: "customer",
      displayName: "Named User",
      photoURL: "https://photos.example/u3.jpg",
    });
    expect(toSessionUser({ uid: "usr_saeed_h", role: "owner" })).toEqual({
      uid: "usr_saeed_h",
      email: "",
      role: "customer",
    });
  });

  it("returns missing when no session cookie exists", async () => {
    const verifySessionCookie = vi.fn();

    await expect(verifyServerSessionCookie({ verifySessionCookie }, undefined)).resolves.toEqual({
      status: "missing",
    });
    expect(verifySessionCookie).not.toHaveBeenCalled();
  });

  it("verifies a session cookie with revocation checks", async () => {
    const verifySessionCookie = vi.fn().mockResolvedValue({
      uid: "usr_marcus_admin",
      email: "marcus@muga.app",
      role: "admin",
    });

    await expect(verifyServerSessionCookie({ verifySessionCookie }, "session")).resolves.toEqual({
      status: "authenticated",
      user: { uid: "usr_marcus_admin", email: "marcus@muga.app", role: "admin" },
    });
    expect(verifySessionCookie).toHaveBeenCalledWith("session", true);
  });

  it("returns invalid for failed verification", async () => {
    const verifySessionCookie = vi.fn().mockRejectedValue(new Error("revoked"));

    await expect(verifyServerSessionCookie({ verifySessionCookie }, "bad")).resolves.toEqual({
      status: "invalid",
    });
  });
});
