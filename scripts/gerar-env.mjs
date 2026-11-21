// Cria o .env de desenvolvimento a partir do .env.example, com JWT_SECRET, API_KEYS e as chaves do CPF aleatórios.
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
  .replace(/^CPF_HASH_CHAVE=$/m, `CPF_HASH_CHAVE=${segredo()}`);
writeFileSync(destino, conteudo);
console.log(".env criado com JWT_SECRET, API_KEYS, CPF_CRIPTO_CHAVE e CPF_HASH_CHAVE aleatórios.");
