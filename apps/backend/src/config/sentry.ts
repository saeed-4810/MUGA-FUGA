import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

import type { Env } from "./env.js";

let initialized = false;

export const initSentry = (env: Env): void => {
  if (initialized) return;
  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    profilesSampleRate: env.SENTRY_PROFILES_SAMPLE_RATE,
  });

  initialized = true;
};

export { Sentry };
