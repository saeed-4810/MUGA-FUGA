/**
 * Express Request augmentation.
 *
 * Adds `req.user` (authenticated principal) and `req.requestId` (per-request
 * correlation id) to the Express `Request` interface.
 *
 * We use the global `Express` namespace (the Express-recommended augmentation
 * point) rather than `declare module "express-serve-static-core"` so the
 * augmentation resolves without the backend needing a direct dependency on
 * `@types/express-serve-static-core`.
 *
 * See:
 *   - src/domain/auth.ts → AuthUser schema + type
 *   - src/middleware/auth.ts → sets req.user
 *   - src/middleware/requestId.ts → sets req.requestId
 */
import type { AuthUser } from "../domain/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

export {};
