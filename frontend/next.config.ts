import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "path";

// Load env from monorepo root first, then local
const projectDir = process.cwd();
const rootDir = path.resolve(projectDir, "..");

// Load root .env files (they won't override existing vars)
loadEnvConfig(rootDir);

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {},
};

export default nextConfig;
