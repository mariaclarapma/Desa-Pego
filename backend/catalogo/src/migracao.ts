import { readFileSync } from "node:fs";
import { CHAVE_FOTO, conteudoEhDoTipo, tipoAceito, type TipoFoto } from "./fotos.js";
import type { ArmazenamentoSupabase } from "./fotos-supabase.js";
import { abrirLojaBanco, type BancoCatalogo, type Dados, type FotoEnviada, type Peca } from "./loja.js";
import { statusAtual } from "./regras.js";

/**
 * Migração do catálogo do db.json para o PostgreSQL (e das fotos locais para o Supabase Storage).
 *
 * No primeiro deploy com DATABASE_URL, o catálogo só copia a semente. O que estava no db.json da
 * instância antiga (anúncios, fotos, reservas, pedidos, frete) fica de fora. Esta migração:
 * 1. `exportarCatalogo`: lê o catálogo de um serviço que está no ar, só com leituras (GET), pelas
 *    rotas que já existem: /admin/pecas (administradora master), /integracao/pedidos (X-API-Key),
 *    /admin/frete e os arquivos em /fotos/:chave;
 * 2. `planejarMigracao`: confere os dados e diz o que entra e o que fica de fora, sem gravar nada;
 * 3. `aplicarMigracao`: copia as fotos para o bucket público e grava tudo numa transação. Só roda
 *    num catálogo vazio ou ainda igual à semente; não sobrescreve dados novos.
 */

export const FOTO_MAX_BYTES = 5 * 1024 * 1024;

const TIPO_DA_EXTENSAO: Record<string, TipoFoto> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export interface Relatorio {
  pecas: { total: number; daSemente: number; anuncios: number; sementeAlteradas: number; sementeRemovidas: string[] };
  reservas: { ativas: { pecaId: string; ate: string }[]; vencidas: number };
  vendidas: number;
  pedidos: Record<string, number>;
  fotos: { vinculadas: number; reconstruidas: number; enviosDescartados: number };
  configuracao: boolean;
  /** Impedem aplicar: precisam ser resolvidos antes. */
  problemas: string[];
  /** Não impedem: o que fica de fora ou merece atenção. */
  avisos: string[];
}

export interface Plano {
  dados: Dados;
  relatorio: Relatorio;
  /** Fotos que precisam ir para o bucket público (chave → tipo). */
  fotos: Map<string, TipoFoto>;
}

/** Fotos guardadas na própria API (armazenamento local): precisam ser copiadas para o Supabase. */
const ehFotoLocal = (url: string) => /^\/(api\/)?fotos\/[^/]+$/.test(url);

export function planejarMigracao(origem: Dados, semente: Dados, agora: number): Plano {
  const problemas: string[] = [];
  const avisos: string[] = [];
  const dados: Dados = structuredClone({ pecas: origem.pecas ?? [], pedidos: origem.pedidos ?? [], fotos: [], configuracao: origem.configuracao });
  const daSemente = new Map(semente.pecas.map((p) => [p.id, p]));
  const pecas = new Map<string, Peca>();
  for (const p of dados.pecas) {
    if (pecas.has(p.id)) problemas.push(`peça ${p.id} repetida.`);
    pecas.set(p.id, p);
  }

  // registro das fotos: só as que estão num anúncio. Envios soltos são descartados (no Supabase, o
  // navegador teria de enviar de novo). Sem registro (veio da exportação), é reconstruído da peça.
  const registros = new Map((origem.fotos ?? []).map((f) => [f.chave, f]));
  const fotos = new Map<string, TipoFoto>();
  let reconstruidas = 0;
  for (const p of dados.pecas) {
    for (const f of p.fotos ?? []) {
      const extensao = CHAVE_FOTO.exec(f.chave)?.[1];
      const tipo = extensao ? TIPO_DA_EXTENSAO[extensao] : undefined;
      if (!tipo) {
        problemas.push(`foto ${f.chave} da peça ${p.id} com chave inválida.`);
        continue;
      }
      if (fotos.has(f.chave)) problemas.push(`foto ${f.chave} em mais de uma peça.`);
      const registro = registros.get(f.chave);
      if (registro && registro.pecaId !== p.id) problemas.push(`foto ${f.chave}: o registro aponta para outra peça (${registro.pecaId ?? "nenhuma"}).`);
      if (registro && registro.usuariaId !== p.vendedoraId) problemas.push(`foto ${f.chave}: o envio é de outra conta, não da vendedora da peça ${p.id}.`);
      if (!p.vendedoraId) problemas.push(`peça ${p.id} tem fotos mas não tem vendedora.`);
      if (!registro) reconstruidas++;
      const criada = String(p.criadoEm ?? new Date(agora).toISOString());
      const novo: FotoEnviada = registro
        ? { ...registro, tipo: registro.tipo || tipo, enviadaEm: registro.enviadaEm ?? criada }
        : { chave: f.chave, usuariaId: p.vendedoraId ?? "", tipo, criadaEm: criada, enviadaEm: criada, pecaId: p.id };
      if (!tipoAceito(novo.tipo)) problemas.push(`foto ${f.chave} com tipo ${novo.tipo} não aceito.`);
      dados.fotos!.push(novo);
      if (ehFotoLocal(f.url)) fotos.set(f.chave, tipo);
    }
  }
  const enviosDescartados = [...registros.values()].filter((f) => !dados.fotos!.some((v) => v.chave === f.chave)).length;
  for (const f of registros.values()) {
    if (f.pecaId && !pecas.has(f.pecaId)) avisos.push(`foto ${f.chave} vinculada à peça ${f.pecaId}, que não existe: fica de fora.`);
  }

  const reservadas = dados.pecas.filter((p) => p.status === "reservada");
  const ativas = reservadas.filter((p) => statusAtual(p, agora) === "reservada").map((p) => ({ pecaId: p.id, ate: String(p.reservadaAte) }));
  for (const p of dados.pedidos) for (const i of p.itens) if (!pecas.has(i.id)) avisos.push(`pedido ${p.id} cita a peça ${i.id}, que não existe mais (o pedido guarda título e preço).`);
  if (enviosDescartadosAntes(origem, dados)) avisos.push("envios de foto que não entraram em anúncio ficam de fora (a vendedora envia de novo).");
  if (ativas.length) avisos.push(`${ativas.length} reserva(s) ainda em vigor: continuam no nome de quem reservou até vencer.`);

  return {
    dados,
    fotos,
    relatorio: {
      pecas: {
        total: dados.pecas.length,
        daSemente: dados.pecas.filter((p) => daSemente.has(p.id)).length,
        anuncios: dados.pecas.filter((p) => !daSemente.has(p.id)).length,
        sementeAlteradas: dados.pecas.filter((p) => daSemente.has(p.id) && JSON.stringify(p) !== JSON.stringify(daSemente.get(p.id))).length,
        sementeRemovidas: [...daSemente.keys()].filter((id) => !pecas.has(id)),
      },
      reservas: { ativas, vencidas: reservadas.length - ativas.length },
      vendidas: dados.pecas.filter((p) => p.status === "vendida").length,
      pedidos: dados.pedidos.reduce<Record<string, number>>((n, p) => ({ ...n, [p.status]: (n[p.status] ?? 0) + 1 }), {}),
      fotos: { vinculadas: dados.fotos!.length, reconstruidas, enviosDescartados },
      configuracao: !!origem.configuracao && Object.keys(origem.configuracao).length > 0,
      problemas: [...new Set(problemas)],
      avisos: [...new Set(avisos)],
    },
  };
}

const enviosDescartadosAntes = (origem: Dados, dados: Dados) => (origem.fotos ?? []).some((f) => !dados.fotos!.some((v) => v.chave === f.chave));

/** O catálogo de destino está vazio ou ainda é só a semente (ninguém mexeu)? */
async function destinoLivre(db: BancoCatalogo, schema: string, semente: Dados) {
  const existe = await db.query(`SELECT 1 FROM ${schema}.configuracao LIMIT 1`).then(
    () => true,
    () => false,
  );
  if (!existe) return true;
  const pecas = (await db.query<{ dados: Peca }>(`SELECT dados FROM ${schema}.pecas ORDER BY ordem`)).rows.map((r) => r.dados);
  const config = (await db.query<{ dados: unknown }>(`SELECT dados FROM ${schema}.configuracao WHERE id = 1`)).rows[0]?.dados ?? {};
  const outros = await db.query<{ n: number }>(`SELECT (SELECT count(*) FROM ${schema}.pedidos) + (SELECT count(*) FROM ${schema}.fotos) AS n`);
  // o JSONB do Postgres não guarda a ordem das chaves: compara sem depender dela
  return Number(outros.rows[0].n) === 0 && jsonCanonico(config) === "{}" && jsonCanonico(pecas) === jsonCanonico(semente.pecas);
}

/** JSON com as chaves dos objetos em ordem alfabética (a ordem dos itens das listas continua valendo). */
export function jsonCanonico(valor: unknown): string {
  return JSON.stringify(valor, (_chave, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/**
 * Copia as fotos e grava o plano. `lerFoto` traz o arquivo do armazenamento antigo (pasta ou
 * exportação). Confere cada foto (tamanho e primeiros bytes) antes de gravar qualquer coisa.
 */
export async function aplicarMigracao(opcoes: {
  db: BancoCatalogo;
  schema?: string;
  semente: string;
  plano: Plano;
  armazenamento: ArmazenamentoSupabase | null;
  lerFoto: (chave: string) => Promise<Buffer | null>;
}) {
  const { db, plano, armazenamento } = opcoes;
  const schema = opcoes.schema ?? "catalogo";
  if (plano.relatorio.problemas.length) throw new Error(`a migração tem problemas a resolver antes:\n- ${plano.relatorio.problemas.join("\n- ")}`);
  const semente: Dados = JSON.parse(readFileSync(opcoes.semente, "utf8"));
  if (!(await destinoLivre(db, schema, semente))) {
    throw new Error("o catálogo no banco já tem dados além da semente (migração já feita, ou anúncios novos). nada foi alterado.");
  }
  if (plano.fotos.size && !armazenamento) throw new Error("há fotos locais para copiar: defina SUPABASE_URL e SUPABASE_SECRET_KEY.");

  // 1) confere todas as fotos antes de copiar qualquer uma
  const arquivos = new Map<string, Buffer>();
  for (const [chave, tipo] of plano.fotos) {
    const dados = await opcoes.lerFoto(chave);
    if (!dados) throw new Error(`a foto ${chave} não foi encontrada no armazenamento antigo. nada foi alterado.`);
    if (dados.length < 1 || dados.length > FOTO_MAX_BYTES || !conteudoEhDoTipo(dados, tipo)) {
      throw new Error(`a foto ${chave} não é uma imagem ${tipo} de até 5 MB. nada foi alterado.`);
    }
    arquivos.set(chave, dados);
  }

  // 2) copia para o bucket público e troca o endereço nas peças
  const dados = structuredClone(plano.dados);
  for (const [chave, arquivo] of arquivos) await armazenamento!.publicarArquivo(chave, plano.fotos.get(chave)!, arquivo);
  if (armazenamento) {
    for (const p of dados.pecas) {
      if (!p.fotos?.some((f) => arquivos.has(f.chave))) continue;
      p.fotos = p.fotos.map((f) => (arquivos.has(f.chave) ? { ...f, url: armazenamento.urlPublica(f.chave) } : f));
      p.fotoUrl = p.fotos[0].url;
    }
  }

  // 3) grava tudo numa transação (a mesma gravação do catálogo)
  const loja = await abrirLojaBanco(db, opcoes.semente, schema);
  await loja.alterarEmFila((d) => {
    d.pecas = dados.pecas;
    d.pedidos = dados.pedidos;
    d.fotos = dados.fotos;
    d.configuracao = { ...(dados.configuracao ?? {}) };
  });
  return { pecas: dados.pecas.length, pedidos: dados.pedidos.length, fotos: arquivos.size };
}

/** Lê o catálogo de um serviço no ar, só com GET. `base` é o site (as rotas passam por /api). */
export async function exportarCatalogo(opcoes: { base: string; token: string; apiKey: string; buscar?: typeof fetch }) {
  const buscar = opcoes.buscar ?? fetch;
  const base = opcoes.base.replace(/\/+$/, "");
  async function json<T>(caminho: string, cabecalhos: Record<string, string>): Promise<T> {
    const resposta = await buscar(`${base}${caminho}`, { headers: cabecalhos, signal: AbortSignal.timeout(30_000) });
    if (!resposta.ok) throw new Error(`GET ${caminho}: ${resposta.status}`);
    return (await resposta.json()) as T;
  }
  const admin = { Authorization: `Bearer ${opcoes.token}` };
  const { pecas } = await json<{ pecas: (Peca & { irregular?: boolean })[] }>("/api/admin/pecas", admin);
  const { pedidos } = await json<{ pedidos: Dados["pedidos"] }>("/api/integracao/pedidos", { "X-API-Key": opcoes.apiKey });
  const { freteCentavos } = await json<{ freteCentavos: number }>("/api/admin/frete", admin);

  const fotos = new Map<string, Buffer>();
  for (const p of pecas) {
    for (const f of p.fotos ?? []) {
      if (!ehFotoLocal(f.url) || !CHAVE_FOTO.test(f.chave)) continue;
      const resposta = await buscar(`${base}${f.url.startsWith("/api/") ? f.url : `/api${f.url}`}`, { signal: AbortSignal.timeout(30_000) });
      if (resposta.ok) fotos.set(f.chave, Buffer.from(await resposta.arrayBuffer()));
    }
  }
  // tira o campo calculado só para a tela da administração
  const limpas = pecas.map(({ irregular: _irregular, ...p }) => p as Peca);
  const dados: Dados = { pecas: limpas, pedidos, fotos: [], configuracao: { freteCentavos } };
  return { dados, fotos };
}
