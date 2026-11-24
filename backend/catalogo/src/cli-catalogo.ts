import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { conectar } from "../../comum/postgres.js";
import { carregarEnv } from "../../comum/seguranca.js";
import { armazenamentoSupabaseDoAmbiente } from "./fotos-supabase.js";
import { aplicarMigracao, exportarCatalogo, planejarMigracao, type Relatorio } from "./migracao.js";
import type { BancoCatalogo, Dados } from "./loja.js";

/*
 * Migração do catálogo (docs/CATALOGO-SUPABASE.md, seção "Migração"). Na raiz:
 *
 *   npm run catalogo -w backend -- exportar --site https://desapego.onrender.com --saida ../exportacao-catalogo
 *   npm run catalogo -w backend -- migrar --arquivo ../exportacao-catalogo/catalogo.json --fotos ../exportacao-catalogo/fotos
 *   npm run catalogo -w backend -- migrar ... --aplicar
 *
 * `exportar` só faz leituras (GET) e precisa de ADMIN_MASTER_EMAIL, ADMIN_MASTER_PASSWORD e API_KEYS.
 * `migrar` sem --aplicar só mostra o relatório. Com --aplicar, grava em DATABASE_URL e copia as fotos
 * para o Supabase (SUPABASE_URL e SUPABASE_SECRET_KEY). A exportação tem dados pessoais (pedidos):
 * fica fora do Git (.gitignore) e deve ser apagada depois.
 */

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));
carregarEnv(caminho("../../../.env"));

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { site: { type: "string" }, saida: { type: "string" }, arquivo: { type: "string" }, fotos: { type: "string" }, aplicar: { type: "boolean", default: false } },
});

function imprimir(r: Relatorio) {
  console.log("peças:", r.pecas.total, `(semente ${r.pecas.daSemente}, anúncios ${r.pecas.anuncios}, semente alterada ${r.pecas.sementeAlteradas}, semente removida ${r.pecas.sementeRemovidas.length})`);
  console.log("reservas em vigor:", r.reservas.ativas.length, "· vencidas:", r.reservas.vencidas, "· vendidas:", r.vendidas);
  console.log("pedidos:", JSON.stringify(r.pedidos));
  console.log("fotos vinculadas:", r.fotos.vinculadas, `(registro reconstruído ${r.fotos.reconstruidas}) · envios descartados: ${r.fotos.enviosDescartados}`);
  console.log("frete configurado:", r.configuracao ? "sim" : "não");
  for (const a of r.avisos) console.log("aviso:", a);
  for (const p of r.problemas) console.log("PROBLEMA:", p);
}

async function exportar() {
  const site = values.site;
  const saida = values.saida && resolve(values.saida);
  const email = process.env.ADMIN_MASTER_EMAIL;
  const senha = process.env.ADMIN_MASTER_PASSWORD;
  const apiKey = (process.env.API_KEYS ?? "").split(",")[0]?.trim();
  if (!site || !saida || !email || !senha || !apiKey) {
    throw new Error("use: exportar --site <url> --saida <pasta>, com ADMIN_MASTER_EMAIL, ADMIN_MASTER_PASSWORD e API_KEYS no ambiente.");
  }
  if (existsSync(join(saida, "catalogo.json"))) throw new Error(`${saida} já tem uma exportação. escolha outra pasta.`);
  const login = await fetch(`${site.replace(/\/+$/, "")}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  if (!login.ok) throw new Error(`login da administradora master recusado (${login.status}).`);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const { dados, fotos } = await exportarCatalogo({ base: site, token: accessToken, apiKey });
  mkdirSync(join(saida, "fotos"), { recursive: true });
  writeFileSync(join(saida, "catalogo.json"), JSON.stringify(dados, null, 2), { mode: 0o600 });
  for (const [chave, arquivo] of fotos) writeFileSync(join(saida, "fotos", chave), arquivo);
  console.log(`exportado em ${saida}: ${dados.pecas.length} peças, ${dados.pedidos.length} pedidos, ${fotos.size} fotos.`);
  imprimir(planejarMigracao(dados, JSON.parse(readFileSync(caminho("../../db.seed.json"), "utf8")), Date.now()).relatorio);
}

async function migrar() {
  if (!values.arquivo) throw new Error("use: migrar --arquivo <catalogo.json ou db.json> [--fotos <pasta>] [--aplicar]");
  const origem: Dados = JSON.parse(readFileSync(resolve(values.arquivo), "utf8"));
  const semente = caminho("../../db.seed.json");
  const plano = planejarMigracao(origem, JSON.parse(readFileSync(semente, "utf8")), Date.now());
  imprimir(plano.relatorio);
  if (!values.aplicar) {
    console.log("\nsó o relatório: nada foi gravado. para gravar, repita com --aplicar.");
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("--aplicar precisa de DATABASE_URL.");
  const pasta = values.fotos ? resolve(values.fotos) : caminho("../../fotos");
  const { db } = await conectar(url);
  try {
    const feito = await aplicarMigracao({
      db: db as BancoCatalogo,
      semente,
      plano,
      armazenamento: armazenamentoSupabaseDoAmbiente(process.env),
      lerFoto: async (chave) => (existsSync(join(pasta, chave)) ? readFileSync(join(pasta, chave)) : null),
    });
    console.log(`\nmigrado: ${feito.pecas} peças, ${feito.pedidos} pedidos, ${feito.fotos} fotos copiadas.`);
  } finally {
    await db.end();
  }
}

const comandos: Record<string, () => Promise<void>> = { exportar, migrar };
const comando = comandos[positionals[0] ?? ""];
if (!comando) {
  console.error("comandos: exportar | migrar");
  process.exit(1);
}
comando().catch((erro: Error) => {
  console.error(erro.message);
  process.exit(1);
});
