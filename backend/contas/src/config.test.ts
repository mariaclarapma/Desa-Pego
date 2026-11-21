import { describe, expect, it } from "vitest";
import { lerConfig } from "./config.js";

const SEGREDO = "um-segredo-de-producao-com-mais-de-32-caracteres";
const ORIGENS = "https://desapego.onrender.com";
const CPF = { CPF_CRIPTO_CHAVE: "chave-de-cifra-do-cpf-com-mais-de-32-caracteres", CPF_HASH_CHAVE: "chave-de-hash-do-cpf-com-mais-de-32-caracteres" };

describe("lerConfig", () => {
  it("em produção exige JWT_SECRET forte e DATABASE_URL", () => {
    expect(() => lerConfig({ NODE_ENV: "production", CORS_ORIGENS: ORIGENS, DATABASE_URL: "postgresql://u:s@h/db" })).toThrow(/JWT_SECRET/);
    expect(() => lerConfig({ NODE_ENV: "production", CORS_ORIGENS: ORIGENS, JWT_SECRET: SEGREDO })).toThrow(/DATABASE_URL/);
    const config = lerConfig({ NODE_ENV: "production", CORS_ORIGENS: ORIGENS, JWT_SECRET: SEGREDO, DATABASE_URL: "postgresql://u:s@h/db", ...CPF });
    expect(config.urlBanco).toBe("postgresql://u:s@h/db");
    expect(config.cookieSeguro).toBe(true);
    expect(config.origens).toEqual([ORIGENS]);
  });

  it("em desenvolvimento roda sem banco configurado (memória)", () => {
    const config = lerConfig({ NODE_ENV: "development" });
    expect(config.urlBanco).toBeUndefined();
    expect(config.cookieSeguro).toBe(false);
  });

  it("chaves do CPF: obrigatórias com banco persistente; temporárias só com banco em memória (Req. 001)", () => {
    const base = { NODE_ENV: "production", CORS_ORIGENS: ORIGENS, JWT_SECRET: SEGREDO, DATABASE_URL: "postgresql://u:s@h/db" };
    expect(() => lerConfig(base)).toThrow(/CPF_CRIPTO_CHAVE e CPF_HASH_CHAVE/);
    expect(() => lerConfig({ ...base, CPF_CRIPTO_CHAVE: CPF.CPF_CRIPTO_CHAVE })).toThrow(/CPF_HASH_CHAVE/);
    expect(() => lerConfig({ ...base, ...CPF, CPF_HASH_CHAVE: "curta" })).toThrow(/32 caracteres/);
    // desenvolvimento com Supabase também exige: com chave temporária, o hash mudaria a cada reinício
    expect(() => lerConfig({ DATABASE_URL: "postgresql://u:s@h/db" })).toThrow(/CPF_/);
    expect(() => lerConfig({ ...base, CPF_CRIPTO_CHAVE: CPF.CPF_CRIPTO_CHAVE, CPF_HASH_CHAVE: CPF.CPF_CRIPTO_CHAVE })).toThrow(/diferentes/);

    // a mesma chave do ambiente sempre dá a mesma chave derivada (o hash precisa ser estável)
    const a = lerConfig({ ...base, ...CPF }).cpf;
    const b = lerConfig({ ...base, ...CPF }).cpf;
    expect(a.hash).toEqual(b.hash);
    expect(a.cifra).toEqual(b.cifra);
    expect(a.cifra).toHaveLength(32);
    expect(a.cifra).not.toEqual(a.hash);

    // banco em memória: chaves aleatórias
    expect(lerConfig({}).cpf.hash).toHaveLength(32);
  });

  it("TRUST_PROXY: padrão loopback; número vira saltos; lista passa como texto", () => {
    expect(lerConfig({}).trustProxy).toBe("loopback");
    expect(lerConfig({ TRUST_PROXY: "2" }).trustProxy).toBe(2);
    expect(lerConfig({ TRUST_PROXY: "loopback, uniquelocal" }).trustProxy).toBe("loopback, uniquelocal");
  });
});
