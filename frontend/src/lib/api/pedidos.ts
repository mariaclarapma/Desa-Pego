import type { Pedido } from "@/types/pedido";
import { marcarVendida } from "./catalogo";
import { api } from "./cliente";

export type NovoPedido = Omit<Pedido, "id" | "status" | "pixCopiaECola" | "pixExpiraEm" | "criadoEm">;

/** Gera um código no formato de Pix copia-e-cola, só para demonstração. */
function pixSimulado(totalCentavos: number): string {
  const valor = (totalCentavos / 100).toFixed(2);
  const txid = Math.random().toString(36).slice(2, 12).toUpperCase();
  return `00020126360014br.gov.bcb.pix0114DESAPEGODEMO5204000053039865405${valor}5802BR5908desaPego6008BRASILIA62140510${txid}6304DEMO`;
}

/** Cria o pedido aguardando pagamento, com a cobrança Pix (PixSimuladoProvider). */
export function criarPedido(dados: NovoPedido, expiraEm: string): Promise<Pedido> {
  return api<Pedido>("/pedidos", {
    method: "POST",
    json: {
      ...dados,
      status: "aguardando_pagamento",
      pixCopiaECola: pixSimulado(dados.totalCentavos),
      pixExpiraEm: expiraEm,
      criadoEm: new Date().toISOString(),
    },
  });
}

export const buscarPedido = (id: string) => api<Pedido>(`/pedidos/${encodeURIComponent(id)}`);

/**
 * Faz o papel do webhook do Mercado Pago: marca o pedido como pago e as peças como vendidas.
 * Idempotente: confirmar de novo um pedido já pago não muda nada.
 */
export async function confirmarPagamentoSimulado(pedido: Pedido): Promise<Pedido> {
  if (pedido.status !== "aguardando_pagamento") return pedido;
  const pago = await api<Pedido>(`/pedidos/${encodeURIComponent(pedido.id)}`, {
    method: "PATCH",
    json: { status: "pago" },
  });
  await Promise.all(pedido.itens.map((item) => marcarVendida(item.id)));
  return pago;
}
