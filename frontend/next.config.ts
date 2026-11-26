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
 * Fotos dos anúncios no Supabase Storage: lê SUPABASE_URL no build e libera só esse endereço (envio
 * direto do navegador e leitura das fotos publicadas). Sem a variável, nada é liberado.
 * O nome é conferido para não deixar entrar nada estranho na CSP.
 */
function enderecoSupabase(): URL | null {
  const valor = process.env.SUPABASE_URL?.trim();
  if (!valor) return null;
  const url = new URL(valor);
  if (url.protocol !== "https:" || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(url.hostname)) {
    throw new Error("SUPABASE_URL precisa ser um endereço HTTPS válido (ex.: https://<projeto>.supabase.co).");
  }
  return url;
}
const supabase = enderecoSupabase();

/**
 * Content Security Policy: de onde a página pode carregar cada tipo de recurso.
 * - VLibras (tradutor de Libras do governo federal) carrega script, estilo, imagens e um
 *   módulo WebAssembly de vlibras.gov.br.
 * - ViaCEP preenche o endereço no checkout; fotos de demonstração vêm do Unsplash.
 * - Supabase Storage (se configurado): o navegador envia as fotos (connect-src) e lê as publicadas.
 * - 'unsafe-inline' em script/estilo: o Next.js injeta scripts e estilos inline na página
 *   (usar nonce exigiria renderizar tudo dinamicamente). Em desenvolvimento, o recarregamento
 *   automático precisa de 'unsafe-eval' e de WebSocket.
 */
const VLIBRAS = "https://vlibras.gov.br https://*.vlibras.gov.br";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${producao ? "" : "'unsafe-eval'"} ${VLIBRAS}`,
  `style-src 'self' 'unsafe-inline' ${VLIBRAS}`,
  `img-src 'self' data: blob: https://images.unsplash.com ${supabase?.origin ?? ""} ${VLIBRAS}`,
  `font-src 'self' data: ${VLIBRAS}`,
  `connect-src 'self' https://viacep.com.br ${supabase?.origin ?? ""} ${VLIBRAS} ${producao ? "" : "ws: wss:"}`,
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

// `npm run cobertura`: build separado, com o código instrumentado pelo Istanbul para o Cypress
const cobertura = process.env.COBERTURA === "1";

const nextConfig: NextConfig = {
  // não anuncia "x-powered-by: Next.js"
  poweredByHeader: false,
  // app/core (cálculo do simulador e da carteira), em TypeScript, compartilhado com o backend
  transpilePackages: ["@desapego/core"],
  ...(cobertura && {
    distDir: ".next-cobertura",
    productionBrowserSourceMaps: true,
    webpack(config) {
      // depois do SWC (enforce: "post"), o babel-plugin-istanbul marca cada linha de src/;
      // o mapa de origem leva a cobertura de volta para os arquivos .ts/.tsx
      config.module.rules.push({
        test: /\.(ts|tsx|js|jsx)$/,
        include: [resolve(process.cwd(), "src")],
        exclude: [/\.test\.(ts|tsx)$/, /[\\/]src[\\/]test[\\/]/],
        enforce: "post",
        use: { loader: "babel-loader", options: { babelrc: false, configFile: false, sourceMaps: true, plugins: [["istanbul", { cwd: process.cwd(), include: ["src/**"], exclude: ["src/**/*.test.*", "src/test/**"] }]] } },
      });
      config.devtool = "source-map";
      return config;
    },
  }),
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
    const pedidos = process.env.PEDIDOS_API_URL ?? "http://localhost:3003";
    return [
      { source: "/api/auth/:caminho*", destination: `${contas}/auth/:caminho*` },
      // Módulo 05: pedidos, carteira e painel da administração
      { source: "/api/gestao/:caminho*", destination: `${pedidos}/:caminho*` },
      // inclui /api/integracao/*: sistemas parceiros chegam por aqui, protegidos pela X-API-Key
      { source: "/api/:caminho*", destination: `${catalogo}/:caminho*` },
    ];
  },
  images: {
    // a chave de cada foto nunca muda de conteúdo: guarda a versão otimizada por 30 dias e economiza
    // o tráfego do Supabase (5 GB por mês no plano gratuito)
    minimumCacheTTL: 30 * 24 * 60 * 60,
    remotePatterns: [
      // fotos de demonstração da semente (Unsplash)
      { protocol: "https", hostname: "images.unsplash.com" },
      // fotos publicadas dos anúncios: só o bucket público, no projeto do Supabase
      ...(supabase ? [{ protocol: "https" as const, hostname: supabase.hostname, pathname: "/storage/v1/object/public/anuncios-fotos/**" }] : []),
    ],
  },
};

export default nextConfig;
