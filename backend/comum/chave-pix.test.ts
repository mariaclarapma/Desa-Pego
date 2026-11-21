import { randomBytes } from "node:crypto";
import express from "express";
import { SignJWT } from "jose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { exigirChavePix, exigirLogin, podeAnunciar } from "./autenticacao.js";
import {
  cifrarChavePix,
  decifrarChavePix,
  lerChaveCripto,
  mascararChavePix,
  validarChavePix,
  type TipoChavePix,
} from "./chave-pix.js";

/** Req. 002: chave Pix validada por tipo, guardada cifrada e exibida mascarada. */

const CPF = "52998224725";
const ALEATORIA = "3f2a8b1c-4d5e-4f60-8a7b-9c0d1e2f9c1d";

describe("validação por tipo", () => {
  const casos: [TipoChavePix, string, string][] = [
    ["cpf", "529.982.247-25", CPF],
    ["cpf", " 52998224725 ", CPF],
    ["email", " Maria.Clara@Exemplo.COM ", "maria.clara@exemplo.com"],
    ["telefone", "(61) 91234-5678", "+5561912345678"],
    ["telefone", "+55 61 91234-5678", "+5561912345678"],
    ["telefone", "61912345678", "+5561912345678"],
    ["aleatoria", ALEATORIA.toUpperCase(), ALEATORIA],
  ];
  it.each(casos)("%s válido (%s) é normalizado", (tipo, entrada, normalizada) => {
    expect(validarChavePix(tipo, entrada)).toEqual({ ok: true, chave: normalizada });
  });

  const invalidas: [TipoChavePix, string][] = [
    ["cpf", "529.982.247-24"], // dígito verificador errado
    ["cpf", "111.111.111-11"], // sequência repetida
    ["cpf", "5299822472"], // 10 dígitos
    ["cpf", "529a982b247c25"],
    ["email", "maria@"],
    ["email", "maria exemplo.com"],
    ["email", `${"a".repeat(70)}@exemplo.com`], // passa de 77 caracteres
    ["telefone", "(61) 3123-4567"], // fixo: a chave Pix de telefone é celular
    ["telefone", "(01) 91234-5678"], // DDD inválido
    ["telefone", "91234-5678"], // sem DDD
    ["telefone", "maria@exemplo.com"],
    ["aleatoria", "3f2a8b1c4d5e4f608a7b9c0d1e2f9c1d"], // sem traços
    ["aleatoria", "não é uma chave"],
    ["email", "   "],
  ];
  it.each(invalidas)("%s inválido (%s) é recusado com mensagem", (tipo, entrada) => {
    const r = validarChavePix(tipo, entrada);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/\S/);
  });

  it("chave CPF usa a validação do cadastro (comum/cpf.ts, Req. 001): dígitos verificadores", () => {
    expect(validarChavePix("cpf", "111.444.777-35")).toEqual({ ok: true, chave: "11144477735" });
    expect(validarChavePix("cpf", "111.444.777-36").ok).toBe(false);
  });
});

describe("máscara", () => {
  it.each([
    ["cpf", CPF, "***.982.247-**"],
    ["email", "maria.clara@exemplo.com", "ma***@exemplo.com"],
    ["email", "ab@exemplo.com", "a***@exemplo.com"],
    ["telefone", "+5561912345678", "(61) *****-5678"],
    ["aleatoria", ALEATORIA, "3f2a****…****9c1d"],
  ] as [TipoChavePix, string, string][])("%s: %s → %s", (tipo, chave, mascarada) => {
    const m = mascararChavePix(tipo, chave);
    expect(m).toBe(mascarada);
    expect(m).not.toContain(chave);
  });
});

describe("criptografia (AES-256-GCM)", () => {
  const segredo = randomBytes(32);

  it("cifra e decifra; a cifra não contém a chave e muda a cada vez", () => {
    const a = cifrarChavePix(CPF, segredo, "conta-1");
    const b = cifrarChavePix(CPF, segredo, "conta-1");
    expect(a).not.toContain(CPF);
    expect(a).not.toBe(b);
    expect(decifrarChavePix(a, segredo, "conta-1")).toBe(CPF);
  });

  it("não abre com outra PIX_CRIPTO_CHAVE, em outra conta ou se a cifra for alterada", () => {
    const cifra = cifrarChavePix(CPF, segredo, "conta-1");
    expect(() => decifrarChavePix(cifra, randomBytes(32), "conta-1")).toThrow();
    expect(() => decifrarChavePix(cifra, segredo, "conta-2")).toThrow();
    const partes = cifra.split(".");
    partes[3] = Buffer.from("adulterada").toString("base64url");
    expect(() => decifrarChavePix(partes.join("."), segredo, "conta-1")).toThrow();
    expect(() => decifrarChavePix("texto-qualquer", segredo, "conta-1")).toThrow(/formato/);
  });

  it("etiqueta de autenticação fixa em 16 bytes: mais curta é recusada antes de decifrar", () => {
    const [versao, iv, tag, dados] = cifrarChavePix(CPF, segredo, "conta-1").split(".");
    expect(Buffer.from(tag, "base64url")).toHaveLength(16);
    for (const tamanho of [4, 8, 12, 15]) {
      const curta = Buffer.from(tag, "base64url").subarray(0, tamanho).toString("base64url");
      expect(() => decifrarChavePix([versao, iv, curta, dados].join("."), segredo, "conta-1")).toThrow(/formato/);
    }
    // IV de tamanho diferente de 12 bytes também é recusado
    expect(() => decifrarChavePix([versao, Buffer.alloc(16).toString("base64url"), tag, dados].join("."), segredo, "conta-1")).toThrow(/formato/);
  });

  it("PIX_CRIPTO_CHAVE: 32 bytes em base64; vazia vira null; outro tamanho é erro", () => {
    expect(lerChaveCripto(Buffer.alloc(32, 1).toString("base64"))).toEqual(Buffer.alloc(32, 1));
    expect(lerChaveCripto(Buffer.alloc(32, 1).toString("base64url"))).toEqual(Buffer.alloc(32, 1));
    expect(lerChaveCripto("")).toBeNull();
    expect(lerChaveCripto(undefined)).toBeNull();
    expect(() => lerChaveCripto(Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
  });
});

describe("regra para o Módulo 02: só quem tem chave Pix publica anúncio", () => {
  const segredo = new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres");
  const app = express();
  app.post("/anuncios", exigirLogin(segredo), exigirChavePix, (_req, res) => {
    res.status(201).json({ ok: true });
  });
  const token = (claims: Record<string, unknown>) =>
    new SignJWT({ nome: "Ana", perfil: "USUARIO", ...claims }).setProtectedHeader({ alg: "HS256" }).setSubject("ana").setExpirationTime("5m").sign(segredo);

  it("podeAnunciar só com temChavePix === true", () => {
    expect(podeAnunciar({ temChavePix: true })).toBe(true);
    expect(podeAnunciar({ temChavePix: false })).toBe(false);
    expect(podeAnunciar(undefined)).toBe(false);
  });

  it("sem chave: 403 com código; com chave: passa; sem login: 401", async () => {
    const sem = await request(app).post("/anuncios").set("Authorization", `Bearer ${await token({ temChavePix: false })}`).expect(403);
    expect(sem.body).toMatchObject({ codigo: "CHAVE_PIX_AUSENTE" });
    // token antigo, emitido antes do Req. 002 (sem o campo): conta como sem chave
    await request(app).post("/anuncios").set("Authorization", `Bearer ${await token({})}`).expect(403);
    await request(app).post("/anuncios").set("Authorization", `Bearer ${await token({ temChavePix: true })}`).expect(201);
    await request(app).post("/anuncios").expect(401);
  });
});
