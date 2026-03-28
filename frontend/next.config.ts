import type { NextConfig } from "next";

const backendBaseUrl = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8002";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
