import { beforeEach, describe, expect, it, vi } from "vitest";

const serverGetMock = vi.fn();

vi.mock("./api", () => ({
  serverApi: {
    get: (...args: unknown[]) => serverGetMock(...args),
  },
}));

import { loadPendingReviewCount } from "./pending-review";

describe("pending review server loader", () => {
  beforeEach(() => serverGetMock.mockReset());

  it("returns zero for non-admin users without touching the API", async () => {
    await expect(loadPendingReviewCount("session", false)).resolves.toBe(0);
    expect(serverGetMock).not.toHaveBeenCalled();
  });

  it("sums pending products and artists for admins", async () => {
    serverGetMock.mockResolvedValueOnce({ items: [1, 2] }).mockResolvedValueOnce({ items: [3] });

    await expect(loadPendingReviewCount("session", true)).resolves.toBe(3);
    expect(serverGetMock).toHaveBeenNthCalledWith(1, "/products?status=pending", {
      auth: { sessionCookie: "session" },
    });
    expect(serverGetMock).toHaveBeenNthCalledWith(2, "/artists?status=pending", {
      auth: { sessionCookie: "session" },
    });
  });

  it("fails closed to zero when either request fails", async () => {
    serverGetMock.mockRejectedValueOnce(new Error("offline"));

    await expect(loadPendingReviewCount("session", true)).resolves.toBe(0);
  });
});
