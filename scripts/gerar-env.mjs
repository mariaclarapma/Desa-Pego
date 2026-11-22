// Cria o .env de desenvolvimento a partir do .env.example, com JWT_SECRET, API_KEYS, as chaves do CPF
// e a PIX_CRIPTO_CHAVE aleatórios.
// Não sobrescreve um .env que já existe.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const destino = new URL("../.env", import.meta.url);
if (existsSync(destino)) {
  console.log(".env já existe: nada foi alterado.");
  process.exit(0);
}
const segredo = () => randomBytes(32).toString("base64url");
const conteudo = readFileSync(new URL("../.env.example", import.meta.url), "utf8")
  .replace(/^JWT_SECRET=$/m, `JWT_SECRET=${segredo()}`)
  .replace(/^API_KEYS=$/m, `API_KEYS=${segredo()}`)
  .replace(/^CPF_CRIPTO_CHAVE=$/m, `CPF_CRIPTO_CHAVE=${segredo()}`)
  .replace(/^CPF_HASH_CHAVE=$/m, `CPF_HASH_CHAVE=${segredo()}`)
  // 32 bytes em base64 (AES-256): cifra as chaves Pix. Veja docs/CHAVE-PIX.md
  .replace(/^PIX_CRIPTO_CHAVE=$/m, `PIX_CRIPTO_CHAVE=${randomBytes(32).toString("base64")}`);
writeFileSync(destino, conteudo);
console.log(".env criado com JWT_SECRET, API_KEYS, CPF_CRIPTO_CHAVE, CPF_HASH_CHAVE e PIX_CRIPTO_CHAVE aleatórios.");
