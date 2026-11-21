import { describe, expect, it } from "vitest";
import { categoriaPermitida, CATEGORIAS } from "./categorias.js";
import { dividirValor, formatarPercentual } from "./dinheiro.js";

describe("dividirValor (Req. 015: divisão sem diferença de centavos)", () => {
  it.each([
    // [total, comissão em pontos-base, comissão esperada, vendedora esperada]
    [1001, 1000, 100, 901], // R$ 10,01 a 10%: 100,1 centavos → 100
    [3333, 1000, 333, 3000], // R$ 33,33 a 10%: 333,3 → 333
    [3333, 1500, 500, 2833], // R$ 33,33 a 15%: 499,95 → 500 (meio centavo sobe)
    [1001, 1250, 125, 876], // R$ 10,01 a 12,5%: 125,125 → 125
    [99, 3333, 33, 66], // R$ 0,99 a 33,33%: 32,99 → 33
    [18990, 1000, 1899, 17091],
    [1, 5000, 1, 0], // meio centavo sobe
    [0, 1000, 0, 0],
  ])("R$ %i centavos com %i pontos-base: comissão %i + vendedora %i", (total, pb, comissao, vendedora) => {
    const d = dividirValor(total, pb);
    expect(d).toEqual({ totalCentavos: total, comissaoCentavos: comissao, vendedoraCentavos: vendedora });
    expect(d.comissaoCentavos + d.vendedoraCentavos).toBe(total);
  });

  it("a soma das partes é igual ao total para todos os valores de R$ 0,00 a R$ 100,00 e várias comissões", () => {
    const erros: string[] = [];
    for (const pb of [0, 1, 999, 1000, 1234, 3333, 9999, 10_000]) {
      for (let total = 0; total <= 10_000; total++) {
        const d = dividirValor(total, pb);
        const ok =
          Number.isInteger(d.comissaoCentavos) && Number.isInteger(d.vendedoraCentavos) && d.vendedoraCentavos >= 0 && d.comissaoCentavos + d.vendedoraCentavos === total;
        if (!ok) erros.push(`${total} centavos a ${pb} pontos-base`);
      }
    }
    expect(erros).toEqual([]);
  });

  it("não aceita float, valor negativo nem comissão fora de 0% a 100%", () => {
    expect(() => dividirValor(10.5, 1000)).toThrow(RangeError);
    expect(() => dividirValor(-1, 1000)).toThrow(RangeError);
    expect(() => dividirValor(1000, 10.5)).toThrow(RangeError);
    expect(() => dividirValor(1000, 10_001)).toThrow(RangeError);
  });

  it("formata o percentual a partir dos pontos-base", () => {
    expect(formatarPercentual(1000)).toBe("10,00%");
    expect(formatarPercentual(1250)).toBe("12,50%");
    expect(formatarPercentual(5)).toBe("0,05%");
  });
});

describe("categorias permitidas (só moda)", () => {
  it("aceita roupas, calçados, bolsas e acessórios", () => {
    for (const { slug } of CATEGORIAS) expect(categoriaPermitida(slug)).toBe(true);
  });

  it("recusa categorias fora de moda e valores inválidos", () => {
    for (const fora of ["veiculos", "eletronicos", "imoveis", "Feminino", "", null, undefined, 3]) {
      expect(categoriaPermitida(fora)).toBe(false);
    }
  });
});
