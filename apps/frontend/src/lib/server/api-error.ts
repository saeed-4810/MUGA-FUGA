import type { ApiError } from "../api";

export const toSerializableApiError = (error: unknown, fallbackMessage: string): ApiError => {
  const candidate = error && typeof error === "object" ? (error as Partial<ApiError>) : {};
  return {
    status: typeof candidate.status === "number" ? candidate.status : 500,
    code: typeof candidate.code === "string" ? candidate.code : "UNKNOWN",
    message: typeof candidate.message === "string" ? candidate.message : fallbackMessage,
    requestId: typeof candidate.requestId === "string" ? candidate.requestId : "server",
    ...(candidate.details ? { details: candidate.details } : {}),
  };
};
