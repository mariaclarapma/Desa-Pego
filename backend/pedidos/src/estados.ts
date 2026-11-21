/**
 * Máquina de estados do pedido (Req. 013).
 *
 *   AGUARDANDO_PAGAMENTO ──► PAGO ──► ENVIADO ──► ENTREGUE
 *            │                 │
 *            └──► CANCELADO ◄──┘
 *
 * Cada transição tem quem pode fazê-la. Qualquer outra transição é inválida.
 */
export const STATUS = ["AGUARDANDO_PAGAMENTO", "PAGO", "ENVIADO", "ENTREGUE", "CANCELADO"] as const;
export type StatusPedido = (typeof STATUS)[number];

/** Quem age: a compradora, a vendedora, a administração ou o sistema (webhook do Pix, via API key). */
export type Ator = "compradora" | "vendedora" | "admin" | "sistema";

const TRANSICOES: Record<StatusPedido, Partial<Record<StatusPedido, Ator[]>>> = {
  AGUARDANDO_PAGAMENTO: { PAGO: ["sistema"], CANCELADO: ["compradora", "admin", "sistema"] },
  PAGO: { ENVIADO: ["vendedora"], CANCELADO: ["admin"] },
  ENVIADO: { ENTREGUE: ["compradora"] },
  ENTREGUE: {},
  CANCELADO: {},
};

export type Veredito = { ok: true } | { ok: false; motivo: "transicao-invalida" | "sem-permissao" };

/**
 * Confere uma transição. A ordem importa: primeiro se a transição existe (409 se não),
 * depois se esse ator pode fazê-la (403 se não).
 */
export function conferirTransicao(de: StatusPedido, para: StatusPedido, ator: Ator): Veredito {
  const permitidos = TRANSICOES[de][para];
  if (!permitidos) return { ok: false, motivo: "transicao-invalida" };
  if (!permitidos.includes(ator)) return { ok: false, motivo: "sem-permissao" };
  return { ok: true };
}

export const TEXTO_STATUS: Record<StatusPedido, string> = {
  AGUARDANDO_PAGAMENTO: "aguardando pagamento",
  PAGO: "pago",
  ENVIADO: "enviado",
  ENTREGUE: "entregue (recebido)",
  CANCELADO: "cancelado",
};
