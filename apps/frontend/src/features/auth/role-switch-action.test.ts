import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieState: { value: string | undefined } = { value: undefined };
const serverPostMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "__session" && cookieState.value ? { value: cookieState.value } : undefined,
  }),
}));

vi.mock("../../lib/server/api", () => ({
  serverApi: {
    post: (...args: unknown[]) => serverPostMock(...args),
  },
}));

import { switchRoleOnServer } from "./role-switch-action";

describe("switchRoleOnServer", () => {
  beforeEach(() => {
    cookieState.value = "session-cookie";
    serverPostMock.mockReset();
  });

  it("U-ROLE-SWITCH-ACTION-001 — calls backend server-side with the SSR session cookie", async () => {
    serverPostMock.mockResolvedValue({ uid: "usr_1", email: "user@muga.app", role: "admin" });

    await expect(switchRoleOnServer("admin")).resolves.toEqual({
      ok: true,
      uid: "usr_1",
      email: "user@muga.app",
      role: "admin",
    });

    expect(serverPostMock).toHaveBeenCalledWith(
      "/me/role",
      { role: "admin" },
      {
        auth: { sessionCookie: "session-cookie" },
      }
    );
  });

  it("U-ROLE-SWITCH-ACTION-002 — returns a safe error when no server session exists", async () => {
    cookieState.value = undefined;

    await expect(switchRoleOnServer("admin")).resolves.toEqual({
      ok: false,
      message: "No active server session.",
    });
    expect(serverPostMock).not.toHaveBeenCalled();
  });

  it("U-ROLE-SWITCH-ACTION-003 — validates roles before calling the backend", async () => {
    await expect(switchRoleOnServer("superuser" as "admin")).resolves.toEqual({
      ok: false,
      message: "Invalid role.",
    });
    expect(serverPostMock).not.toHaveBeenCalled();
  });

  it("U-ROLE-SWITCH-ACTION-004 — maps backend failures to user-safe errors", async () => {
    serverPostMock.mockRejectedValue(new Error("CORS should not happen server-side"));

    await expect(switchRoleOnServer("customer")).resolves.toEqual({
      ok: false,
      message: "Role switch failed.",
    });
  });
});
