import { describe, expect, it } from "vitest";
import type { TipoChavePix } from "@/lib/api/contas";
import { cpfValido, erroChavePix, validarChavePix, validarVendedora } from "./validacao-vendedora";

/** Req. 002: as mesmas regras do backend (backend/comum/chave-pix.ts e contas/src/validacao.ts). */
describe("chave Pix por tipo", () => {
  it.each([
    ["cpf", "529.982.247-25"],
    ["cpf", "52998224725"],
    ["email", "Ana@Exemplo.com"],
    ["telefone", "(61) 91234-5678"],
    ["telefone", "+55 61 91234-5678"],
    ["aleatoria", "3F2A8B1C-4D5E-4F60-8A7B-9C0D1E2F9C1D"],
  ] as [TipoChavePix, string][])("%s válido: %s", (tipo, chave) => {
    expect(erroChavePix(tipo, chave)).toBeUndefined();
  });

  it.each([
    ["cpf", "529.982.247-24", /CPF inválido/],
    ["cpf", "000.000.000-00", /CPF inválido/],
    ["email", "ana@", /e-mail inválido/],
    ["telefone", "(61) 3123-4567", /celular/],
    ["telefone", "91234-5678", /DDD/],
    ["aleatoria", "3f2a8b1c4d5e4f608a7b9c0d1e2f9c1d", /traços/],
    ["cpf", "  ", /informe a chave/],
  ] as [TipoChavePix, string, RegExp][])("%s inválido: %s", (tipo, chave, mensagem) => {
    expect(erroChavePix(tipo, chave)).toMatch(mensagem);
  });

  it("CPF: dígitos verificadores", () => {
    expect(cpfValido("111.444.777-35")).toBe(true);
    expect(cpfValido("111.444.777-36")).toBe(false);
  });

  it("formulário: tipo, chave e senha atual são obrigatórios", () => {
    expect(validarChavePix({ tipo: "", chave: "", senhaAtual: "" })).toEqual({
      tipo: "escolha o tipo da chave.",
      senhaAtual: "informe sua senha atual.",
    });
    expect(validarChavePix({ tipo: "cpf", chave: "529.982.247-25", senhaAtual: "x" })).toEqual({});
  });
});

describe("perfil de vendedora", () => {
  it("nome público opcional; cidade obrigatória", () => {
    expect(validarVendedora({ nomePublico: "", cidade: "Brasília/DF" })).toEqual({});
    expect(validarVendedora({ nomePublico: "Brechó da Ana", cidade: "Rio de Janeiro - RJ" })).toEqual({});
    expect(validarVendedora({ nomePublico: "", cidade: " " })).toEqual({ cidade: "informe sua cidade." });
  });

  it("recusa nome curto, longo, com símbolos ou com CPF, e cidade com números", () => {
    expect(validarVendedora({ nomePublico: "A", cidade: "Recife" }).nomePublico).toMatch(/2 caracteres/);
    expect(validarVendedora({ nomePublico: "x".repeat(41), cidade: "Recife" }).nomePublico).toMatch(/40/);
    expect(validarVendedora({ nomePublico: "<b>Ana</b>", cidade: "Recife" }).nomePublico).toMatch(/só letras/);
    expect(validarVendedora({ nomePublico: "Ana 529.982.247-25", cidade: "Recife" }).nomePublico).toMatch(/CPF/);
    // CPF separado por espaços ou por outros caracteres
    for (const nome of ["Ana 529 982 247 25", "Ana 529-982 247.25", "5 2 9 9 8 2 2 4 7 2 5", "a5a2a9a9a8a2a2a4a7a2a5"]) {
      expect(validarVendedora({ nomePublico: nome, cidade: "Recife" }).nomePublico).toMatch(/CPF/);
    }
    // até 10 números ainda é nome
    expect(validarVendedora({ nomePublico: "Ana 12345 67890", cidade: "Recife" })).toEqual({});
    expect(validarVendedora({ nomePublico: "Ana", cidade: "Cidade 123" }).cidade).toMatch(/só letras/);
  });
});
