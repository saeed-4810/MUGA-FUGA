import type { ApiError } from "@/lib/api";

export const formatCreateProductError = (
  error: unknown,
  fallback: string,
  withCode: (code: string) => string
): string => {
  if (!error || typeof error !== "object") return fallback;
  const candidate = error as Partial<ApiError> | Error;
  if ("code" in candidate && candidate.code) return withCode(candidate.code);
  return candidate.message || fallback;
};
