import type { EnderecoEntrega, Pedido } from "@/types/pedido";
import { api } from "./cliente";

/**
 * Dados que o navegador manda para criar o pedido. Preço, frete, total e o código Pix são
 * calculados pelo servidor a partir do catálogo: nunca confiamos em valores vindos do navegador.
 */
export interface NovoPedido {
  comprador: { nome: string; email: string };
  endereco: EnderecoEntrega;
  /** Ids das peças reservadas na sacola. */
  itens: string[];
}

/** Cria o pedido aguardando pagamento, com a cobrança Pix (PixSimuladoProvider). */
export const criarPedido = (dados: NovoPedido) => api<Pedido>("/pedidos", { method: "POST", json: dados });

export const buscarPedido = (id: string) => api<Pedido>(`/pedidos/${encodeURIComponent(id)}`);
