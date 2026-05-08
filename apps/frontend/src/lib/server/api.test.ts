import { beforeEach, describe, expect, it, vi } from "vitest";

import { getServerApiBase, serverApi, serverApiFetch } from "./api";

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    ...(init.statusText ? { statusText: init.statusText } : {}),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  delete process.env["API_URL"];
  delete process.env["NEXT_PUBLIC_API_URL"];
});

describe("server API adapter", () => {
  it("prefers server-only API_URL over public env", () => {
    process.env["API_URL"] = "https://internal.example/api";
    process.env["NEXT_PUBLIC_API_URL"] = "https://public.example/api";

    expect(getServerApiBase()).toBe("https://internal.example/api");
  });

  it("falls back to public and default API bases", () => {
    process.env["NEXT_PUBLIC_API_URL"] = "https://public.example/api";
    expect(getServerApiBase()).toBe("https://public.example/api");
  });

  it("fetches authenticated data with no-store and request headers", async () => {
    process.env["API_URL"] = "https://api.example";
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ items: [1] }));

    await expect(
      serverApiFetch<{ items: number[] }>(
        "/products",
        { method: "GET" },
        {
          auth: { idToken: "token", requestId: "rid" },
          fetchImpl,
        }
      )
    ).resolves.toEqual({ items: [1] });

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example/products", {
      method: "GET",
      headers: expect.any(Headers),
      cache: "no-store",
    });
    const headers = fetchImpl.mock.calls[0]?.[1].headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer token");
    expect(headers.get("x-request-id")).toBe("rid");
  });

  it("forwards SSR session cookie when no bearer token is available", async () => {
    process.env["API_URL"] = "https://api.example";
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    await serverApi.get("/me", {
      auth: { sessionCookie: "session value", requestId: "rid" },
      fetchImpl,
    });

    const headers = fetchImpl.mock.calls[0]?.[1].headers as Headers;
    expect(headers.get("cookie")).toBe("__session=session%20value");
    expect(headers.get("x-muga-session")).toBe("session value");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("x-request-id")).toBe("rid");
  });

  it("prefers bearer token over SSR session cookie when both are provided", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    await serverApi.get("/me", {
      auth: { idToken: "token", sessionCookie: "session" },
      fetchImpl,
    });

    const headers = fetchImpl.mock.calls[0]?.[1].headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer token");
    expect(headers.get("cookie")).toBeNull();
  });

  it("uses global fetch when no fetch implementation is injected", async () => {
    process.env["API_URL"] = "https://api.example";
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchImpl);

    await serverApi.get("/health");

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example/health", expect.any(Object));
  });

  it("sets JSON content type when sending a body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    await serverApi.post("/products", { name: "Album" }, { fetchImpl });

    const headers = fetchImpl.mock.calls[0]?.[1].headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("preserves explicit content type", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    await serverApiFetch(
      "/upload",
      {
        method: "POST",
        body: "x",
        headers: { "content-type": "text/plain" },
      },
      { fetchImpl }
    );

    const headers = fetchImpl.mock.calls[0]?.[1].headers as Headers;
    expect(headers.get("content-type")).toBe("text/plain");
  });

  it("maps JSON API errors", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { code: "FORBIDDEN", message: "No", requestId: "r1", details: { role: "customer" } },
          { status: 403 }
        )
      );

    await expect(serverApi.get("/admin", { fetchImpl })).rejects.toEqual({
      status: 403,
      code: "FORBIDDEN",
      message: "No",
      requestId: "r1",
      details: { role: "customer" },
    });
  });

  it("maps non-JSON API errors and 204 responses", async () => {
    await expect(
      serverApi.get("/bad", {
        fetchImpl: vi
          .fn()
          .mockResolvedValue(new Response("oops", { status: 500, statusText: "Boom" })),
      })
    ).rejects.toMatchObject({ status: 500, code: "UNKNOWN", message: "Boom", requestId: "server" });

    await expect(
      serverApi.delete("/products/p1", {
        fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
      })
    ).resolves.toBeUndefined();
  });

  it("maps empty error bodies and supports undefined post bodies", async () => {
    await expect(
      serverApi.get("/empty-error", {
        fetchImpl: vi
          .fn()
          .mockResolvedValue(new Response(null, { status: 404, statusText: "Missing" })),
      })
    ).rejects.toMatchObject({ status: 404, code: "UNKNOWN", message: "Missing" });

    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    await serverApi.post("/touch", undefined, { fetchImpl });
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(fetchImpl.mock.calls[0]?.[1].body).toBeUndefined();
  });

  it("supports patch helper", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    await serverApi.patch("/products/p1", { name: "New" }, { fetchImpl });

    expect(fetchImpl.mock.calls[0]?.[1].method).toBe("PATCH");
  });
});
