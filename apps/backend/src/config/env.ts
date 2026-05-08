import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((s) =>
      s
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    ),

  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_STORAGE_BUCKET: z.string().min(1, "FIREBASE_STORAGE_BUCKET is required"),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional().default(""),

  INITIAL_ADMIN_EMAILS: z
    .string()
    .optional()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    ),

  EXPERIMENTAL_ROLE_SWITCH_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((value) => value === "true"),

  SENTRY_DSN: z.string().optional().default(""),
  SENTRY_ENVIRONMENT: z.string().default("development"),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  FIRESTORE_EMULATOR_HOST: z.string().optional().default(""),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional().default(""),
  FIREBASE_STORAGE_EMULATOR_HOST: z.string().optional().default(""),

  SLACK_WEBHOOK_URL: z.string().optional().default(""),
  PAGERDUTY_INTEGRATION_KEY: z.string().optional().default(""),
  ALERT_EMAIL_RECIPIENTS: z
    .string()
    .optional()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    ),
  ALERT_READY_LATENCY_BUDGET_MS: z.coerce.number().int().positive().default(2000),
});

export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
};
