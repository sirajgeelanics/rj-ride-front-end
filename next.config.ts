import type { NextConfig } from "next";
import path from "path";

const config: NextConfig = {
  reactStrictMode: true,
  // A stray package-lock.json in the home folder made Next guess the wrong workspace root.
  outputFileTracingRoot: path.resolve(__dirname),
  // The Django API client appends trailing slashes; middleware.ts proxies /api/* to Django.
  skipTrailingSlashRedirect: true,
  devIndicators: false,
  // Allow the dev server to be opened by LAN IP as well as localhost.
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.28", "192.168.1.39"],
};

export default config;
