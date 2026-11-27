/**
 * Compressão das fotos do anúncio no navegador, antes do envio. Foto de celular costuma ter de 3 a
 * 5 MB; reduzida para no máximo 1600 px no lado maior e salva em WebP (ou JPEG, onde o navegador
 * não gera WebP), fica com algumas centenas de KB sem diferença visível na vitrine. Assim o
 * servidor não gasta memória redimensionando, a vitrine abre mais rápido e o tráfego do
 * armazenamento rende mais. Regravar a imagem também apaga os metadados EXIF (como a localização
 * do GPS que o celular grava na foto).
 *
 * Se algo falhar (navegador sem canvas, arquivo que não abre), a foto original segue como está:
 * a compressão nunca impede o envio.
 */

export const LADO_MAXIMO_PX = 1600;
export const QUALIDADE = 0.82;

export interface Dimensoes {
  largura: number;
  altura: number;
}

/** Reduz mantendo a proporção, só quando o lado maior passa do limite (nunca amplia). */
export function calcularDimensoes({ largura, altura }: Dimensoes, ladoMaximo = LADO_MAXIMO_PX): Dimensoes {
  const escala = Math.min(1, ladoMaximo / Math.max(largura, altura));
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}

/** Troca a extensão do nome para a do novo formato ("praia.HEIC.jpg" → "praia.HEIC.webp"). */
export function nomeComExtensao(nome: string, tipo: string) {
  const extensao = tipo === "image/webp" ? "webp" : "jpg";
  const base = nome.replace(/\.[^./\\]+$/, "") || "foto";
  return `${base}.${extensao}`;
}

export interface Imagem extends Dimensoes {
  /** Desenha a imagem num canvas do tamanho pedido e devolve o arquivo no tipo pedido (ou null). */
  codificar: (destino: Dimensoes, tipo: string, qualidade: number) => Promise<Blob | null>;
  liberar: () => void;
}

export type Decodificar = (arquivo: File) => Promise<Imagem>;

/** Implementação do navegador: createImageBitmap (respeita a rotação do EXIF) + canvas. */
export const decodificarNoNavegador: Decodificar = async (arquivo) => {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  return {
    largura: bitmap.width,
    altura: bitmap.height,
    codificar: ({ largura, altura }, tipo, qualidade) => {
      const canvas = document.createElement("canvas");
      canvas.width = largura;
      canvas.height = altura;
      const contexto = canvas.getContext("2d");
      if (!contexto) return Promise.resolve(null);
      // fundo branco: PNG com transparência viraria preto em JPEG
      contexto.fillStyle = "#fff";
      contexto.fillRect(0, 0, largura, altura);
      contexto.imageSmoothingQuality = "high";
      contexto.drawImage(bitmap, 0, 0, largura, altura);
      return new Promise((resolver) => canvas.toBlob(resolver, tipo, qualidade));
    },
    liberar: () => bitmap.close(),
  };
};

/** Devolve a foto comprimida, ou a original se a compressão não ajudar ou não for possível. */
export async function comprimirFoto(arquivo: File, decodificar: Decodificar = decodificarNoNavegador): Promise<File> {
  let imagem: Imagem;
  try {
    imagem = await decodificar(arquivo);
  } catch {
    return arquivo;
  }
  try {
    const destino = calcularDimensoes(imagem);
    const reduziu = destino.largura < imagem.largura;
    // o Safari não gera WebP pelo canvas: ele devolve PNG, e aí vamos de JPEG
    let blob = await imagem.codificar(destino, "image/webp", QUALIDADE);
    if (blob?.type !== "image/webp") blob = await imagem.codificar(destino, "image/jpeg", QUALIDADE);
    if (!blob || (blob.type !== "image/webp" && blob.type !== "image/jpeg")) return arquivo;
    // sem redução de tamanho e sem ganho de peso, a original é melhor
    if (!reduziu && blob.size >= arquivo.size) return arquivo;
    return new File([blob], nomeComExtensao(arquivo.name, blob.type), { type: blob.type, lastModified: arquivo.lastModified });
  } catch {
    return arquivo;
  } finally {
    imagem.liberar();
  }
}
