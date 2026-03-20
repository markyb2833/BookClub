import type { NextConfig } from "next";

const remotePatterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [
  {
    protocol: "https",
    hostname: "covers.openlibrary.org",
    pathname: "/**",
  },
];

if (process.env.S3_IMAGE_HOSTNAME) {
  remotePatterns.push({
    protocol: "https",
    hostname: process.env.S3_IMAGE_HOSTNAME,
    pathname: "/**",
  });
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
