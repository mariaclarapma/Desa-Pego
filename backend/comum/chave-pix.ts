import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { validarCpf } from "./cpf.js";

/**
 * Chave Pix da vendedora (Módulo 01, Req. 002): validação por tipo, máscara e criptografia.
 *
 * - A chave é validada e normalizada conforme o tipo (CPF, e-mail, telefone ou aleatória).
 * - No banco, fica só cifrada (AES-256-GCM) com a PIX_CRIPTO_CHAVE do ambiente. O id da conta
 *   entra como dado autenticado (AAD): a cifra de uma conta não abre se for copiada para outra.
 * - Nas respostas, sai só mascarada. A chave completa nunca sai do serviço de contas
 *   (veja docs/CHAVE-PIX.md para a consulta administrativa da Issue #014).
 */
export const TIPOS_CHAVE_PIX = ["cpf", "email", "telefone", "aleatoria"] as const;
export type TipoChavePix = (typeof TIPOS_CHAVE_PIX)[number];

export type ResultadoChavePix = { ok: true; chave: string } | { ok: false; erro: string };

const soDigitos = (v: string) => v.replace(/\D/g, "");

const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const ALEATORIA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Valida a chave conforme o tipo e devolve a forma normalizada (a que é guardada). */
export function validarChavePix(tipo: TipoChavePix, valor: string): ResultadoChavePix {
  const bruto = valor.trim();
  if (!bruto) return { ok: false, erro: "informe a chave Pix." };
  switch (tipo) {
    case "cpf": {
      // mesma validação do CPF do cadastro (Req. 001): pontuação usual, 11 dígitos e dígitos verificadores
      const cpf = validarCpf(bruto);
      if (!cpf.ok) return { ok: false, erro: "CPF inválido. confira os 11 números." };
      return { ok: true, chave: cpf.cpf };
    }
    case "email": {
      const email = bruto.toLowerCase();
      // o Banco Central aceita e-mails de até 77 caracteres como chave
      if (email.length > 77 || !EMAIL.test(email)) return { ok: false, erro: "e-mail inválido para chave Pix." };
      return { ok: true, chave: email };
    }
    case "telefone": {
      if (!/^\+?[\d\s().-]+$/.test(bruto)) return { ok: false, erro: "telefone inválido. use DDD + número de celular." };
      let d = soDigitos(bruto);
      if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
      // celular brasileiro: DDD (11 a 99) + 9 + 8 dígitos
      if (!/^[1-9][1-9]9\d{8}$/.test(d)) return { ok: false, erro: "telefone inválido. use DDD + número de celular." };
      return { ok: true, chave: `+55${d}` };
    }
    case "aleatoria": {
      const chave = bruto.toLowerCase();
      if (!ALEATORIA.test(chave)) return { ok: false, erro: "chave aleatória inválida. cole a chave completa, com os traços." };
      return { ok: true, chave };
    }
  }
}

/** Máscara mostrada à vendedora: dá para reconhecer a chave, mas não para usá-la. */
export function mascararChavePix(tipo: TipoChavePix, chave: string): string {
  switch (tipo) {
    case "cpf":
      return `***.${chave.slice(3, 6)}.${chave.slice(6, 9)}-**`;
    case "email": {
      const [usuario, dominio] = chave.split("@");
      return `${usuario.slice(0, usuario.length > 2 ? 2 : 1)}***@${dominio}`;
    }
    case "telefone":
      return `(${chave.slice(3, 5)}) *****-${chave.slice(-4)}`;
    case "aleatoria":
      return `${chave.slice(0, 4)}****…****${chave.slice(-4)}`;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Criptografia (AES-256-GCM). Formato guardado: v1.<iv>.<tag>.<cifra>, em base64url.
 * ---------------------------------------------------------------------------------------------- */

const VERSAO = "v1";
/** Etiqueta de autenticação do GCM: sempre 16 bytes (128 bits), na cifra e na decifra. */
const TAMANHO_ETIQUETA = 16;
const TAMANHO_IV = 12;

/**
 * Lê a PIX_CRIPTO_CHAVE: 32 bytes em base64 (ex.: `openssl rand -base64 32`).
 * Sem valor, devolve null; valor no formato errado é erro (melhor parar do que gravar com chave fraca).
 */
export function lerChaveCripto(valor?: string): Buffer | null {
  if (!valor?.trim()) return null;
  const bytes = Buffer.from(valor.trim(), "base64");
  if (bytes.length !== 32) throw new Error("PIX_CRIPTO_CHAVE precisa ter 32 bytes em base64 (gere com: openssl rand -base64 32).");
  return bytes;
}

export function cifrarChavePix(chave: string, segredo: Buffer, usuarioId: string): string {
  const iv = randomBytes(TAMANHO_IV);
  const cifra = createCipheriv("aes-256-gcm", segredo, iv, { authTagLength: TAMANHO_ETIQUETA });
  cifra.setAAD(Buffer.from(usuarioId));
  const dados = Buffer.concat([cifra.update(chave, "utf8"), cifra.final()]);
  return [VERSAO, iv, cifra.getAuthTag(), dados].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** Lança erro se a cifra foi alterada, é de outra conta ou foi feita com outra PIX_CRIPTO_CHAVE. */
export function decifrarChavePix(guardada: string, segredo: Buffer, usuarioId: string): string {
  const [versao, iv, tag, dados] = guardada.split(".");
  if (versao !== VERSAO || !iv || !tag || !dados) throw new Error("chave Pix cifrada em formato desconhecido.");
  const bytesIv = Buffer.from(iv, "base64url");
  const etiqueta = Buffer.from(tag, "base64url");
  // etiqueta mais curta enfraquece a autenticação: só aceita exatamente 16 bytes
  if (bytesIv.length !== TAMANHO_IV || etiqueta.length !== TAMANHO_ETIQUETA) throw new Error("chave Pix cifrada em formato desconhecido.");
  const decifra = createDecipheriv("aes-256-gcm", segredo, bytesIv, { authTagLength: TAMANHO_ETIQUETA });
  decifra.setAAD(Buffer.from(usuarioId));
  decifra.setAuthTag(etiqueta);
  return Buffer.concat([decifra.update(Buffer.from(dados, "base64url")), decifra.final()]).toString("utf8");
}
