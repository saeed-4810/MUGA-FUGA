import { getIdToken } from "./firebase";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type ApiError = {
  status: number;
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
};

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = { auth: true }
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  if (options.auth ?? true) {
    const token = await getIdToken();
    if (!token) {
      throw {
        status: 401,
        code: "UNAUTHENTICATED",
        message: "No active session",
        requestId: "client",
      } satisfies ApiError;
    }
    headers.set("authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    let body: Partial<ApiError> = {};
    try {
      body = text ? (JSON.parse(text) as Partial<ApiError>) : {};
    } catch {
      // non-JSON error body
    }
    const err: ApiError = {
      status: res.status,
      code: body.code ?? "UNKNOWN",
      message: body.message ?? res.statusText,
      requestId: body.requestId ?? "unknown",
      ...(body.details ? { details: body.details } : {}),
    };
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, opts?: { auth?: boolean }) => apiFetch<T>(path, { method: "GET" }, opts),
  post: <T>(path: string, body: unknown, opts?: { auth?: boolean }) =>
    apiFetch<T>(
      path,
      body === undefined ? { method: "POST" } : { method: "POST", body: JSON.stringify(body) },
      opts
    ),
  patch: <T>(path: string, body: unknown, opts?: { auth?: boolean }) =>
    apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }, opts),
  delete: <T>(path: string, opts?: { auth?: boolean }) =>
    apiFetch<T>(path, { method: "DELETE" }, opts),
};
