import { chamarComToken } from "./autenticado";

/**
 * Compras e vendas da usuária logada (Req. 013), servidas pelo serviço de pedidos do
 * Módulo 05 (/api/gestao). Quem decide o que cada uma pode fazer é o backend: a tela só
 * mostra os botões que fazem sentido.
 */
export type StatusPedido = "AGUARDANDO_PAGAMENTO" | "PAGO" | "ENVIADO" | "ENTREGUE" | "CANCELADO";
export type Papel = "compradora" | "vendedora";

export const STATUS_PEDIDO: StatusPedido[] = ["AGUARDANDO_PAGAMENTO", "PAGO", "ENVIADO", "ENTREGUE", "CANCELADO"];

/** Textos da linha do tempo, do ponto de vista de quem compra e de quem vende. */
export const TEXTO_STATUS: Record<StatusPedido, string> = {
  AGUARDANDO_PAGAMENTO: "aguardando pagamento",
  PAGO: "pago",
  ENVIADO: "enviado",
  ENTREGUE: "recebido",
  CANCELADO: "cancelado",
};

export interface ItemDoPedido {
  id: string;
  titulo: string;
  precoCentavos: number;
}

export interface PedidoDaConta {
  id: string;
  compradoraId: string;
  vendedoraId: string;
  itens: ItemDoPedido[];
  /** Só vem nas vendas: o endereço de entrega aparece apenas para a vendedora (Req. 013). */
  endereco?: Record<string, string>;
  subtotalCentavos: number;
  freteCentavos: number;
  totalCentavos: number;
  comissaoCentavos: number;
  vendedoraCentavos: number;
  status: StatusPedido;
  criadoEm: string;
  atualizadoEm: string;
}

const filtro = (status?: StatusPedido) => (status ? `?status=${status}` : "");

export const meusPedidos = {
  listar: (token: string, papel: Papel, status?: StatusPedido) =>
    chamarComToken<{ pedidos: PedidoDaConta[] }>(token, "GET", `/gestao/pedidos/${papel === "compradora" ? "compras" : "vendas"}${filtro(status)}`),
  /** Vendedora: PAGO → ENVIADO. */
  enviar: (token: string, id: string) => chamarComToken<PedidoDaConta>(token, "POST", `/gestao/pedidos/${encodeURIComponent(id)}/enviar`),
  /** Compradora: ENVIADO → ENTREGUE (libera o dinheiro da vendedora). */
  confirmarRecebimento: (token: string, id: string) =>
    chamarComToken<PedidoDaConta>(token, "POST", `/gestao/pedidos/${encodeURIComponent(id)}/confirmar-recebimento`),
  /** Compradora: cancela enquanto não pagou. */
  cancelar: (token: string, id: string) => chamarComToken<PedidoDaConta>(token, "POST", `/gestao/pedidos/${encodeURIComponent(id)}/cancelar`),
};

/** A ação que a tela oferece para este papel neste status (as mesmas regras do backend). */
export function acaoDisponivel(papel: Papel, status: StatusPedido): "enviar" | "confirmar" | "cancelar" | null {
  if (papel === "vendedora" && status === "PAGO") return "enviar";
  if (papel === "compradora" && status === "ENVIADO") return "confirmar";
  if (papel === "compradora" && status === "AGUARDANDO_PAGAMENTO") return "cancelar";
  return null;
}

/** Endereço em linhas legíveis (rua e número, complemento, bairro, cidade/UF, CEP). */
export function formatarEndereco(e: Record<string, string> | undefined): string[] {
  if (!e) return [];
  const linha = (...partes: (string | undefined)[]) => partes.filter(Boolean).join(", ");
  return [
    linha(e.logradouro ?? e.rua, e.numero),
    e.complemento ?? "",
    e.bairro ?? "",
    linha(e.cidade, e.uf),
    e.cep ? `CEP ${e.cep}` : "",
  ].filter(Boolean);
}
