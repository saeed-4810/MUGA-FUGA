const DEFAULT_LOCALES = "en,nl";
const DEFAULT_LOCALE = "en";

const publicEnv = {
  API_URL: process.env.NEXT_PUBLIC_API_URL,
  APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  SENTRY_TRACES_SAMPLE_RATE: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  SUPPORTED_LOCALES: process.env.NEXT_PUBLIC_SUPPORTED_LOCALES,
};

export type PublicEnvKey = keyof typeof publicEnv;

export const getPublicEnv = (key: PublicEnvKey): string | undefined => publicEnv[key];

export const getSupportedLocales = (
  configured: string | null | undefined = getPublicEnv("SUPPORTED_LOCALES")
): string[] => (configured ?? DEFAULT_LOCALES).split(",").map((locale) => locale.trim());

export const getDefaultLocale = (
  configured: string | null | undefined = getPublicEnv("DEFAULT_LOCALE")
): string => configured ?? DEFAULT_LOCALE;
