/**
 * ⚠️ DADOS DE DEMONSTRAÇÃO
 * Fotos temporárias do Unsplash (licença livre, sem atribuição obrigatória).
 * Para trocar uma imagem, altere apenas o ID aqui; para usar fotos próprias,
 * coloque o arquivo em /public e use o caminho local (ex.: "/home/hero.jpg").
 * O host está liberado em next.config.ts (images.remotePatterns).
 */
export function unsplash(id: string, largura = 1200): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${largura}&q=80`;
}

export const IMAGENS_HOME = {
  arara: {
    src: unsplash("1490481651871-ab68de25d43d"),
    alt: "Arara com blusas e camisas claras penduradas em cabides de madeira",
  },
} as const;
