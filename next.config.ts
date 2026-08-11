import type { NextConfig } from "next";
import path from "path";

const config: NextConfig = {
  reactStrictMode: true,
  // Allow LAN-IP access in dev so Next doesn't block its own _next/HMR resources
  // as cross-origin (which breaks client hydration when not served from localhost).
  allowedDevOrigins: [
    "192.168.1.39",
    "ride.local",
    "vendor.local",
    "ride.192.168.1.39.nip.io",
    "vendor.192.168.1.39.nip.io",
    "localhost",
    "127.0.0.1",
  ],
  eslint: { ignoreDuringBuilds: true },
  skipTrailingSlashRedirect: true,
  devIndicators: false,
  webpack(webpackConfig) {
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      "@tanstack/react-query": path.resolve(__dirname, "node_modules/@tanstack/react-query"),
    };
    return webpackConfig;
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${process.env.API_ORIGIN ?? "http://localhost:8000"}/api/:path*`,
        },
        {
          source: "/vendor/_next/:path*",
          destination: "http://localhost:3001/vendor/_next/:path*",
          basePath: false,
        },
        {
          source: "/vendor",
          destination: "http://localhost:3001/vendor",
          basePath: false,
        },
        {
          source: "/vendor/:path*",
          destination: "http://localhost:3001/vendor/:path*",
          basePath: false,
        },
        {
          source: "/ops/_next/:path*",
          destination: "http://localhost:3002/ops/_next/:path*",
          basePath: false,
        },
        {
          source: "/ops",
          destination: "http://localhost:3002/ops",
          basePath: false,
        },
        {
          source: "/ops/:path*",
          destination: "http://localhost:3002/ops/:path*",
          basePath: false,
        },
      ],
    };
  },
};

export default config;
