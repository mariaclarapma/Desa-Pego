import { describe, expect, it } from "vitest";
import { CONDICAO_LABEL, formatarPreco } from "./format";
import { catalogoUrl, pecaUrl } from "./routes";

// Intl usa espaço inseparável entre "R$" e o valor.
const normalizar = (s: string) => s.replace(/ /g, " ");

describe("formatarPreco", () => {
  it("formata centavos como reais", () => {
    expect(normalizar(formatarPreco(18990))).toBe("R$ 189,90");
    expect(normalizar(formatarPreco(5))).toBe("R$ 0,05");
    expect(normalizar(formatarPreco(123456))).toBe("R$ 1.234,56");
  });

  it("recusa valores que não são centavos inteiros", () => {
    expect(() => formatarPreco(19.9)).toThrow(TypeError);
  });
});

describe("selos de condição", () => {
  it("cobre os quatro selos padronizados do Req. 004", () => {
    expect(Object.values(CONDICAO_LABEL)).toEqual([
      "nova com etiqueta",
      "ótimo estado",
      "bom estado",
      "com marcas de uso",
    ]);
  });
});

describe("rotas", () => {
  it("monta a URL da vitrine com busca e filtros", () => {
    expect(catalogoUrl()).toBe("/catalogo");
    expect(catalogoUrl({ busca: "  saia jeans " })).toBe("/catalogo?busca=saia+jeans");
    expect(catalogoUrl({ categoria: "calcados", ordem: "recentes" })).toBe("/catalogo?categoria=calcados&ordem=recentes");
    expect(catalogoUrl({ busca: "   " })).toBe("/catalogo");
  });

  it("codifica o id na URL da peça", () => {
    expect(pecaUrl("abc 1")).toBe("/peca/abc%201");
  });
});
