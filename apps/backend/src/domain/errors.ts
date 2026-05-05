/**
 * MUGA error envelope.
 * Every API error response uses this shape.
 */
export type ErrorEnvelope = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
};

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export const Errors = {
  unauthenticated: (msg = "Authentication required") => new AppError(401, "UNAUTHENTICATED", msg),
  forbidden: (msg = "Insufficient permissions") => new AppError(403, "FORBIDDEN", msg),
  notFound: (resource: string) => new AppError(404, "NOT_FOUND", `${resource} not found`),
  validation: (details: Record<string, unknown>) =>
    new AppError(400, "VALIDATION_ERROR", "Invalid request payload", details),
  conflict: (msg: string, details?: Record<string, unknown>) =>
    new AppError(409, "CONFLICT", msg, details),
  artistNotFound: (artistId: string) =>
    new AppError(422, "ARTIST_NOT_FOUND", "Artist not found", { artistId }),
  artistNotPublished: (artistId: string) =>
    new AppError(422, "ARTIST_NOT_PUBLISHED", "Artist is not published", { artistId }),
  internal: (msg = "Internal server error") => new AppError(500, "INTERNAL", msg),
};
