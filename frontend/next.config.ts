import { resolve } from "node:path";
import type { NextConfig } from "next";

// .env da raiz do repositório (o mesmo do backend), se existir. Na hospedagem, vem do painel.
try {
  process.loadEnvFile(resolve(process.cwd(), "..", ".env"));
} catch {
  // sem .env: segue com as variáveis do ambiente
}

const producao = process.env.NODE_ENV === "production";

/**
 * Content Security Policy: de onde a página pode carregar cada tipo de recurso.
 * - VLibras (tradutor de Libras do governo federal) carrega script, estilo, imagens e um
 *   módulo WebAssembly de vlibras.gov.br.
 * - ViaCEP preenche o endereço no checkout; fotos de demonstração vêm do Unsplash.
 * - 'unsafe-inline' em script/estilo: o Next.js injeta scripts e estilos inline na página
 *   (usar nonce exigiria renderizar tudo dinamicamente). Em desenvolvimento, o recarregamento
 *   automático precisa de 'unsafe-eval' e de WebSocket.
 */
const VLIBRAS = "https://vlibras.gov.br https://*.vlibras.gov.br";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${producao ? "" : "'unsafe-eval'"} ${VLIBRAS}`,
  `style-src 'self' 'unsafe-inline' ${VLIBRAS}`,
  `img-src 'self' data: blob: https://images.unsplash.com ${VLIBRAS}`,
  `font-src 'self' data: ${VLIBRAS}`,
  `connect-src 'self' https://viacep.com.br ${VLIBRAS} ${producao ? "" : "ws: wss:"}`,
  `media-src 'self' blob: ${VLIBRAS}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(producao ? ["upgrade-insecure-requests"] : []),
]
  .map((d) => d.replace(/\s+/g, " ").trim())
  .join("; ");

const cabecalhosSeguranca = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS só em produção (HTTPS); em localhost atrapalharia o desenvolvimento
  ...(producao ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // não anuncia "x-powered-by: Next.js"
  poweredByHeader: false,
  // o indicador do modo dev fica à direita para não cobrir a barra de acessibilidade
  devIndicators: { position: "bottom-right" },
  async headers() {
    return [{ source: "/:caminho*", headers: cabecalhosSeguranca }];
  },
  // as chamadas passam por /api na mesma origem: assim o refresh token do serviço de contas
  // fica num cookie httpOnly "first-party" e o navegador não precisa de CORS
  async rewrites() {
    const catalogo = process.env.CATALOGO_API_URL ?? "http://localhost:3001";
    const contas = process.env.CONTAS_API_URL ?? "http://localhost:3002";
    return [
      { source: "/api/auth/:caminho*", destination: `${contas}/auth/:caminho*` },
      // inclui /api/integracao/*: sistemas parceiros chegam por aqui, protegidos pela X-API-Key
      { source: "/api/:caminho*", destination: `${catalogo}/:caminho*` },
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
