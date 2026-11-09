import type { NextConfig } from "next";

// Browser protections that do not depend on the deployed address (spec 003 FR-34, plan D17): no
// embedding in a frame of another site, no guessing of file types, and only the origin sent to other
// sites. Forcing HTTPS and restricting the content a page may load wait for the deployment (Phase 5).
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

// Every address except the three public resources, which the framework serves itself (kept equal to
// the matcher of `src/proxy.ts`, with the same path-segment boundary).
const ALL_ADDRESSES_EXCEPT_PUBLIC_RESOURCES = "/((?!_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$).*)";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: ALL_ADDRESSES_EXCEPT_PUBLIC_RESOURCES, headers: SECURITY_HEADERS }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
