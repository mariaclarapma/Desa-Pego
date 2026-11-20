import { randomUUID } from "node:crypto";
import type pg from "pg";
import { conectar, iso, validarSchema } from "../../comum/postgres.js";
import { STATUS, type StatusPedido } from "./estados.js";

/**
 * Banco do Módulo 05 (schema `pedidos`, separado do de contas).
 *
 * Carteira = livro-razão (Req. 014): cada fato gera um lançamento que nunca é alterado nem
 * apagado. O saldo é a soma dos lançamentos:
 *   venda paga        → pendente   + valor da vendedora
 *   pedido entregue   → pendente   − valor, disponível + valor
 *   pedido cancelado  → pendente   − valor (estorno, se já estava pago)
 *   repasse pago      → disponível − valor
 */
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
  /** Parte da vendedora nas peças + o frete (quem envia é ela). */
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
      tipo TEXT NOT NULL CHECK (tipo IN ('venda', 'liberacao', 'estorno', 'repasse')),
      pendente_centavos INTEGER NOT NULL,
      disponivel_centavos INTEGER NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL
    )`);
  await db.query(`CREATE INDEX IF NOT EXISTS pedidos_compradora ON ${s}.pedidos (compradora_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS pedidos_vendedora ON ${s}.pedidos (vendedora_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS lancamentos_vendedora ON ${s}.lancamentos (vendedora_id)`);
  if (!memoria) {
    // mesma defesa do serviço de contas no Supabase: a API REST automática não lê nada daqui
    for (const t of ["configuracao", "pedidos", "repasses", "lancamentos"]) await db.query(`ALTER TABLE ${s}.${t} ENABLE ROW LEVEL SECURITY`);
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

  async function lancar(l: Omit<Lancamento, "id" | "criadoEm">) {
    await db.query(
      `INSERT INTO ${s}.lancamentos (id, vendedora_id, pedido_id, repasse_id, tipo, pendente_centavos, disponivel_centavos, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [randomUUID(), l.vendedoraId, l.pedidoId, l.repasseId, l.tipo, l.pendenteCentavos, l.disponivelCentavos, agora()],
    );
  }

  return {
    emFila,

    async comissaoAtual() {
      const { rows } = await db.query(`SELECT valor FROM ${s}.configuracao WHERE chave = 'comissao_pontos_base'`);
      return rows[0] ? Number(rows[0].valor) : COMISSAO_PADRAO_PONTOS_BASE;
    },
    async definirComissao(pontosBase: number) {
      await db.query(`DELETE FROM ${s}.configuracao WHERE chave = 'comissao_pontos_base'`);
      await db.query(`INSERT INTO ${s}.configuracao (chave, valor) VALUES ('comissao_pontos_base', $1)`, [pontosBase]);
    },

    async inserirPedido(p: Omit<Pedido, "criadoEm" | "atualizadoEm">) {
      const t = agora();
      await db.query(
        `INSERT INTO ${s}.pedidos (id, compradora_id, vendedora_id, itens, endereco, subtotal_centavos, frete_centavos, total_centavos,
           comissao_pontos_base, comissao_centavos, vendedora_centavos, status, criado_em, atualizado_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
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
         FROM ${s}.lancamentos WHERE vendedora_id = $1`,
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
        `SELECT COUNT(*) AS quantidade, COALESCE(SUM(total_centavos), 0) AS total, COALESCE(SUM(comissao_centavos), 0) AS comissao
         FROM ${s}.pedidos WHERE status IN ('PAGO', 'ENVIADO', 'ENTREGUE')`,
      );
      const { rows: rep } = await db.query(
        `SELECT status, COUNT(*) AS quantidade, COALESCE(SUM(valor_centavos), 0) AS total FROM ${s}.repasses GROUP BY status`,
      );
      return {
        pedidosPorStatus: Object.fromEntries(porStatus.map((r) => [r.status, Number(r.quantidade)])),
        vendas: { quantidade: Number(vendas[0].quantidade), totalCentavos: Number(vendas[0].total), comissaoCentavos: Number(vendas[0].comissao) },
        repasses: Object.fromEntries(rep.map((r) => [r.status, { quantidade: Number(r.quantidade), totalCentavos: Number(r.total) }])),
      };
    },

    /** Só para os testes. */
    async limpar() {
      for (const t of ["lancamentos", "repasses", "pedidos", "configuracao"]) await db.query(`DELETE FROM ${s}.${t}`);
    },
    async apagarSchema() {
      if (!memoria) await db.query(`DROP SCHEMA IF EXISTS ${s} CASCADE`);
    },
    fechar: () => db.end(),
  };
}
