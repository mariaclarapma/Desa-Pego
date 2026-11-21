import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

/**
 * Proteção do CPF no banco (Req. 001). O CPF nunca é gravado em texto puro:
 *
 * - `cpf_hash`: HMAC-SHA256 do CPF com uma chave secreta (CPF_HASH_CHAVE). É determinístico,
 *   então a restrição UNIQUE do banco recusa CPF repetido sem precisar descriptografar nada.
 *   Um SHA-256 simples não serviria: só existem ~10⁹ CPFs, e quem lesse o banco testaria todos
 *   em minutos. Sem a chave, o HMAC não pode ser recalculado.
 * - `cpf_cifrado`: AES-256-GCM com IV aleatório (CPF_CRIPTO_CHAVE). O id da conta entra como
 *   dado autenticado (AAD): a cifra de uma conta não abre se for copiada para outra.
 *
 * As duas chaves são independentes. Trocar ou perder qualquer uma delas quebra os dados já
 * gravados (o hash deixa de bater e a cifra deixa de abrir): veja docs/CPF.md.
 */
export interface ChavesCpf {
  /** 32 bytes para o AES-256-GCM. */
  cifra: Buffer;
  /** 32 bytes para o HMAC-SHA256. */
  hash: Buffer;
}

/** Tamanho mínimo do segredo vindo do ambiente (o mesmo exigido do JWT_SECRET). */
export const SEGREDO_MINIMO = 32;

/**
 * Deriva uma chave de 32 bytes de um segredo do ambiente (HKDF-SHA256). Aceita qualquer texto
 * aleatório com 32+ caracteres (o recomendado é `openssl rand -base64 32`; veja docs/CPF.md).
 * O rótulo separa os usos: o mesmo segredo nunca vira a mesma chave em dois lugares.
 */
export function derivarChave(segredo: string, rotulo: string): Buffer {
  // trim: um espaço ou quebra de linha colada no painel não pode virar outra chave
  return Buffer.from(hkdfSync("sha256", segredo.trim(), "desapego-contas", rotulo, 32));
}

export const chavesCpf = (segredoCifra: string, segredoHash: string): ChavesCpf => ({
  cifra: derivarChave(segredoCifra, "cpf-cifra-v1"),
  hash: derivarChave(segredoHash, "cpf-hash-v1"),
});

/** Chaves aleatórias: só para testes e banco em memória (somem ao reiniciar). */
export const chavesCpfTemporarias = (): ChavesCpf => ({ cifra: randomBytes(32), hash: randomBytes(32) });

/** Hash determinístico do CPF já normalizado (11 dígitos), em hexadecimal. */
export const hashCpf = (cpf: string, chaves: ChavesCpf) => createHmac("sha256", chaves.hash).update(cpf, "utf8").digest("hex");

const VERSAO = "v1";
const IV_BYTES = 12;
/** Tag do GCM sempre com 16 bytes: o Node aceitaria tags truncadas (até 4 bytes), mais fáceis de forjar. */
const TAG_BYTES = 16;

/** Cifra o CPF normalizado. Formato: v1.<iv>.<tag>.<cifra>, em base64url. */
export function cifrarCpf(cpf: string, usuarioId: string, chaves: ChavesCpf): string {
  const iv = randomBytes(IV_BYTES);
  const cifrador = createCipheriv("aes-256-gcm", chaves.cifra, iv, { authTagLength: TAG_BYTES });
  cifrador.setAAD(Buffer.from(usuarioId, "utf8"));
  const cifra = Buffer.concat([cifrador.update(cpf, "utf8"), cifrador.final()]);
  return [VERSAO, iv, cifrador.getAuthTag(), cifra].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/**
 * Decifra o CPF. Lança erro se a cifra foi alterada, é de outra conta ou a chave mudou.
 * Uso restrito: nenhuma rota devolve o CPF hoje.
 */
export function decifrarCpf(guardado: string, usuarioId: string, chaves: ChavesCpf): string {
  const [versao, iv, tag, cifra] = guardado.split(".");
  if (versao !== VERSAO || !iv || !tag || !cifra) throw new Error("formato de CPF cifrado desconhecido.");
  const bytesIv = Buffer.from(iv, "base64url");
  const bytesTag = Buffer.from(tag, "base64url");
  if (bytesIv.length !== IV_BYTES || bytesTag.length !== TAG_BYTES) throw new Error("formato de CPF cifrado desconhecido.");
  const decifrador = createDecipheriv("aes-256-gcm", chaves.cifra, bytesIv, { authTagLength: TAG_BYTES });
  decifrador.setAAD(Buffer.from(usuarioId, "utf8"));
  decifrador.setAuthTag(bytesTag);
  return Buffer.concat([decifrador.update(Buffer.from(cifra, "base64url")), decifrador.final()]).toString("utf8");
}
