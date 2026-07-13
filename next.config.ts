import type { NextConfig } from "next";

/**
 * `output: "standalone"` bundles a minimal server + only the node_modules
 * actually used, so the production Docker image (see ./Dockerfile) doesn't
 * ship the whole node_modules tree. Vercel ignores this option and uses its
 * own build output — safe to leave on for both targets.
 */
const nextConfig: NextConfig = {
  output: "standalone",

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
