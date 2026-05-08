/**
 * U-UPLOAD-001..00x — signed-URL upload flow.
 *
 * Covers:
 *   - requestSignedUpload posts contentType + fileSize and returns the response shape
 *   - uploadCoverArt happy path: signed-url + PUT + returns objectPath
 *   - uploadCoverArt PUT failure throws with status code
 *   - watchdog wraps the operation (no actual stuck-loading assertion — the
 *     timer-based path is covered indirectly by the alerting unit tests)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const apiPostMock = vi.fn();
vi.mock("./api", () => ({
  api: {
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

import { requestSignedUpload, uploadCoverArt } from "./uploads";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  apiPostMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("U-UPLOAD-001..004: signed-URL upload", () => {
  it("U-UPLOAD-001 — requestSignedUpload posts file metadata and returns the response shape", async () => {
    apiPostMock.mockResolvedValue({
      uploadUrl: "https://storage.example.com/upload",
      objectPath: "cover-art/uid/123-abc",
      expiresAt: "2026-05-04T23:59:59Z",
    });
    const file = new File(["x"], "cover.jpg", { type: "image/jpeg" });
    const out = await requestSignedUpload(file);
    expect(apiPostMock).toHaveBeenCalledWith("/products/signed-upload", {
      contentType: "image/jpeg",
      fileSize: 1,
    });
    expect(out.objectPath).toBe("cover-art/uid/123-abc");
    expect(out.uploadUrl).toMatch(/^https:\/\//);
  });

  it("U-UPLOAD-002 — uploadCoverArt happy path: signed url → PUT → objectPath", async () => {
    apiPostMock.mockResolvedValue({
      uploadUrl: "https://storage.example.com/u",
      objectPath: "cover-art/uid/abc",
      expiresAt: "2026-05-04T23:59:59Z",
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const file = new File(["bytes"], "cover.png", { type: "image/png" });
    const out = await uploadCoverArt(file);
    expect(out).toBe("cover-art/uid/abc");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://storage.example.com/u");
    expect(init?.method).toBe("PUT");
    expect((init?.headers as Record<string, string>)["content-type"]).toBe("image/png");
    expect(init?.body).toBe(file);
  });

  it("U-UPLOAD-003 — uploadCoverArt throws when the PUT fails", async () => {
    apiPostMock.mockResolvedValue({
      uploadUrl: "https://storage.example.com/u",
      objectPath: "cover-art/uid/abc",
      expiresAt: "2026-05-04T23:59:59Z",
    });
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));
    const file = new File(["bytes"], "cover.png", { type: "image/png" });
    await expect(uploadCoverArt(file)).rejects.toThrow(/Upload failed.*403/);
  });

  it("U-UPLOAD-004 — uploadCoverArt rethrows when the signed-URL request fails", async () => {
    apiPostMock.mockRejectedValue({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "fileSize too big",
      requestId: "req-1",
    });
    const file = new File(["x".repeat(100)], "cover.jpg", { type: "image/jpeg" });
    await expect(uploadCoverArt(file)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
