import type { NextConfig } from "next";
import path from "path";

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  serverExternalPackages: [
    'dockerode',
    'ssh2',
    'docker-modem'
  ],
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    // Empty config to silence the warning, external packages are handled by serverExternalPackages
  }
} as NextConfig;

export default nextConfig;
