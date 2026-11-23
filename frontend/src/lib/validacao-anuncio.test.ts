import { describe, expect, it } from "vitest";
import { validarAnuncio, type FormAnuncio } from "./validacao-anuncio";

const valido: FormAnuncio = { titulo: "Bolsa de palha", descricao: "Palha trançada.", categoria: "bolsas", tamanho: "único", marca: "", condicao: "otimo_estado", preco: "89,90" };

describe("validarAnuncio (Req. 006, no formulário)", () => {
  it("aceita anúncio válido (marca é opcional)", () => {
    expect(validarAnuncio(valido, 1)).toEqual({});
  });

  it("aponta cada campo obrigatório ausente", () => {
    const vazio = { titulo: "", descricao: "", categoria: "", tamanho: "", marca: "", condicao: "", preco: "" };
    expect(Object.keys(validarAnuncio(vazio, 1)).sort()).toEqual(["categoria", "condicao", "descricao", "preco", "tamanho", "titulo"]);
  });

  it("exige de 1 a 5 fotos e espera as que ainda estão subindo", () => {
    expect(validarAnuncio(valido, 0).fotos).toBe("envie pelo menos 1 foto.");
    expect(validarAnuncio(valido, 6).fotos).toBe("envie no máximo 5 fotos.");
    expect(validarAnuncio(valido, 1, 1).fotos).toMatch(/terminarem de subir/);
  });

  it("recusa preço zero, negativo e com mais de 2 casas, e categoria fora da moda", () => {
    expect(validarAnuncio({ ...valido, preco: "0" }, 1).preco).toMatch(/maior que zero/);
    expect(validarAnuncio({ ...valido, preco: "-5" }, 1).preco).toMatch(/maior que zero/);
    expect(validarAnuncio({ ...valido, preco: "9,999" }, 1).preco).toMatch(/2 casas/);
    expect(validarAnuncio({ ...valido, categoria: "eletronicos" }, 1).categoria).toBe("escolha uma categoria.");
  });
});
