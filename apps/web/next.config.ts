import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // fotos temporárias de demonstração (Unsplash); sai quando as fotos vierem do S3/CDN
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
