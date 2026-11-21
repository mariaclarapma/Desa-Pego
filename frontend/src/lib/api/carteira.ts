import { chamarComToken } from "./autenticado";

/**
 * Carteira da vendedora (Req. 014), servida pelo serviço de pedidos (/api/gestao).
 * O saldo é calculado no backend a partir do livro-razão; a tela só mostra.
 */
export type Conta = "vendedora" | "comissao" | "taxa_pix";
export type TipoLancamento = "venda" | "liberacao" | "estorno" | "repasse";

export interface Lancamento {
  id: string;
  vendedoraId: string;
  pedidoId: string | null;
  repasseId: string | null;
  conta: Conta;
  tipo: TipoLancamento;
  pendenteCentavos: number;
  disponivelCentavos: number;
  criadoEm: string;
}

export interface Carteira {
  pendenteCentavos: number;
  disponivelCentavos: number;
  emSaqueCentavos: number;
  podeSacarCentavos: number;
  extrato: Lancamento[];
}

export interface Repasse {
  id: string;
  vendedoraId: string;
  valorCentavos: number;
  status: "SOLICITADO" | "PAGO";
  criadoEm: string;
  pagoEm: string | null;
}

export const carteira = {
  ler: (token: string) => chamarComToken<Carteira>(token, "GET", "/gestao/carteira"),
  repasses: (token: string) => chamarComToken<{ repasses: Repasse[] }>(token, "GET", "/gestao/carteira/repasses"),
  pedirRepasse: (token: string, valorCentavos: number) => chamarComToken<Repasse>(token, "POST", "/gestao/carteira/repasses", { valorCentavos }),
};

/** Valor do lançamento do ponto de vista da vendedora (comissão e taxa aparecem como desconto). */
export function valorDoLancamento(l: Lancamento): number {
  const valor = l.pendenteCentavos + l.disponivelCentavos;
  return l.conta === "vendedora" ? valor : -valor;
}

/** Texto de cada linha do extrato. */
export function descricaoDoLancamento(l: Lancamento): string {
  const pedido = l.pedidoId ? ` do pedido #${l.pedidoId.slice(0, 6)}` : "";
  if (l.conta === "comissao") return `${l.tipo === "estorno" ? "devolução da comissão" : "comissão da plataforma"}${pedido}`;
  if (l.conta === "taxa_pix") return `${l.tipo === "estorno" ? "devolução da taxa do Pix" : "taxa do Pix"}${pedido}`;
  if (l.tipo === "venda") return `venda paga${pedido} (fica pendente até a entrega)`;
  if (l.tipo === "liberacao") return `entrega confirmada${pedido}: saldo liberado`;
  if (l.tipo === "estorno") return `pedido cancelado${pedido}: valor estornado`;
  return "repasse via Pix para você";
}

/** "12,50" ou "12" (texto do campo) → 1250 centavos. Até duas casas decimais. */
export function reaisParaCentavos(texto: string): number | null {
  const semMoeda = texto.trim().replace(/^R\$\s*/, "");
  // com vírgula, os pontos são de milhar ("1.234,56"); sem vírgula, o ponto é a casa decimal ("12.5")
  const limpo = semMoeda.includes(",") ? semMoeda.replace(/\./g, "").replace(",", ".") : semMoeda;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(limpo)) return null;
  const [inteiro, fracao = ""] = limpo.split(".");
  return Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"));
}
