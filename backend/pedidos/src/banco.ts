import { randomUUID } from "node:crypto";
import type pg from "pg";
import { TABELA_PRECOS_INICIAL, type FaixaPreco } from "../../comum/precos.js";
import { conectar, iso, validarSchema } from "../../comum/postgres.js";
import { STATUS, type StatusPedido } from "./estados.js";

/**
 * Banco do Módulo 05 (schema `pedidos`, separado do de contas).
 *
 * Carteira = livro-razão (Req. 014): cada fato gera lançamentos que nunca são alterados nem
 * apagados (no Postgres, um trigger recusa UPDATE e DELETE). Cada lançamento é de uma conta:
 *   vendedora  → o dinheiro da vendedora; o saldo dela é a soma só destes
 *   comissao   → a comissão da plataforma naquela venda
 *   taxa_pix   → a taxa do Pix naquela venda
 *
 *   venda paga        → vendedora: pendente + valor; comissao e taxa_pix: + valor
 *   pedido entregue   → vendedora: pendente − valor, disponível + valor
 *   pedido cancelado  → as três contas voltam a zero (estorno, se já estava pago)
 *   repasse pago      → vendedora: disponível − valor
 *
 * Nas contas comissao e taxa_pix o valor fica em `disponivelCentavos` (pendente é sempre 0).
 */
export const CONTAS = ["vendedora", "comissao", "taxa_pix"] as const;
export type Conta = (typeof CONTAS)[number];
export interface ItemPedido {
  id: string;
  titulo: string;
  precoCentavos: number;
}

export interface Pedido {
  id: string;
  compradoraId: string;
  vendedoraId: string;
  itens: ItemPedido[];
  endereco: Record<string, string>;
  subtotalCentavos: number;
  freteCentavos: number;
  totalCentavos: number;
  /** Comissão congelada no momento da compra (pontos-base): mudar a comissão não afeta este pedido. */
  comissaoPontosBase: number;
  comissaoCentavos: number;
  /** Taxa do Pix congelada na compra (pontos-base, sobre o total cobrado). Sai da parte da vendedora. */
  taxaPixPontosBase: number;
  taxaPixCentavos: number;
  /** O que a vendedora recebe: peças + frete (quem envia é ela) − comissão − taxa do Pix. */
  vendedoraCentavos: number;
  status: StatusPedido;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Lancamento {
  id: string;
  vendedoraId: string;
  pedidoId: string | null;
  repasseId: string | null;
  conta: Conta;
  tipo: "venda" | "liberacao" | "estorno" | "repasse";
  pendenteCentavos: number;
  disponivelCentavos: number;
  criadoEm: string;
}

export interface Repasse {
  id: string;
  vendedoraId: string;
  valorCentavos: number;
  status: "SOLICITADO" | "PAGO";
  criadoEm: string;
  pagoEm: string | null;
}

export type BancoPedidos = Awaited<ReturnType<typeof abrirBancoPedidos>>;

export const COMISSAO_PADRAO_PONTOS_BASE = 1000; // 10,00%
/** Sem taxa até a administração definir uma (o Pix simulado não cobra nada). */
export const TAXA_PIX_PADRAO_PONTOS_BASE = 0;

export async function abrirBancoPedidos(url?: string, schema = "pedidos") {
  const s = validarSchema(schema);
  const { db, memoria } = await conectar(url);

  await db.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${s}.configuracao (
      chave TEXT PRIMARY KEY,
      valor INTEGER NOT NULL
    )`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${s}.pedidos (
      id TEXT PRIMARY KEY,
      compradora_id TEXT NOT NULL,
      vendedora_id TEXT NOT NULL,
      itens TEXT NOT NULL,
      endereco TEXT NOT NULL,
      subtotal_centavos INTEGER NOT NULL CHECK (subtotal_centavos >= 0),
      frete_centavos INTEGER NOT NULL CHECK (frete_centavos >= 0),
      total_centavos INTEGER NOT NULL CHECK (total_centavos >= 0),
      comissao_pontos_base INTEGER NOT NULL,
      comissao_centavos INTEGER NOT NULL,
      taxa_pix_pontos_base INTEGER NOT NULL DEFAULT 0,
      taxa_pix_centavos INTEGER NOT NULL DEFAULT 0,
      vendedora_centavos INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('AGUARDANDO_PAGAMENTO', 'PAGO', 'ENVIADO', 'ENTREGUE', 'CANCELADO')),
      criado_em TIMESTAMPTZ NOT NULL,
      atualizado_em TIMESTAMPTZ NOT NULL
    )`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${s}.repasses (
      id TEXT PRIMARY KEY,
      vendedora_id TEXT NOT NULL,
      valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
      status TEXT NOT NULL CHECK (status IN ('SOLICITADO', 'PAGO')),
      criado_em TIMESTAMPTZ NOT NULL,
      pago_em TIMESTAMPTZ
    )`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${s}.lancamentos (
      id TEXT PRIMARY KEY,
      vendedora_id TEXT NOT NULL,
      pedido_id TEXT,
      repasse_id TEXT,
      conta TEXT NOT NULL DEFAULT 'vendedora' CHECK (conta IN ('vendedora', 'comissao', 'taxa_pix')),
      tipo TEXT NOT NULL CHECK (tipo IN ('venda', 'liberacao', 'estorno', 'repasse')),
      pendente_centavos INTEGER NOT NULL,
      disponivel_centavos INTEGER NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL
    )`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${s}.precos_sugeridos (
      categoria TEXT NOT NULL,
      condicao TEXT NOT NULL,
      minimo_centavos INTEGER NOT NULL CHECK (minimo_centavos > 0),
      maximo_centavos INTEGER NOT NULL CHECK (maximo_centavos >= minimo_centavos),
      PRIMARY KEY (categoria, condicao)
    )`);
  await db.query(`CREATE INDEX IF NOT EXISTS pedidos_compradora ON ${s}.pedidos (compradora_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS pedidos_vendedora ON ${s}.pedidos (vendedora_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS lancamentos_vendedora ON ${s}.lancamentos (vendedora_id)`);
  if (!memoria) {
    // migração das tabelas criadas antes da taxa do Pix e das contas do livro-razão
    await db.query(`ALTER TABLE ${s}.pedidos ADD COLUMN IF NOT EXISTS taxa_pix_pontos_base INTEGER NOT NULL DEFAULT 0`);
    await db.query(`ALTER TABLE ${s}.pedidos ADD COLUMN IF NOT EXISTS taxa_pix_centavos INTEGER NOT NULL DEFAULT 0`);
    await db.query(
      `ALTER TABLE ${s}.lancamentos ADD COLUMN IF NOT EXISTS conta TEXT NOT NULL DEFAULT 'vendedora' CHECK (conta IN ('vendedora', 'comissao', 'taxa_pix'))`,
    );
    // livro-razão imutável: o próprio banco recusa alterar ou apagar um lançamento
    await db.query(`
      CREATE OR REPLACE FUNCTION ${s}.lancamento_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'lançamentos da carteira são imutáveis: registre um novo lançamento.';
      END $$`);
    await db.query(`DROP TRIGGER IF EXISTS lancamentos_imutaveis ON ${s}.lancamentos`);
    await db.query(
      `CREATE TRIGGER lancamentos_imutaveis BEFORE UPDATE OR DELETE ON ${s}.lancamentos FOR EACH ROW EXECUTE FUNCTION ${s}.lancamento_imutavel()`,
    );
    // mesma defesa do serviço de contas no Supabase: a API REST automática não lê nada daqui
    for (const t of ["configuracao", "pedidos", "repasses", "lancamentos", "precos_sugeridos"]) {
      await db.query(`ALTER TABLE ${s}.${t} ENABLE ROW LEVEL SECURITY`);
    }
  }

  const pedido = (r: pg.QueryResultRow): Pedido => ({
    id: r.id,
    compradoraId: r.compradora_id,
    vendedoraId: r.vendedora_id,
    itens: JSON.parse(r.itens),
    endereco: JSON.parse(r.endereco),
    subtotalCentavos: Number(r.subtotal_centavos),
    freteCentavos: Number(r.frete_centavos),
    totalCentavos: Number(r.total_centavos),
    comissaoPontosBase: Number(r.comissao_pontos_base),
    comissaoCentavos: Number(r.comissao_centavos),
    taxaPixPontosBase: Number(r.taxa_pix_pontos_base),
    taxaPixCentavos: Number(r.taxa_pix_centavos),
    vendedoraCentavos: Number(r.vendedora_centavos),
    status: r.status,
    criadoEm: iso(r.criado_em)!,
    atualizadoEm: iso(r.atualizado_em)!,
  });
  const lancamento = (r: pg.QueryResultRow): Lancamento => ({
    id: r.id,
    vendedoraId: r.vendedora_id,
    pedidoId: r.pedido_id,
    repasseId: r.repasse_id,
    conta: r.conta,
    tipo: r.tipo,
    pendenteCentavos: Number(r.pendente_centavos),
    disponivelCentavos: Number(r.disponivel_centavos),
    criadoEm: iso(r.criado_em)!,
  });
  const repasse = (r: pg.QueryResultRow): Repasse => ({
    id: r.id,
    vendedoraId: r.vendedora_id,
    valorCentavos: Number(r.valor_centavos),
    status: r.status,
    criadoEm: iso(r.criado_em)!,
    pagoEm: iso(r.pago_em),
  });

  /**
   * Fila: uma alteração de cada vez. Conferir o saldo e lançar o débito, ou conferir o status
   * e mudar, acontecem juntos, sem outra operação no meio (o serviço roda numa instância só).
   */
  let fila: Promise<unknown> = Promise.resolve();
  function emFila<T>(operacao: () => Promise<T>): Promise<T> {
    const proxima = fila.then(operacao);
    fila = proxima.catch(() => undefined);
    return proxima;
  }

  const agora = () => new Date().toISOString();
  // o status entra no SQL só depois de conferido contra a lista fixa (nunca texto livre)
  const filtroStatus = (status?: StatusPedido) => {
    if (!status) return "";
    if (!STATUS.includes(status)) throw new Error(`status inválido: ${status}`);
    return ` AND status = '${status}'`;
  };

  async function lancar(l: Omit<Lancamento, "id" | "criadoEm" | "conta"> & { conta?: Conta }) {
    await db.query(
      `INSERT INTO ${s}.lancamentos (id, vendedora_id, pedido_id, repasse_id, conta, tipo, pendente_centavos, disponivel_centavos, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [randomUUID(), l.vendedoraId, l.pedidoId, l.repasseId, l.conta ?? "vendedora", l.tipo, l.pendenteCentavos, l.disponivelCentavos, agora()],
    );
  }

  async function lerConfig(chave: string, padrao: number) {
    const { rows } = await db.query(`SELECT valor FROM ${s}.configuracao WHERE chave = $1`, [chave]);
    return rows[0] ? Number(rows[0].valor) : padrao;
  }
  async function gravarConfig(chave: string, valor: number) {
    await db.query(`DELETE FROM ${s}.configuracao WHERE chave = $1`, [chave]);
    await db.query(`INSERT INTO ${s}.configuracao (chave, valor) VALUES ($1, $2)`, [chave, valor]);
  }

  return {
    emFila,

    comissaoAtual: () => lerConfig("comissao_pontos_base", COMISSAO_PADRAO_PONTOS_BASE),
    definirComissao: (pontosBase: number) => gravarConfig("comissao_pontos_base", pontosBase),
    taxaPixAtual: () => lerConfig("taxa_pix_pontos_base", TAXA_PIX_PADRAO_PONTOS_BASE),
    definirTaxaPix: (pontosBase: number) => gravarConfig("taxa_pix_pontos_base", pontosBase),

    /** A tabela que a administração definiu ou, se ela ainda não definiu, a inicial. */
    async precosSugeridos(): Promise<FaixaPreco[]> {
      const { rows } = await db.query(`SELECT * FROM ${s}.precos_sugeridos ORDER BY categoria, condicao`);
      if (rows.length === 0) return TABELA_PRECOS_INICIAL;
      return rows.map((r) => ({
        categoria: r.categoria,
        condicao: r.condicao,
        minimoCentavos: Number(r.minimo_centavos),
        maximoCentavos: Number(r.maximo_centavos),
      }));
    },
    /** Troca a tabela inteira (chame dentro da fila). */
    async definirPrecosSugeridos(faixas: FaixaPreco[]) {
      await db.query(`DELETE FROM ${s}.precos_sugeridos`);
      for (const f of faixas) {
        await db.query(`INSERT INTO ${s}.precos_sugeridos (categoria, condicao, minimo_centavos, maximo_centavos) VALUES ($1, $2, $3, $4)`, [
          f.categoria,
          f.condicao,
          f.minimoCentavos,
          f.maximoCentavos,
        ]);
      }
    },

    async inserirPedido(p: Omit<Pedido, "criadoEm" | "atualizadoEm">) {
      const t = agora();
      await db.query(
        `INSERT INTO ${s}.pedidos (id, compradora_id, vendedora_id, itens, endereco, subtotal_centavos, frete_centavos, total_centavos,
           comissao_pontos_base, comissao_centavos, vendedora_centavos, status, criado_em, atualizado_em, taxa_pix_pontos_base, taxa_pix_centavos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          p.id,
          p.compradoraId,
          p.vendedoraId,
          JSON.stringify(p.itens),
          JSON.stringify(p.endereco),
          p.subtotalCentavos,
          p.freteCentavos,
          p.totalCentavos,
          p.comissaoPontosBase,
          p.comissaoCentavos,
          p.vendedoraCentavos,
          p.status,
          t,
          t,
          p.taxaPixPontosBase,
          p.taxaPixCentavos,
        ],
      );
      return { ...p, criadoEm: t, atualizadoEm: t };
    },
    async pedido(id: string) {
      const { rows } = await db.query(`SELECT * FROM ${s}.pedidos WHERE id = $1`, [id]);
      return rows[0] ? pedido(rows[0]) : undefined;
    },
    async mudarStatus(id: string, status: StatusPedido) {
      await db.query(`UPDATE ${s}.pedidos SET status = $1, atualizado_em = $2 WHERE id = $3`, [status, agora(), id]);
    },
    async pedidosDe(papel: "compradora" | "vendedora", usuariaId: string, status?: StatusPedido) {
      const coluna = papel === "compradora" ? "compradora_id" : "vendedora_id";
      const { rows } = await db.query(`SELECT * FROM ${s}.pedidos WHERE ${coluna} = $1${filtroStatus(status)} ORDER BY criado_em DESC`, [usuariaId]);
      return rows.map(pedido);
    },
    async todosPedidos(status?: StatusPedido) {
      const { rows } = await db.query(`SELECT * FROM ${s}.pedidos WHERE 1 = 1${filtroStatus(status)} ORDER BY criado_em DESC`);
      return rows.map(pedido);
    },

    lancar,
    async saldo(vendedoraId: string) {
      const { rows } = await db.query(
        `SELECT COALESCE(SUM(pendente_centavos), 0) AS pendente, COALESCE(SUM(disponivel_centavos), 0) AS disponivel
         FROM ${s}.lancamentos WHERE vendedora_id = $1 AND conta = 'vendedora'`,
        [vendedoraId],
      );
      const { rows: saque } = await db.query(
        `SELECT COALESCE(SUM(valor_centavos), 0) AS total FROM ${s}.repasses WHERE vendedora_id = $1 AND status = 'SOLICITADO'`,
        [vendedoraId],
      );
      const disponivel = Number(rows[0].disponivel);
      const emSaque = Number(saque[0].total);
      return { pendenteCentavos: Number(rows[0].pendente), disponivelCentavos: disponivel, emSaqueCentavos: emSaque, podeSacarCentavos: disponivel - emSaque };
    },
    /** Todos os lançamentos das vendas dela, inclusive comissão e taxa (para ela ver de onde vem cada valor). */
    async extrato(vendedoraId: string) {
      const { rows } = await db.query(`SELECT * FROM ${s}.lancamentos WHERE vendedora_id = $1 ORDER BY criado_em DESC`, [vendedoraId]);
      return rows.map(lancamento);
    },

    async criarRepasse(vendedoraId: string, valorCentavos: number) {
      const r: Repasse = { id: randomUUID(), vendedoraId, valorCentavos, status: "SOLICITADO", criadoEm: agora(), pagoEm: null };
      await db.query(`INSERT INTO ${s}.repasses (id, vendedora_id, valor_centavos, status, criado_em) VALUES ($1, $2, $3, $4, $5)`, [
        r.id,
        r.vendedoraId,
        r.valorCentavos,
        r.status,
        r.criadoEm,
      ]);
      return r;
    },
    async repasse(id: string) {
      const { rows } = await db.query(`SELECT * FROM ${s}.repasses WHERE id = $1`, [id]);
      return rows[0] ? repasse(rows[0]) : undefined;
    },
    async marcarRepassePago(id: string) {
      const t = agora();
      await db.query(`UPDATE ${s}.repasses SET status = 'PAGO', pago_em = $1 WHERE id = $2`, [t, id]);
      return t;
    },
    async repasses(filtro: { vendedoraId?: string; status?: Repasse["status"] } = {}) {
      const condicoes = ["1 = 1"];
      const valores: unknown[] = [];
      if (filtro.vendedoraId) {
        valores.push(filtro.vendedoraId);
        condicoes.push(`vendedora_id = $${valores.length}`);
      }
      if (filtro.status) {
        valores.push(filtro.status);
        condicoes.push(`status = $${valores.length}`);
      }
      const { rows } = await db.query(`SELECT * FROM ${s}.repasses WHERE ${condicoes.join(" AND ")} ORDER BY criado_em DESC`, valores);
      return rows.map(repasse);
    },

    /** Painel: totais por status, vendas e repasses (em centavos). */
    async resumo() {
      const { rows: porStatus } = await db.query(`SELECT status, COUNT(*) AS quantidade FROM ${s}.pedidos GROUP BY status`);
      const { rows: vendas } = await db.query(
        `SELECT COUNT(*) AS quantidade, COALESCE(SUM(total_centavos), 0) AS total, COALESCE(SUM(comissao_centavos), 0) AS comissao,
           COALESCE(SUM(taxa_pix_centavos), 0) AS taxa
         FROM ${s}.pedidos WHERE status IN ('PAGO', 'ENVIADO', 'ENTREGUE')`,
      );
      const { rows: rep } = await db.query(
        `SELECT status, COUNT(*) AS quantidade, COALESCE(SUM(valor_centavos), 0) AS total FROM ${s}.repasses GROUP BY status`,
      );
      return {
        pedidosPorStatus: Object.fromEntries(porStatus.map((r) => [r.status, Number(r.quantidade)])),
        vendas: {
          quantidade: Number(vendas[0].quantidade),
          totalCentavos: Number(vendas[0].total),
          comissaoCentavos: Number(vendas[0].comissao),
          taxaPixCentavos: Number(vendas[0].taxa),
        },
        repasses: Object.fromEntries(rep.map((r) => [r.status, { quantidade: Number(r.quantidade), totalCentavos: Number(r.total) }])),
      };
    },

    /** Só para os testes. */
    async limpar() {
      // no Postgres o trigger recusa DELETE nos lançamentos; TRUNCATE não passa por ele
      const apagar = memoria ? "DELETE FROM" : "TRUNCATE";
      for (const t of ["lancamentos", "repasses", "pedidos", "configuracao", "precos_sugeridos"]) await db.query(`${apagar} ${s}.${t}`);
    },
    async apagarSchema() {
      if (!memoria) await db.query(`DROP SCHEMA IF EXISTS ${s} CASCADE`);
    },
    fechar: () => db.end(),
  };
}
