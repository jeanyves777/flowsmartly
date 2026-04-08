import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Exclude reference stores, generated stores/sites from compilation
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
};

export default nextConfig;
