import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(appDir, "../.."),
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: true,
  async rewrites() {
    const apiUrl = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
