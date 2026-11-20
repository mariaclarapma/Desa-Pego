import { describe, expect, it } from "vitest";
import { validarCampo, validarConta, type DadosConta } from "./validacao-conta";

const ok: DadosConta = { nome: "Ana Souza", email: "ana@exemplo.com", senha: "garimpo123", confirmarSenha: "garimpo123" };

describe("validarConta", () => {
  it("aceita dados válidos nos dois modos", () => {
    expect(validarConta(ok, "entrar")).toEqual({});
    expect(validarConta(ok, "cadastro")).toEqual({});
  });

  it("no login, só exige e-mail válido e senha preenchida", () => {
    expect(validarConta({ ...ok, nome: "", senha: "1", confirmarSenha: "" }, "entrar")).toEqual({});
    expect(validarConta({ ...ok, email: "ana@", senha: "" }, "entrar")).toEqual({
      email: expect.stringContaining("formato"),
      senha: "informe sua senha.",
    });
  });

  it("no cadastro, exige nome e sobrenome", () => {
    expect(validarCampo("nome", { ...ok, nome: "Ana" }, "cadastro")).toBe("informe nome e sobrenome.");
    expect(validarCampo("nome", { ...ok, nome: "Ana 123" }, "cadastro")).toBe("use só letras no nome.");
    expect(validarCampo("nome", { ...ok, nome: "Maria da Conceição D'Ávila" }, "cadastro")).toBeUndefined();
  });

  it("no cadastro, exige senha forte e confirmação igual", () => {
    expect(validarCampo("senha", { ...ok, senha: "abc12" }, "cadastro")).toMatch(/8 caracteres/);
    expect(validarCampo("senha", { ...ok, senha: "somenteletras" }, "cadastro")).toMatch(/letra e um número/);
    expect(validarCampo("confirmarSenha", { ...ok, confirmarSenha: "outra123" }, "cadastro")).toBe("as senhas não são iguais.");
  });
});
