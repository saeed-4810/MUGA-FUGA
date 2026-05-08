import { getApiBase, type ApiError } from "../api";
import { getPublicEnv } from "../env";

import { SESSION_COOKIE_NAME } from "./session";

export interface ServerApiAuthContext {
  idToken?: string;
  sessionCookie?: string;
  requestId?: string;
}

export interface ServerApiFetchOptions {
  auth?: ServerApiAuthContext;
  fetchImpl?: typeof fetch;
}

export const getServerApiBase = (): string =>
  getApiBase(
    process.env["API_URL"] ?? process.env["NEXT_PUBLIC_API_URL"] ?? getPublicEnv("API_URL")
  );

const parseErrorBody = async (res: Response): Promise<Partial<ApiError>> => {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Partial<ApiError>;
  } catch {
    return {};
  }
};

const toApiError = (res: Response, body: Partial<ApiError>): ApiError => ({
  status: res.status,
  code: body.code ?? "UNKNOWN",
  message: body.message ?? res.statusText,
  requestId: body.requestId ?? "server",
  ...(body.details ? { details: body.details } : {}),
});

export const serverApiFetch = async <T>(
  path: string,
  init: RequestInit = {},
  options: ServerApiFetchOptions = {}
): Promise<T> => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");
  if (options.auth?.idToken) headers.set("authorization", `Bearer ${options.auth.idToken}`);
  if (!options.auth?.idToken && options.auth?.sessionCookie) {
    headers.set(
      "cookie",
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(options.auth.sessionCookie)}`
    );
    headers.set("x-muga-session", options.auth.sessionCookie);
  }
  if (options.auth?.requestId) headers.set("x-request-id", options.auth.requestId);

  const res = await fetchImpl(`${getServerApiBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw toApiError(res, await parseErrorBody(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

export const serverApi = {
  get: <T>(path: string, options?: ServerApiFetchOptions) =>
    serverApiFetch<T>(path, { method: "GET" }, options),
  post: <T>(path: string, body: unknown, options?: ServerApiFetchOptions) =>
    serverApiFetch<T>(
      path,
      body === undefined ? { method: "POST" } : { method: "POST", body: JSON.stringify(body) },
      options
    ),
  patch: <T>(path: string, body: unknown, options?: ServerApiFetchOptions) =>
    serverApiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }, options),
  delete: <T>(path: string, options?: ServerApiFetchOptions) =>
    serverApiFetch<T>(path, { method: "DELETE" }, options),
};
