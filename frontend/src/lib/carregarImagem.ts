/**
 * Carregador de imagens do `next/image` (ver `images.loaderFile` em next.config.ts).
 *
 * Antes, toda foto passava pelo otimizador do Next no servidor do Render: ele baixava a foto,
 * redimensionava e só então entregava. No plano grátis (CPU fraca e 512 MB de memória) isso
 * levava até 6 s por foto quando várias chegavam juntas, e o cache se perdia a cada deploy ou
 * quando o serviço dormia. Agora o navegador busca cada foto direto de onde ela está:
 *
 * - Unsplash (fotos de demonstração): a CDN deles já redimensiona e escolhe o formato
 *   (`auto=format` entrega WebP ou AVIF), então pedimos a largura e a qualidade certas na URL.
 * - Fotos dos anúncios (Supabase Storage ou /api/fotos) e qualquer outra: vão como estão. Elas
 *   já chegam leves, porque são comprimidas no navegador antes do envio (comprimirFoto).
 */

export interface PedidoImagem {
  src: string;
  width: number;
  quality?: number;
}

export const QUALIDADE_PADRAO = 75;

const ehUnsplash = (url: URL) => url.protocol === "https:" && url.hostname === "images.unsplash.com";

export default function carregarImagem({ src, width, quality }: PedidoImagem): string {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src; // caminho relativo (/api/fotos/...): vai como está
  }
  if (!ehUnsplash(url)) return src;

  const p = url.searchParams;
  // com altura fixa (corte retrato 800x1000), a altura acompanha a largura para manter a proporção
  const larguraOriginal = Number(p.get("w"));
  const alturaOriginal = Number(p.get("h"));
  if (larguraOriginal > 0 && alturaOriginal > 0) p.set("h", String(Math.round((alturaOriginal * width) / larguraOriginal)));
  p.set("w", String(width));
  p.set("q", String(quality ?? QUALIDADE_PADRAO));
  if (!p.has("auto")) p.set("auto", "format");
  return url.toString();
}
