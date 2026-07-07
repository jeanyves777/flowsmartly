import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // `next build` type-checks the WHOLE project in one tsc pass, which OOM'd the
  // VPS build ("Ineffective mark-compacts near heap limit") as the codebase grew,
  // taking the app process down with it. Types + lint are already enforced by the
  // CI gate (.github/workflows/ci.yml runs `tsc --noEmit`), so skip the redundant
  // in-build pass to keep the deploy build within the box's RAM.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Exclude reference stores, generated stores/sites, docker from compilation
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored : []),
        "**/reference-store/**",
        "**/generated-stores/**",
        "**/generated-sites/**",
        "**/stores-output/**",
        "**/sites-output/**",
        "**/docker/**",
      ],
    };
    return config;
  },

  serverExternalPackages: ["@napi-rs/canvas", "sharp"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    // Optimized remote images (e.g. HeyGen avatar thumbnails) are resized once
    // and kept in the server's image cache for a day even when the upstream CDN
    // sends no cache headers — asset URLs here are unique per asset, so long
    // retention is safe and every user after the first gets a local, tiny thumb.
    minimumCacheTTL: 86400,
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons", "date-fns"],
    serverActions: {
      bodySizeLimit: "500mb",
    },
    middlewareClientMaxBodySize: "500mb",
  },

  async redirects() {
    return [
      {
        source: "/cartoon-maker",
        destination: "/story-ad-movie",
        permanent: true,
      },
      // Legacy product marketing pages -> the agent-surface story they now live
      // under (see LEGACY_SURFACE_REDIRECTS in components/marketing/surfaces.ts).
      { source: "/flowshop", destination: "/surfaces/sell", permanent: true },
      { source: "/listsmartly-details", destination: "/surfaces/outreach", permanent: true },
      { source: "/view-to-earn", destination: "/surfaces/business", permanent: true },
      { source: "/marketplace", destination: "/surfaces/leads", permanent: true },
      // Legacy: ?view=automations used to switch the Strategy page into its
      // Automations sub-view. Content automation lives at /content/campaigns
      // now — handle at the HTTP layer so no client useEffect/router.replace
      // is involved (was causing an infinite render loop on some clients).
      {
        source: "/content/strategy",
        has: [{ type: "query", key: "view", value: "automations" }],
        destination: "/content/campaigns",
        permanent: false,
      },
      {
        source: "/strategy",
        has: [{ type: "query", key: "view", value: "automations" }],
        destination: "/content/campaigns",
        permanent: false,
      },
    ];
  },

  // API versioning — `/api/v1/*` aliases the current unversioned routes.
  // Frontend callers can migrate to `/api/v1/...` today. When a breaking
  // change is needed, a physical `/api/v2/` tree will host the new shape and
  // v1 will remain frozen as-is.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "/api/:path*",
      },
    ];
  },
};

export default nextConfig;
