import { describe, expect, it, vi } from "vitest";
import { calcularDimensoes, comprimirFoto, nomeComExtensao, type Decodificar, type Imagem } from "./comprimirFoto";

const arquivo = (bytes: number, nome = "jaqueta.jpg", tipo = "image/jpeg") => new File([new Uint8Array(bytes)], nome, { type: tipo });
const blob = (bytes: number, tipo: string) => new Blob([new Uint8Array(bytes)], { type: tipo });

/** Imagem falsa: devolve o blob que cada tipo "gera", como o canvas do navegador. */
function imagemFalsa(largura: number, altura: number, gera: Record<string, Blob | null>) {
  const imagem: Imagem = {
    largura,
    altura,
    codificar: vi.fn(async (_destino, tipo: string) => gera[tipo] ?? null),
    liberar: vi.fn(),
  };
  const decodificar: Decodificar = async () => imagem;
  return { imagem, decodificar };
}

describe("calcularDimensoes", () => {
  it("reduz o lado maior para 1600 px mantendo a proporção", () => {
    expect(calcularDimensoes({ largura: 4032, altura: 3024 })).toEqual({ largura: 1600, altura: 1200 });
    expect(calcularDimensoes({ largura: 3024, altura: 4032 })).toEqual({ largura: 1200, altura: 1600 });
  });

  it("nunca amplia uma foto pequena", () => {
    expect(calcularDimensoes({ largura: 800, altura: 600 })).toEqual({ largura: 800, altura: 600 });
  });
});

describe("nomeComExtensao", () => {
  it("troca a extensão pela do novo formato", () => {
    expect(nomeComExtensao("IMG_1234.JPG", "image/webp")).toBe("IMG_1234.webp");
    expect(nomeComExtensao("vestido.png", "image/jpeg")).toBe("vestido.jpg");
    expect(nomeComExtensao("sem-extensao", "image/webp")).toBe("sem-extensao.webp");
  });
});

describe("comprimirFoto", () => {
  it("foto grande de celular vira WebP de 1600 px, bem mais leve", async () => {
    const { imagem, decodificar } = imagemFalsa(4032, 3024, { "image/webp": blob(250_000, "image/webp") });
    const resultado = await comprimirFoto(arquivo(4_000_000, "IMG_1234.jpg"), decodificar);

    expect(resultado.type).toBe("image/webp");
    expect(resultado.name).toBe("IMG_1234.webp");
    expect(resultado.size).toBe(250_000);
    expect(imagem.codificar).toHaveBeenCalledWith({ largura: 1600, altura: 1200 }, "image/webp", 0.82);
    expect(imagem.liberar).toHaveBeenCalled();
  });

  it("onde o navegador não gera WebP (Safari devolve PNG), usa JPEG", async () => {
    const { decodificar } = imagemFalsa(4032, 3024, { "image/webp": blob(900_000, "image/png"), "image/jpeg": blob(300_000, "image/jpeg") });
    const resultado = await comprimirFoto(arquivo(4_000_000), decodificar);
    expect(resultado.type).toBe("image/jpeg");
    expect(resultado.size).toBe(300_000);
  });

  it("foto pequena que ficaria mais pesada continua a original", async () => {
    const original = arquivo(40_000);
    const { decodificar } = imagemFalsa(800, 600, { "image/webp": blob(60_000, "image/webp") });
    expect(await comprimirFoto(original, decodificar)).toBe(original);
  });

  it("se a imagem não abre, envia a original", async () => {
    const original = arquivo(1_000);
    expect(await comprimirFoto(original, async () => Promise.reject(new Error("formato desconhecido")))).toBe(original);
  });

  it("se o canvas não gera nada, envia a original e libera a imagem", async () => {
    const original = arquivo(4_000_000);
    const { imagem, decodificar } = imagemFalsa(4032, 3024, {});
    expect(await comprimirFoto(original, decodificar)).toBe(original);
    expect(imagem.liberar).toHaveBeenCalled();
  });
});
