import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

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
