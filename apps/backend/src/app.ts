import cors from "cors";
import express, { type Express, type Request } from "express";
import helmet from "helmet";
// pino-http ships a CJS module with a default export. Under NodeNext module
// resolution TS needs the namespace-with-.default form to resolve the call
// signature.
import * as pinoHttpNs from "pino-http";
import type { HttpLogger, Options } from "pino-http";

import { loadEnv, type Env } from "./config/env.js";
import { Sentry } from "./config/sentry.js";
import { emitAlert } from "./lib/alerting.js";
import { buildErrorHandler, notFoundHandler } from "./middleware/error.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { docsRouter } from "./routes/docs.js";
import { healthRouter } from "./routes/health.js";
import { meRouter } from "./routes/me.js";
import { productsRouter } from "./routes/products.js";

type PinoHttpFn = (opts?: Options) => HttpLogger;

export interface BuildAppOptions {
  env?: Env;
}

export const buildApp = (options: BuildAppOptions = {}): Express => {
  const env = options.env ?? loadEnv();
  const app = express();

  // Sentry request handler must be first
  if (env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    })
  );
  app.use(express.json({ limit: "256kb" }));
  app.use(requestIdMiddleware);
  const pinoHttp = (pinoHttpNs as unknown as { default: PinoHttpFn }).default;
  app.use(
    pinoHttp({
      level: env.LOG_LEVEL,
      customProps: ((req: Request) => ({
        requestId: req.requestId,
        userUid: req.user?.uid ?? null,
        userRole: req.user?.role ?? null,
      })) as unknown as Options["customProps"],
    })
  );

  // All routers mount under /api so Firebase Hosting's /api/** rewrite
  // forwards requests transparently. docsRouter already registers
  // /api/docs + /api/openapi.json internally (to match the openapi spec),
  // so it mounts at root to avoid /api/api/docs.
  app.use("/api", healthRouter(env));
  app.use(docsRouter());
  app.use("/api/me", meRouter(env));
  app.use("/api/products", productsRouter(env));

  app.use(notFoundHandler);
  app.use(
    buildErrorHandler(({ error, requestId, method, path }) => {
      void emitAlert(env, {
        kind: "unhandled_error",
        severity: "page",
        message: (error as Error)?.message ?? "unhandled error",
        context: { requestId, route: `${method} ${path}`, statusCode: 500 },
      });
    })
  );

  return app;
};
