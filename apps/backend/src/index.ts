import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { initSentry } from "./config/sentry.js";

const env = loadEnv();
initSentry(env);

const app = buildApp({ env });

const port = Number(process.env["PORT"] ?? env.PORT);
app.listen(port, () => {
  console.info(`[muga-backend] listening on :${port} (env=${env.NODE_ENV})`);
});
