import { describe, expect, it } from "vitest";
import { chavesCpf, chavesCpfTemporarias, cifrarCpf, decifrarCpf, hashCpf } from "./cpf-cripto.js";

const CPF = "52998224725";
const chaves = chavesCpf("chave-de-cifra-do-cpf-com-mais-de-32-caracteres", "chave-de-hash-do-cpf-com-mais-de-32-caracteres");

describe("hashCpf (unicidade)", () => {
  it("é determinístico com a mesma chave e muda com outra chave", () => {
    expect(hashCpf(CPF, chaves)).toBe(hashCpf(CPF, chaves));
    expect(hashCpf(CPF, chaves)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCpf(CPF, chaves)).not.toBe(hashCpf("11144477735", chaves));
    expect(hashCpf(CPF, chaves)).not.toBe(hashCpf(CPF, chavesCpfTemporarias()));
  });

  it("não é um SHA-256 simples do CPF (que daria para descobrir por força bruta)", async () => {
    const { createHash } = await import("node:crypto");
    expect(hashCpf(CPF, chaves)).not.toBe(createHash("sha256").update(CPF).digest("hex"));
  });
});

describe("cifrarCpf / decifrarCpf", () => {
  it("cifra com IV aleatório e decifra de volta", () => {
    const a = cifrarCpf(CPF, "conta-1", chaves);
    const b = cifrarCpf(CPF, "conta-1", chaves);
    expect(a).not.toBe(b);
    expect(a).not.toContain(CPF);
    expect(a).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(decifrarCpf(a, "conta-1", chaves)).toBe(CPF);
  });

  it("não abre com outra chave, em outra conta ou se a cifra for alterada", () => {
    const cifra = cifrarCpf(CPF, "conta-1", chaves);
    expect(() => decifrarCpf(cifra, "conta-1", chavesCpfTemporarias())).toThrow();
    expect(() => decifrarCpf(cifra, "conta-2", chaves)).toThrow();
    const [v, iv, tag, dados] = cifra.split(".");
    const adulterada = [v, iv, tag, (dados[0] === "A" ? "B" : "A") + dados.slice(1)].join(".");
    expect(() => decifrarCpf(adulterada, "conta-1", chaves)).toThrow();
    expect(() => decifrarCpf("texto-qualquer", "conta-1", chaves)).toThrow(/formato/);
  });

  it("recusa tag de autenticação truncada (forjar uma tag curta seria mais fácil)", () => {
    const cifra = cifrarCpf(CPF, "conta-1", chaves);
    const [v, iv, tag, dados] = cifra.split(".");
    const curta = Buffer.from(tag, "base64url").subarray(0, 4).toString("base64url");
    expect(() => decifrarCpf([v, iv, curta, dados].join("."), "conta-1", chaves)).toThrow(/formato/);
    const ivCurto = Buffer.from(iv, "base64url").subarray(0, 8).toString("base64url");
    expect(() => decifrarCpf([v, ivCurto, tag, dados].join("."), "conta-1", chaves)).toThrow(/formato/);
  });

  it("espaços ou quebra de linha em volta do segredo não mudam a chave", () => {
    const comEspaco = chavesCpf(" chave-de-cifra-do-cpf-com-mais-de-32-caracteres\n", "chave-de-hash-do-cpf-com-mais-de-32-caracteres ");
    expect(comEspaco.hash).toEqual(chaves.hash);
    expect(decifrarCpf(cifrarCpf(CPF, "c", chaves), "c", comEspaco)).toBe(CPF);
  });
});
