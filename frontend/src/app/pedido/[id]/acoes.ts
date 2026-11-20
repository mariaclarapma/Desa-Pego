"use server";

import type { Pedido } from "@/types/pedido";

/**
 * Botão "simular pagamento" (demonstração). Roda no servidor do Next.js e chama a rota de
 * integração do catálogo, que faz o papel do webhook do Mercado Pago. A API key fica só no
 * servidor (API_KEYS do .env): nunca vai para o navegador.
 */
export async function confirmarPagamentoDemo(pedidoId: string): Promise<Pedido> {
  if (!/^[\w-]{1,80}$/.test(pedidoId)) throw new Error("pedido inválido.");
  const chave = (process.env.API_KEYS ?? "").split(",")[0]?.trim();
  if (!chave) throw new Error("pagamento de demonstração desligado: defina API_KEYS no .env.");

  const base = process.env.CATALOGO_API_URL ?? "http://localhost:3001";
  const resposta = await fetch(`${base}/integracao/pagamentos/${encodeURIComponent(pedidoId)}/confirmar`, {
    method: "POST",
    headers: { "X-API-Key": chave },
    cache: "no-store",
  });
  if (!resposta.ok) throw new Error("não deu para confirmar o pagamento. tente de novo.");
  return (await resposta.json()) as Pedido;
}
