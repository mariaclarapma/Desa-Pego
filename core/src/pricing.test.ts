import { describe, expect, it } from "vitest";
import { calcularRepasse, dividirValor, simularGanho, validarPreco } from "./pricing";

// Percentuais de TESTE (a configuração real vem do painel do admin). Limites do admin: comissão até 50%, taxa até 10%.
const TAXAS = { comissaoPontosBase: 1000, taxaPixPontosBase: 99 }; // 10% e 0,99%

/** A conta que o serviço de pedidos fazia antes de usar calcularRepasse (backend/pedidos/src/app.ts). */
function formulaAntigaDaCarteira(subtotal: number, frete: number, comissao: number, taxaPix: number) {
  const divisao = dividirValor(subtotal, comissao);
  const taxaPixCentavos = dividirValor(subtotal + frete, taxaPix).comissaoCentavos;
  return { comissao: divisao.comissaoCentavos, taxaPix: taxaPixCentavos, vendedora: divisao.vendedoraCentavos + frete - taxaPixCentavos };
}

describe("calcularRepasse (regra da carteira, Req. 014)", () => {
  it("comissão só sobre as peças, taxa do Pix sobre peças + frete, frete fica com a vendedora", () => {
    // R$ 100 de peças + R$ 19,90 de frete: comissão 10% de 100 = 10,00; Pix 0,99% de 119,90 = 1,187 → 1,19
    expect(calcularRepasse(10_000, 1_990, TAXAS)).toEqual({
      subtotalCentavos: 10_000,
      freteCentavos: 1_990,
      totalCentavos: 11_990,
      comissaoCentavos: 1_000,
      taxaPixCentavos: 119,
      vendedoraCentavos: 10_871, // 10.000 − 1.000 + 1.990 − 119
    });
  });

  it("dá exatamente o mesmo resultado que a fórmula que a carteira usava", () => {
    const divergencias: string[] = [];
    for (const comissao of [0, 1000, 1250, 3333, 5000]) {
      for (const taxaPix of [0, 49, 99, 500, 1000]) {
        for (const frete of [0, 990, 1990, 2501]) {
          for (let subtotal = 1; subtotal <= 20_000; subtotal += 37) {
            const novo = calcularRepasse(subtotal, frete, { comissaoPontosBase: comissao, taxaPixPontosBase: taxaPix });
            const antigo = formulaAntigaDaCarteira(subtotal, frete, comissao, taxaPix);
            if (novo.comissaoCentavos !== antigo.comissao || novo.taxaPixCentavos !== antigo.taxaPix || novo.vendedoraCentavos !== antigo.vendedora) {
              divergencias.push(`${subtotal}+${frete} a ${comissao}/${taxaPix}`);
            }
          }
        }
      }
    }
    expect(divergencias).toEqual([]);
  });

  it("não tem diferença de centavo: comissão + taxa do Pix + vendedora = o que a compradora paga", () => {
    for (const frete of [0, 1990]) {
      for (let subtotal = 1; subtotal <= 10_000; subtotal++) {
        const r = calcularRepasse(subtotal, frete, { comissaoPontosBase: 5000, taxaPixPontosBase: 1000 });
        expect(r.comissaoCentavos + r.taxaPixCentavos + r.vendedoraCentavos).toBe(r.totalCentavos);
        expect(r.vendedoraCentavos).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("recusa frete negativo ou quebrado", () => {
    expect(() => calcularRepasse(1000, -1, TAXAS)).toThrow("frete");
    expect(() => calcularRepasse(1000, 9.9, TAXAS)).toThrow("frete");
  });
});

describe("simularGanho (simulador do anúncio, Req. 005)", () => {
  it("é a conta da carteira para a peça vendida sozinha", () => {
    expect(simularGanho(8_990, 1_990, TAXAS)).toEqual(calcularRepasse(8_990, 1_990, TAXAS));
  });

  it("recusa preço zero, negativo e quebrado", () => {
    expect(() => simularGanho(0, 1_990, TAXAS)).toThrow("maior que zero");
    expect(() => simularGanho(-500, 1_990, TAXAS)).toThrow("maior que zero");
    expect(() => simularGanho(89.9, 1_990, TAXAS)).toThrow("centavos inteiros");
    expect(validarPreco("8990")).toMatch(/centavos inteiros/);
    expect(validarPreco(8990)).toBeNull();
  });
});
