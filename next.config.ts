import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/traindle",
  assetPrefix: "/traindle/",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
