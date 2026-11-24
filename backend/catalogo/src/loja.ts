import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import type pg from "pg";
import { validarSchema, type Consultavel } from "../../comum/postgres.js";

/**
 * Dados do catálogo (peças, pedidos, fotos e configuração). Ficam em memória e são gravados:
 * - no PostgreSQL (Supabase), com `DATABASE_URL`: sobrevivem a deploy e reinício (abrirLojaBanco);
 * - num arquivo JSON (db.json), sem `DATABASE_URL`: desenvolvimento local, como antes (abrirLoja).
 * Toda alteração passa por uma fila: uma de cada vez, então duas pessoas não conseguem
 * reservar a mesma peça ao mesmo tempo (o papel do UPDATE atômico do banco real, ADR-003).
 * Por isso o catálogo roda numa instância só (como no Render grátis).
 */
export type StatusPeca = "disponivel" | "reservada" | "vendida";
export type StatusPedido = "aguardando_pagamento" | "pago" | "cancelado";

export interface Peca {
  id: string;
  titulo: string;
  precoCentavos: number;
  status: StatusPeca;
  reservadaAte?: string | null;
  /** Conta que reservou (id do token): só ela libera a reserva e fecha o pedido. Nunca sai na vitrine. */
  reservadaPor?: string | null;
  /**
   * Conta da vendedora (id do serviço de contas). Quem grava é o anúncio (Módulo 02); sem ele,
   * a peça não pode ser vendida, porque o pedido do Módulo 05 precisa saber de quem é a venda.
   */
  vendedoraId?: string;
  /** Ocultada pela administração (anúncio irregular): some da vitrine, da página e da reserva. */
  oculta?: boolean;
  motivoOculta?: string | null;
  /** Pausada pela própria vendedora (Req. 004): também some da vitrine até ela reativar. */
  pausada?: boolean;
  /** Fotos do anúncio, na ordem (a primeira é a capa, repetida em `fotoUrl`). */
  fotos?: { chave: string; url: string }[];
  [campo: string]: unknown;
}

/** Foto enviada por URL pré-assinada (Req. 004). Fica solta até entrar num anúncio. */
export interface FotoEnviada {
  chave: string;
  /** Conta que pediu o envio: só ela pode usar a foto num anúncio. */
  usuariaId: string;
  tipo: string;
  criadaEm: string;
  enviadaEm: string | null;
  pecaId: string | null;
}

export interface Pedido {
  id: string;
  /** Conta da compradora (id do token). Só ela consulta o pedido. Pedidos antigos não têm. */
  compradoraId?: string;
  comprador: { nome: string; email: string };
  endereco: Record<string, string | undefined>;
  itens: { id: string; titulo: string; precoCentavos: number; vendedoraId?: string }[];
  subtotalCentavos: number;
  freteCentavos: number;
  totalCentavos: number;
  status: StatusPedido;
  pixCopiaECola: string;
  pixExpiraEm: string;
  criadoEm: string;
  pagoEm?: string;
  canceladoEm?: string;
  /**
   * Pedidos correspondentes no Módulo 05 (um por vendedora), criados pelo CompraFacade. São eles
   * que aparecem em "minhas compras", "minhas vendas" e na carteira.
   */
  pedidosGestao?: { vendedoraId: string; pedidoId: string }[];
}

/** Regras definidas pela administração no painel (sem valor = vale o padrão do servidor). */
export interface ConfiguracaoLoja {
  freteCentavos?: number;
}

export interface Dados {
  pecas: Peca[];
  pedidos: Pedido[];
  configuracao?: ConfiguracaoLoja;
  fotos?: FotoEnviada[];
}

export type Loja = ReturnType<typeof criarLoja>;

/**
 * `arquivo`: onde os dados ficam (db.json). `semente`: cópia inicial (db.seed.json), usada se
 * o arquivo ainda não existir. Com `arquivo` = null, fica só na memória (testes).
 */
export function abrirLoja(arquivo: string | null, semente: string) {
  if (arquivo && !existsSync(arquivo)) copyFileSync(semente, arquivo);
  const lerSemente = (): Dados => JSON.parse(readFileSync(semente, "utf8"));
  let ultimo = readFileSync(arquivo ?? semente, "utf8");
  return criarLoja(JSON.parse(ultimo), {
    async gravar(dados) {
      const json = JSON.stringify(dados, null, 2);
      if (arquivo) writeFileSync(arquivo, json);
      ultimo = json;
    },
    recarregar: () => JSON.parse(ultimo),
    lerSemente,
  });
}

interface Persistencia {
  /** Grava o estado depois de cada alteração. Se falhar, a alteração não vale. */
  gravar(dados: Dados): Promise<void>;
  /** O último estado gravado (para desfazer em memória uma alteração que não foi gravada). */
  recarregar(): Dados;
  lerSemente(): Dados;
}

function criarLoja(inicial: Dados, persistencia: Persistencia) {
  let dados = inicial;
  let fila: Promise<unknown> = Promise.resolve();

  /**
   * Executa `alterar` sozinho na fila e grava no fim. Pode ser assíncrono (o checkout
   * espera o Módulo 05 responder): enquanto isso, as outras alterações aguardam a vez.
   * Se `alterar` lançar erro ou a gravação falhar, a memória volta ao último estado gravado e o erro sobe.
   */
  function alterarEmFila<T>(alterar: (d: Dados) => T | Promise<T>): Promise<T> {
    const proxima = fila.then(async () => {
      try {
        const resultado = await alterar(dados);
        await persistencia.gravar(dados);
        return resultado;
      } catch (erro) {
        // recusada no meio ou não gravada: nada do que mudou em memória fica valendo
        dados = persistencia.recarregar();
        throw erro;
      }
    });
    fila = proxima.catch(() => undefined);
    return proxima;
  }

  return {
    listarPecas: () => dados.pecas,
    peca: (id: string) => dados.pecas.find((p) => p.id === id),
    pedido: (id: string) => dados.pedidos.find((p) => p.id === id),
    listarPedidos: () => dados.pedidos,
    configuracao: (): ConfiguracaoLoja => dados.configuracao ?? {},
    foto: (chave: string) => dados.fotos?.find((f) => f.chave === chave),
    alterarEmFila,
    novoId: () => randomBytes(6).toString("hex"),
    /** Só para os testes: volta ao conteúdo da semente (e grava). */
    restaurar() {
      dados = persistencia.lerSemente();
      return alterarEmFila(() => undefined);
    },
  };
}

/** Conexão que também abre transações (pg.Pool e o pool do pg-mem). */
export type BancoCatalogo = Consultavel & { connect(): Promise<pg.PoolClient> };

type Tabela = "pecas" | "pedidos" | "fotos";

/** Uma linha por objeto: colunas para consultar e o objeto inteiro em `dados` (JSONB). */
function linhas(d: Dados) {
  return {
    pecas: new Map(d.pecas.map((p) => [p.id, p])),
    pedidos: new Map(d.pedidos.map((p) => [p.id, p])),
    fotos: new Map((d.fotos ?? []).map((f) => [f.chave, f])),
  };
}

/**
 * Catálogo no PostgreSQL (schema `catalogo`, fora do `public`, que o Supabase publica pela API REST).
 * Na primeira vez, com as tabelas vazias, copia a semente. Depois de cada alteração grava, numa
 * transação, só as linhas que mudaram. As fotos têm o vínculo com a peça em coluna (`peca_id`, com
 * chave estrangeira): uma foto nunca aponta para uma peça que não existe.
 */
export async function abrirLojaBanco(db: BancoCatalogo, semente: string, schema = "catalogo") {
  const s = validarSchema(schema);
  // as tabelas já existem? (o pg-mem não aceita CREATE TABLE IF NOT EXISTS de uma tabela que já existe)
  const existe = await db.query(`SELECT 1 FROM ${s}.configuracao LIMIT 1`).then(
    () => true,
    () => false,
  );
  if (!existe) await criarTabelas(db, s);

  const lerSemente = (): Dados => JSON.parse(readFileSync(semente, "utf8"));

  async function ler(): Promise<Dados> {
    const pecas = await db.query<{ dados: Peca }>(`SELECT dados FROM ${s}.pecas ORDER BY ordem`);
    const pedidos = await db.query<{ dados: Pedido }>(`SELECT dados FROM ${s}.pedidos ORDER BY ordem`);
    const fotos = await db.query<{ chave: string; usuaria_id: string; tipo: string; criada_em: Date | string; enviada_em: Date | string | null; peca_id: string | null }>(
      `SELECT chave, usuaria_id, tipo, criada_em, enviada_em, peca_id FROM ${s}.fotos ORDER BY ordem`,
    );
    const config = await db.query<{ dados: ConfiguracaoLoja }>(`SELECT dados FROM ${s}.configuracao WHERE id = 1`);
    const data = (v: Date | string | null) => (v === null ? null : new Date(v).toISOString());
    return {
      pecas: pecas.rows.map((r) => r.dados),
      pedidos: pedidos.rows.map((r) => r.dados),
      fotos: fotos.rows.map((r) => ({
        chave: r.chave,
        usuariaId: r.usuaria_id,
        tipo: r.tipo,
        criadaEm: data(r.criada_em)!,
        enviadaEm: data(r.enviada_em),
        pecaId: r.peca_id,
      })),
      ...(config.rows[0] ? { configuracao: config.rows[0].dados } : {}),
    };
  }

  // o que está no banco, linha a linha (JSON), para gravar só o que mudou
  let gravado = { pecas: new Map<string, string>(), pedidos: new Map<string, string>(), fotos: new Map<string, string>(), configuracao: "" };
  const ordem = { pecas: new Map<string, number>(), pedidos: new Map<string, number>(), fotos: new Map<string, number>() };
  let ultimoEstado: string;

  function lembrar(d: Dados) {
    const l = linhas(d);
    gravado = {
      pecas: new Map([...l.pecas].map(([id, v]) => [id, JSON.stringify(v)])),
      pedidos: new Map([...l.pedidos].map(([id, v]) => [id, JSON.stringify(v)])),
      fotos: new Map([...l.fotos].map(([id, v]) => [id, JSON.stringify(v)])),
      configuracao: JSON.stringify(d.configuracao ?? null),
    };
    ultimoEstado = JSON.stringify(d);
  }

  async function gravar(d: Dados) {
    const atual = linhas(d);
    const mudou = <K extends Tabela>(t: K) =>
      [...(atual[t] as Map<string, ReturnType<typeof linhas>[K] extends Map<string, infer V> ? V : never>)].filter(
        ([id, v]) => gravado[t].get(id) !== JSON.stringify(v),
      );
    const saiu = (t: Tabela) => [...gravado[t].keys()].filter((id) => !atual[t].has(id));
    const config = JSON.stringify(d.configuracao ?? null);
    const pecas = mudou("pecas");
    const pedidos = mudou("pedidos");
    const fotos = mudou("fotos");
    const [pecasSairam, pedidosSairam, fotosSairam] = [saiu("pecas"), saiu("pedidos"), saiu("fotos")];
    if (!pecas.length && !pedidos.length && !fotos.length && !pecasSairam.length && !pedidosSairam.length && !fotosSairam.length && config === gravado.configuracao) return;

    const novaOrdem = { pecas: new Map(ordem.pecas), pedidos: new Map(ordem.pedidos), fotos: new Map(ordem.fotos) };
    const posicao = (t: Tabela, id: string) => {
      if (!novaOrdem[t].has(id)) novaOrdem[t].set(id, Math.max(0, ...novaOrdem[t].values()) + 1);
      return novaOrdem[t].get(id)!;
    };

    const cliente = await db.connect();
    try {
      await cliente.query("BEGIN");
      // ordem por causa da chave estrangeira: fotos que saem antes das peças; peças novas antes das fotos
      for (const chave of fotosSairam) await cliente.query(`DELETE FROM ${s}.fotos WHERE chave = $1`, [chave]);
      for (const [id, p] of pecas) {
        await cliente.query(
          `INSERT INTO ${s}.pecas (id, ordem, vendedora_id, status, reservada_ate, dados) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
           ON CONFLICT (id) DO UPDATE SET vendedora_id = EXCLUDED.vendedora_id, status = EXCLUDED.status,
             reservada_ate = EXCLUDED.reservada_ate, dados = EXCLUDED.dados`,
          [id, posicao("pecas", id), p.vendedoraId ?? null, p.status, p.reservadaAte ?? null, JSON.stringify(p)],
        );
      }
      for (const [chave, f] of fotos) {
        await cliente.query(
          `INSERT INTO ${s}.fotos (chave, ordem, usuaria_id, tipo, criada_em, enviada_em, peca_id) VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (chave) DO UPDATE SET enviada_em = EXCLUDED.enviada_em, peca_id = EXCLUDED.peca_id`,
          [chave, posicao("fotos", chave), f.usuariaId, f.tipo, f.criadaEm, f.enviadaEm, f.pecaId],
        );
      }
      for (const id of pecasSairam) await cliente.query(`DELETE FROM ${s}.pecas WHERE id = $1`, [id]);
      for (const [id, p] of pedidos) {
        await cliente.query(
          `INSERT INTO ${s}.pedidos (id, ordem, compradora_id, status, dados) VALUES ($1, $2, $3, $4, $5::jsonb)
           ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, dados = EXCLUDED.dados`,
          [id, posicao("pedidos", id), p.compradoraId ?? null, p.status, JSON.stringify(p)],
        );
      }
      for (const id of pedidosSairam) await cliente.query(`DELETE FROM ${s}.pedidos WHERE id = $1`, [id]);
      if (config !== gravado.configuracao) {
        await cliente.query(
          `INSERT INTO ${s}.configuracao (id, dados) VALUES (1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET dados = EXCLUDED.dados`,
          [JSON.stringify(d.configuracao ?? {})],
        );
      }
      await cliente.query("COMMIT");
    } catch (erro) {
      await cliente.query("ROLLBACK").catch(() => undefined);
      throw erro;
    } finally {
      cliente.release();
    }
    for (const t of ["pecas", "pedidos", "fotos"] as const) {
      for (const id of saiu(t)) novaOrdem[t].delete(id);
      ordem[t] = novaOrdem[t];
    }
    lembrar(d);
  }

  // a linha de configuração marca que o catálogo já foi iniciado: um catálogo esvaziado não volta à semente
  const iniciado = (await db.query(`SELECT 1 FROM ${s}.configuracao WHERE id = 1`)).rows.length > 0;
  let inicial = await ler();
  lembrar(inicial);
  for (const t of ["pecas", "pedidos", "fotos"] as const) [...linhas(inicial)[t].keys()].forEach((id, i) => ordem[t].set(id, i + 1));
  if (!iniciado) {
    // primeira vez: o catálogo começa com a semente (as peças de demonstração)
    inicial = { configuracao: {}, ...lerSemente() };
    await gravar(inicial);
  }

  return criarLoja(inicial, { gravar, recarregar: () => JSON.parse(ultimoEstado), lerSemente });
}

async function criarTabelas(db: Consultavel, s: string) {
  await db.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${s}.pecas (
      id TEXT PRIMARY KEY,
      ordem INTEGER NOT NULL,
      vendedora_id TEXT,
      status TEXT NOT NULL,
      reservada_ate TIMESTAMPTZ,
      dados JSONB NOT NULL
    )`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${s}.pedidos (
      id TEXT PRIMARY KEY,
      ordem INTEGER NOT NULL,
      compradora_id TEXT,
      status TEXT NOT NULL,
      dados JSONB NOT NULL
    )`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${s}.fotos (
      chave TEXT PRIMARY KEY,
      ordem INTEGER NOT NULL,
      usuaria_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      criada_em TIMESTAMPTZ NOT NULL,
      enviada_em TIMESTAMPTZ,
      peca_id TEXT REFERENCES ${s}.pecas(id)
    )`);
  await db.query(`CREATE TABLE IF NOT EXISTS ${s}.configuracao (id INTEGER PRIMARY KEY, dados JSONB NOT NULL)`);
  await db.query(`CREATE INDEX IF NOT EXISTS pecas_vendedora ON ${s}.pecas (vendedora_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS fotos_peca ON ${s}.fotos (peca_id)`);
}
