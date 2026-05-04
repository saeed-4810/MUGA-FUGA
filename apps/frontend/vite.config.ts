import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: env.VITE_API_URL ?? "http://localhost:3001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    build: {
      sourcemap: true,
      target: "es2022",
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: ["firebase/app", "firebase/auth"],
            i18n: [
              "i18next",
              "react-i18next",
              "i18next-browser-languagedetector",
              "i18next-http-backend",
            ],
            sentry: ["@sentry/react"],
          },
        },
      },
    },
  };
});
