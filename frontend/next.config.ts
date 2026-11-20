import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // o indicador do modo dev fica à direita para não cobrir a barra de acessibilidade
  devIndicators: { position: "bottom-right" },
  // as chamadas passam por /api na mesma origem: assim o refresh token do serviço de contas
  // fica num cookie httpOnly "first-party" e o navegador não bloqueia a chamada por CORS
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const contas = process.env.CONTAS_API_URL ?? "http://localhost:3002";
    return [
      { source: "/api/auth/:caminho*", destination: `${contas}/auth/:caminho*` },
      { source: "/api/:caminho*", destination: `${api}/:caminho*` },
    ];
  },
  images: {
    remotePatterns: [
      // fotos temporárias de demonstração (Unsplash); sai quando as fotos vierem do S3/CDN
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
