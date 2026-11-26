import { fileURLToPath } from "node:url";
import { lerSegredoJwt } from "../../comum/autenticacao.js";
import { carregarEnv, lerLista, lerOrigens, lerTrustProxy } from "../../comum/seguranca.js";
import { conectar } from "../../comum/postgres.js";
import { limparEnviosAbandonados, perfisPorHttp } from "./anuncios.js";
import { criarAppCatalogo } from "./app.js";
import { ArmazenamentoLocal } from "./fotos.js";
import { armazenamentoSupabaseDoAmbiente } from "./fotos-supabase.js";
import { gestaoPorHttp } from "./gestao.js";
import { abrirLoja, abrirLojaBanco, type BancoCatalogo } from "./loja.js";
import { lerReservaMinutos } from "./regras.js";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

carregarEnv(caminho("../../../.env"));

const porta = Number(process.env.PORTA_CATALOGO ?? 3001);
// Com DATABASE_URL (Supabase, o mesmo banco das contas), o catálogo fica no PostgreSQL e sobrevive
// a deploy e reinício. Sem ela (desenvolvimento), continua no db.json.
const urlBanco = process.env.DATABASE_URL || undefined;
if (process.env.NODE_ENV === "production" && !urlBanco) throw new Error("DATABASE_URL é obrigatório em produção.");
const semente = caminho("../../db.seed.json");
const loja = urlBanco
  ? await abrirLojaBanco((await conectar(urlBanco)).db as BancoCatalogo, semente)
  : abrirLoja(caminho("../../db.json"), semente);
const apiKeys = lerLista(process.env.API_KEYS);
// o checkout fala com o serviço de pedidos (Módulo 05) pelas rotas internas, com a mesma API key
const gestao = apiKeys[0] ? gestaoPorHttp({ baseUrl: process.env.PEDIDOS_API_URL ?? "http://localhost:3003", apiKey: apiKeys[0] }) : null;
const jwtSegredo = lerSegredoJwt(process.env);
// Fotos dos anúncios: no Supabase Storage com SUPABASE_URL e SUPABASE_SECRET_KEY; sem elas, numa
// pasta local (fora do Git), que no Render grátis é apagada a cada deploy.
const fotosSupabase = armazenamentoSupabaseDoAmbiente(process.env);
const anuncios = {
  // `||`: o .env gerado pelo gerar-env traz PASTA_FOTOS vazio, e vazio também cai no padrão
  armazenamento: fotosSupabase ?? new ArmazenamentoLocal(process.env.PASTA_FOTOS || caminho("../../fotos"), "/api/fotos", jwtSegredo),
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
  console.log(`[catalogo] dados: ${urlBanco ? "PostgreSQL (schema catalogo)" : "db.json"}; fotos: ${fotosSupabase ? "Supabase Storage" : "pasta local"}.`);
  if (process.env.NODE_ENV === "production" && !fotosSupabase) console.warn("[catalogo] sem SUPABASE_URL/SUPABASE_SECRET_KEY: as fotos somem a cada deploy.");
});

// a cada minuto: cancela os pedidos com o Pix vencido (aqui e no Módulo 05), devolve as peças
// e grava como disponíveis as reservas da sacola que venceram
setInterval(() => {
  app.compras.expirarVencidos().catch((erro) => console.error("[catalogo] expirar pedidos:", erro));
  app.compras.liberarReservasVencidas().catch((erro) => console.error("[catalogo] liberar reservas:", erro));
}, 60_000).unref();

// a cada hora, apaga os envios de foto que ficaram 24 horas sem entrar em anúncio
setInterval(() => {
  limparEnviosAbandonados(loja, anuncios.armazenamento, Date.now).catch((erro) => console.error("[catalogo] limpar envios:", erro));
}, 60 * 60_000).unref();
