import { fileURLToPath } from "node:url";
import { lerSegredoJwt } from "../../comum/autenticacao.js";
import { carregarEnv, lerLista, lerOrigens, lerTrustProxy } from "../../comum/seguranca.js";
import { criarAppCatalogo } from "./app.js";
import { abrirLoja } from "./loja.js";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

carregarEnv(caminho("../../../.env"));

const porta = Number(process.env.PORTA_CATALOGO ?? 3001);
const loja = abrirLoja(caminho("../../db.json"), caminho("../../db.seed.json"));
const app = criarAppCatalogo(loja, {
  origens: lerOrigens(process.env),
  apiKeys: lerLista(process.env.API_KEYS),
  trustProxy: lerTrustProxy(process.env.TRUST_PROXY),
  reservaMinutos: 15,
  freteCentavos: 1990,
  jwtSegredo: lerSegredoJwt(process.env),
});

app.listen(porta, "127.0.0.1", () => {
  console.log(`[catalogo] API do catálogo em http://localhost:${porta}`);
  if (!process.env.API_KEYS) console.warn("[catalogo] API_KEYS não definido: rotas /integracao desligadas (503).");
});
