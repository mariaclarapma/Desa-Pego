import { fileURLToPath } from "node:url";
import { lerSegredoJwt } from "../../comum/autenticacao.js";
import { carregarEnv, lerLista, lerOrigens, lerTrustProxy } from "../../comum/seguranca.js";
import { criarAppCatalogo } from "./app.js";
import { gestaoPorHttp } from "./gestao.js";
import { abrirLoja } from "./loja.js";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

carregarEnv(caminho("../../../.env"));

const porta = Number(process.env.PORTA_CATALOGO ?? 3001);
const loja = abrirLoja(caminho("../../db.json"), caminho("../../db.seed.json"));
const apiKeys = lerLista(process.env.API_KEYS);
// o checkout fala com o serviço de pedidos (Módulo 05) pelas rotas internas, com a mesma API key
const gestao = apiKeys[0] ? gestaoPorHttp({ baseUrl: process.env.PEDIDOS_API_URL ?? "http://localhost:3003", apiKey: apiKeys[0] }) : null;
const app = criarAppCatalogo(loja, {
  origens: lerOrigens(process.env),
  apiKeys,
  gestao,
  trustProxy: lerTrustProxy(process.env.TRUST_PROXY),
  reservaMinutos: 15,
  freteCentavos: 1990,
  jwtSegredo: lerSegredoJwt(process.env),
});

app.listen(porta, "127.0.0.1", () => {
  console.log(`[catalogo] API do catálogo em http://localhost:${porta}`);
  if (!gestao) console.warn("[catalogo] API_KEYS não definido: rotas /integracao e checkout desligados (503).");
});

// a cada minuto, cancela os pedidos com o Pix vencido (aqui e no Módulo 05) e devolve as peças
setInterval(() => {
  app.compras.expirarVencidos().catch((erro) => console.error("[catalogo] expirar pedidos:", erro));
}, 60_000).unref();
