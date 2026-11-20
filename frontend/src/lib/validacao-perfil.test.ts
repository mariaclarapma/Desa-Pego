import { describe, expect, it } from "vitest";
import { mesmoEmail, validarPerfil, validarTrocaSenha } from "./validacao-perfil";

describe("validarPerfil", () => {
  it("aceita nome e e-mail válidos sem pedir senha quando o e-mail não muda", () => {
    expect(validarPerfil({ nome: "Ana Souza", email: "ANA@exemplo.com", senhaAtual: "" }, "ana@exemplo.com")).toEqual({});
  });

  it("usa as mesmas regras do cadastro", () => {
    expect(validarPerfil({ nome: "Ana", email: "ana@", senhaAtual: "" }, "ana@exemplo.com")).toEqual({
      nome: "informe nome e sobrenome.",
      email: expect.stringContaining("formato"),
      senhaAtual: expect.stringContaining("senha atual"),
    });
  });

  it("pede a senha atual para trocar o e-mail", () => {
    const sem = validarPerfil({ nome: "Ana Souza", email: "nova@exemplo.com", senhaAtual: "" }, "ana@exemplo.com");
    expect(sem.senhaAtual).toBe("para trocar o e-mail, confirme sua senha atual.");
    expect(validarPerfil({ nome: "Ana Souza", email: "nova@exemplo.com", senhaAtual: "x" }, "ana@exemplo.com")).toEqual({});
  });
});

describe("validarTrocaSenha", () => {
  it("exige senha atual, nova senha forte e confirmação igual", () => {
    expect(validarTrocaSenha({ senhaAtual: "", novaSenha: "curta", confirmarSenha: "outra" })).toEqual({
      senhaAtual: "informe sua senha atual.",
      novaSenha: expect.stringContaining("8 caracteres"),
      confirmarSenha: "as senhas não são iguais.",
    });
  });

  it("recusa nova senha igual à atual", () => {
    expect(validarTrocaSenha({ senhaAtual: "garimpo123", novaSenha: "garimpo123", confirmarSenha: "garimpo123" }).novaSenha).toBe(
      "a nova senha precisa ser diferente da atual.",
    );
  });

  it("aceita uma troca válida", () => {
    expect(validarTrocaSenha({ senhaAtual: "garimpo123", novaSenha: "novaSenha456", confirmarSenha: "novaSenha456" })).toEqual({});
  });
});

it("mesmoEmail ignora maiúsculas e espaços", () => {
  expect(mesmoEmail(" Ana@Exemplo.com ", "ana@exemplo.com")).toBe(true);
});
