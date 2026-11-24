import { fileURLToPath } from "node:url";
import { lerSegredoJwt } from "../../comum/autenticacao.js";
import { carregarEnv, lerLista, lerOrigens, lerTrustProxy } from "../../comum/seguranca.js";
import { perfisPorHttp } from "./anuncios.js";
import { criarAppCatalogo } from "./app.js";
import { ArmazenamentoLocal } from "./fotos.js";
import { gestaoPorHttp } from "./gestao.js";
import { abrirLoja } from "./loja.js";
import { lerReservaMinutos } from "./regras.js";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

carregarEnv(caminho("../../../.env"));

const porta = Number(process.env.PORTA_CATALOGO ?? 3001);
const loja = abrirLoja(caminho("../../db.json"), caminho("../../db.seed.json"));
const apiKeys = lerLista(process.env.API_KEYS);
// o checkout fala com o serviço de pedidos (Módulo 05) pelas rotas internas, com a mesma API key
const gestao = apiKeys[0] ? gestaoPorHttp({ baseUrl: process.env.PEDIDOS_API_URL ?? "http://localhost:3003", apiKey: apiKeys[0] }) : null;
const jwtSegredo = lerSegredoJwt(process.env);
// Fotos dos anúncios: por enquanto numa pasta local (fora do Git). O grupo ainda decide entre
// Amazon S3 e Supabase Storage; no Render grátis esta pasta é apagada a cada deploy.
const anuncios = {
  // `||`: o .env gerado pelo gerar-env traz PASTA_FOTOS vazio, e vazio também cai no padrão
  armazenamento: new ArmazenamentoLocal(process.env.PASTA_FOTOS || caminho("../../fotos"), "/api/fotos", jwtSegredo),
  perfis: perfisPorHttp({ baseUrl: process.env.CONTAS_API_URL ?? "http://localhost:3002" }),
  fotoMaxBytes: 5 * 1024 * 1024,
};
const app = criarAppCatalogo(loja, {
  origens: lerOrigens(process.env),
  apiKeys,
  gestao,
  trustProxy: lerTrustProxy(process.env.TRUST_PROXY),
  reservaMinutos: lerReservaMinutos(process.env.RESERVA_MINUTOS),
  freteCentavos: 1990,
  jwtSegredo,
  anuncios,
});

app.listen(porta, "127.0.0.1", () => {
  console.log(`[catalogo] API do catálogo em http://localhost:${porta}`);
  if (!gestao) console.warn("[catalogo] API_KEYS não definido: rotas /integracao e checkout desligados (503).");
});

// a cada minuto, cancela os pedidos com o Pix vencido (aqui e no Módulo 05) e devolve as peças
setInterval(() => {
  app.compras.expirarVencidos().catch((erro) => console.error("[catalogo] expirar pedidos:", erro));
}, 60_000).unref();
