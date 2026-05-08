import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSession, destroySession } from "./session-client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("session client", () => {
  it("creates a session from a refreshed Firebase ID token", async () => {
    const getIdToken = vi.fn().mockResolvedValue("id-token");
    fetchMock.mockResolvedValue({ ok: true });

    await createSession({ getIdToken });

    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(fetchMock).toHaveBeenCalledWith("/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: "id-token" }),
    });
  });

  it("throws when session creation fails", async () => {
    fetchMock.mockResolvedValue({ ok: false });

    await expect(createSession({ getIdToken: vi.fn().mockResolvedValue("bad") })).rejects.toThrow(
      /create server session/i
    );
  });

  it("clears the server session", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await destroySession();

    expect(fetchMock).toHaveBeenCalledWith("/session", { method: "DELETE" });
  });

  it("throws when clearing the session fails", async () => {
    fetchMock.mockResolvedValue({ ok: false });

    await expect(destroySession()).rejects.toThrow(/clear server session/i);
  });
});
