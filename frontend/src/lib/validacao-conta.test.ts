import { describe, expect, it } from "vitest";
import { erroCpf, mascararCpf, soDigitosCpf, validarCampo, validarConta, type DadosConta } from "./validacao-conta";

const ok: DadosConta = { nome: "Ana Souza", email: "ana@exemplo.com", cpf: "529.982.247-25", senha: "garimpo123", confirmarSenha: "garimpo123" };

describe("validarConta", () => {
  it("aceita dados válidos nos dois modos", () => {
    expect(validarConta(ok, "entrar")).toEqual({});
    expect(validarConta(ok, "cadastro")).toEqual({});
  });

  it("no login, só exige e-mail válido e senha preenchida", () => {
    expect(validarConta({ ...ok, nome: "", cpf: "", senha: "1", confirmarSenha: "" }, "entrar")).toEqual({});
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

  it("no cadastro, exige CPF válido (Req. 001)", () => {
    expect(validarCampo("cpf", { ...ok, cpf: "" }, "cadastro")).toBe("informe seu CPF.");
    expect(validarCampo("cpf", { ...ok, cpf: "529.982.247-2" }, "cadastro")).toBe("o CPF precisa ter 11 dígitos.");
    expect(validarCampo("cpf", { ...ok, cpf: "529.982.247-24" }, "cadastro")).toBe("CPF inválido. confira os números.");
    expect(validarCampo("cpf", { ...ok, cpf: "111.111.111-11" }, "cadastro")).toBe("CPF inválido. confira os números.");
    expect(validarCampo("cpf", { ...ok, cpf: "52998224725" }, "cadastro")).toBeUndefined();
    expect(validarCampo("cpf", { ...ok, cpf: "98765432100" }, "cadastro")).toBeUndefined();
    expect(erroCpf("529a982b247")).toBe("CPF inválido. confira os números.");
  });
});

describe("máscara do CPF", () => {
  it("formata enquanto digita e ao colar", () => {
    expect(mascararCpf("5")).toBe("5");
    expect(mascararCpf("5299")).toBe("529.9");
    expect(mascararCpf("5299822")).toBe("529.982.2");
    expect(mascararCpf("529982247")).toBe("529.982.247");
    expect(mascararCpf("5299822472")).toBe("529.982.247-2");
    expect(mascararCpf("52998224725")).toBe("529.982.247-25");
    expect(mascararCpf("529.982.247-25")).toBe("529.982.247-25");
  });

  it("ignora letras e corta no 11º dígito", () => {
    expect(mascararCpf("529abc98224725999")).toBe("529.982.247-25");
    expect(soDigitosCpf("529.982.247-25")).toBe("52998224725");
  });
});
