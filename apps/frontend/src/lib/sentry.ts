import * as Sentry from "@sentry/react";

export const initSentry = (): void => {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const release = process.env.NEXT_PUBLIC_APP_VERSION;
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    ...(release ? { release } : {}),
  });
};

export { Sentry };
