import { describe, expect, it } from "vitest";
import { centavosParaCampo, reaisParaCentavos } from "./preco";

describe("reaisParaCentavos", () => {
  it("entende os jeitos comuns de digitar preço", () => {
    expect(reaisParaCentavos("89,90")).toBe(8990);
    expect(reaisParaCentavos("89,9")).toBe(8990);
    expect(reaisParaCentavos("89.90")).toBe(8990);
    expect(reaisParaCentavos("R$ 89")).toBe(8900);
    expect(reaisParaCentavos("1.250,00")).toBe(125000);
  });

  it("devolve zero e negativo como são (quem recusa é a validação) e null para texto inválido", () => {
    expect(reaisParaCentavos("0")).toBe(0);
    expect(reaisParaCentavos("-10")).toBe(-1000);
    expect(reaisParaCentavos("")).toBeNull();
    expect(reaisParaCentavos("89,999")).toBeNull();
    expect(reaisParaCentavos("noventa")).toBeNull();
    expect(centavosParaCampo(8990)).toBe("89,90");
  });
});
