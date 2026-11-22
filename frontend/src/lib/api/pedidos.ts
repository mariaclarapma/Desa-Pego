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

const comToken = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * Cria o pedido aguardando pagamento, com a cobrança Pix (PixSimuladoProvider). Exige login:
 * o servidor também cria um pedido por vendedora no Módulo 05 (minhas compras e vendas).
 */
export const criarPedido = (token: string, dados: NovoPedido) => api<Pedido>("/pedidos", { method: "POST", json: dados, headers: comToken(token) });

/** Só a compradora consegue ver o pedido. */
export const buscarPedido = (token: string, id: string) => api<Pedido>(`/pedidos/${encodeURIComponent(id)}`, { headers: comToken(token) });
