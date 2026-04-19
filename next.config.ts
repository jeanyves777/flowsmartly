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
