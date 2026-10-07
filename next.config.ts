import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force Turbopack to use this repository as its workspace root. This avoids
  // parent-folder package-lock files making local development serve the wrong app.
  turbopack: { root: process.cwd() },

  // The database driver ships native code and must not be bundled.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Do not advertise the framework in response headers.
  poweredByHeader: false,
  // Search text and locations travel in POST bodies, so there is nothing for
  // the framework to log, but keep request logging quiet anyway.
  logging: { incomingRequests: false },
  // Hide the floating development badge so it does not cover the tab bar in a demo.
  devIndicators: false,
};

export default nextConfig;
