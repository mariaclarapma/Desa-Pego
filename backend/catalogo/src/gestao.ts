/**
 * Cliente das rotas internas do serviço de pedidos (Módulo 05), usadas pelo checkout:
 *   POST /interno/pedidos                          → cria o pedido (comissão e taxa congeladas lá)
 *   POST /interno/pedidos/{id}/pagamento-confirmado → venda paga: entra na carteira
 *   POST /interno/pedidos/{id}/expirar             → Pix vencido: cancela o pedido
 * Todas exigem X-API-Key. As duas últimas são idempotentes no Módulo 05.
 */
export interface NovoPedidoGestao {
  compradoraId: string;
  vendedoraId: string;
  itens: { id: string; titulo: string; precoCentavos: number; categoria?: string }[];
  freteCentavos: number;
  endereco: Record<string, string>;
}

export interface GestaoPedidos {
  criar(dados: NovoPedidoGestao): Promise<{ id: string }>;
  confirmarPagamento(pedidoId: string): Promise<void>;
  expirar(pedidoId: string): Promise<void>;
}

/** O Módulo 05 recusou ou não respondeu. */
export class FalhaGestao extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export function gestaoPorHttp(opcoes: { baseUrl: string; apiKey: string; timeoutMs?: number; fetch?: typeof fetch }): GestaoPedidos {
  const buscar = opcoes.fetch ?? fetch;
  const base = opcoes.baseUrl.replace(/\/+$/, "");

  async function chamar<T>(caminho: string, corpo?: unknown): Promise<T> {
    let resposta: Response;
    try {
      resposta = await buscar(`${base}/interno${caminho}`, {
        method: "POST",
        headers: { "X-API-Key": opcoes.apiKey, ...(corpo === undefined ? {} : { "Content-Type": "application/json" }) },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(opcoes.timeoutMs ?? 5000),
      });
    } catch {
      throw new FalhaGestao(0, "o serviço de pedidos não respondeu.");
    }
    if (!resposta.ok) {
      const dados = (await resposta.json().catch(() => null)) as { erro?: string } | null;
      throw new FalhaGestao(resposta.status, dados?.erro ?? `o serviço de pedidos respondeu ${resposta.status}.`);
    }
    return (await resposta.json()) as T;
  }

  const id = (pedidoId: string) => encodeURIComponent(pedidoId);
  return {
    criar: (dados) => chamar<{ id: string }>("/pedidos", dados),
    confirmarPagamento: async (pedidoId) => {
      await chamar(`/pedidos/${id(pedidoId)}/pagamento-confirmado`);
    },
    expirar: async (pedidoId) => {
      await chamar(`/pedidos/${id(pedidoId)}/expirar`);
    },
  };
}
