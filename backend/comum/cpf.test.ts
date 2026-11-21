import { describe, expect, it } from "vitest";
import { ERRO_CPF_INVALIDO, ERRO_CPF_TAMANHO, ERRO_CPF_VAZIO, cpfValido, validarCpf } from "./cpf.js";

describe("validarCpf (Req. 001)", () => {
  it("aceita CPF válido com ou sem pontuação e devolve só os dígitos", () => {
    expect(validarCpf("529.982.247-25")).toEqual({ ok: true, cpf: "52998224725" });
    expect(validarCpf("52998224725")).toEqual({ ok: true, cpf: "52998224725" });
    expect(validarCpf("  111.444.777-35 ")).toEqual({ ok: true, cpf: "11144477735" });
    // dígito verificador que dá resto 10 vira 0
    expect(cpfValido("98765432100")).toBe(true);
  });

  it("recusa quantidade errada de dígitos", () => {
    expect(validarCpf("529.982.247-2")).toEqual({ ok: false, erro: ERRO_CPF_TAMANHO });
    expect(validarCpf("5299822472")).toEqual({ ok: false, erro: ERRO_CPF_TAMANHO });
    expect(validarCpf("529982247255")).toEqual({ ok: false, erro: ERRO_CPF_TAMANHO });
    expect(validarCpf("123")).toEqual({ ok: false, erro: ERRO_CPF_TAMANHO });
  });

  it("recusa dígitos verificadores errados", () => {
    expect(validarCpf("529.982.247-24")).toEqual({ ok: false, erro: ERRO_CPF_INVALIDO }); // 2º DV
    expect(validarCpf("529.982.247-15")).toEqual({ ok: false, erro: ERRO_CPF_INVALIDO }); // 1º DV
    expect(validarCpf("12345678900")).toEqual({ ok: false, erro: ERRO_CPF_INVALIDO });
  });

  it("recusa sequências repetidas, letras e símbolos", () => {
    for (const d of "0123456789") expect(cpfValido(d.repeat(11))).toBe(false);
    expect(validarCpf("529a982b247c25")).toEqual({ ok: false, erro: ERRO_CPF_INVALIDO });
    expect(validarCpf("529/982/247+25")).toEqual({ ok: false, erro: ERRO_CPF_INVALIDO });
    expect(validarCpf("5".repeat(200))).toEqual({ ok: false, erro: ERRO_CPF_INVALIDO });
  });

  it("recusa vazio ou tipo errado", () => {
    expect(validarCpf("")).toEqual({ ok: false, erro: ERRO_CPF_VAZIO });
    expect(validarCpf("   ")).toEqual({ ok: false, erro: ERRO_CPF_VAZIO });
    expect(validarCpf(undefined)).toEqual({ ok: false, erro: ERRO_CPF_VAZIO });
    expect(validarCpf(52998224725)).toEqual({ ok: false, erro: ERRO_CPF_VAZIO });
  });

  it("as mensagens de erro nunca repetem o valor digitado", () => {
    for (const entrada of ["529.982.247-24", "5299822", "111.111.111-11"]) {
      const r = validarCpf(entrada);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).not.toMatch(/\d{3}/);
    }
  });
});
