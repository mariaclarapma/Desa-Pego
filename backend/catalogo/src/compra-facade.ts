import { categoriaPermitida } from "../../comum/categorias.js";
import type { GestaoPedidos } from "./gestao.js";
import type { Loja, Peca, Pedido } from "./loja.js";
import { pixSimulado, Recusa, statusAtual } from "./regras.js";

/** O que o checkout manda (já validado pela rota). Preço, frete e total são calculados aqui. */
export interface DadosCompra {
  comprador: { nome: string; email: string };
  endereco: Record<string, string | undefined>;
  itens: string[];
}

const INDISPONIVEL = "não conseguimos registrar o pedido agora. tente de novo em instantes.";

/**
 * Facade da compra (issue #31). O checkout e o webhook do Pix falam só com esta classe, que
 * coordena os subsistemas para que a compra feita no site chegue ao Módulo 05:
 *   - catálogo (Loja): reserva, peças vendidas e o pedido com o Pix;
 *   - serviço de pedidos (GestaoPedidos): um pedido por vendedora, carteira e comissão;
 *   - Pix (simulado): código copia-e-cola e prazo.
 *
 * Regras:
 *   - só fecha o pedido quem reservou as peças, e ninguém compra a própria peça;
 *   - a sacola pode ter peças de várias vendedoras: cada uma vira um pedido no Módulo 05 e
 *     cobra o seu frete fixo (cada vendedora envia a sua parte); o Pix é um só, com o total;
 *   - a ordem das operações permite repetir: o Módulo 05 é avisado antes de o catálogo mudar,
 *     então, se ele falhar, nada muda aqui e a próxima tentativa refaz tudo (o Módulo 05 é
 *     idempotente na confirmação e no cancelamento).
 */
export class CompraFacade {
  constructor(
    private readonly loja: Loja,
    private readonly gestao: GestaoPedidos | null,
    private readonly regras: { frete: () => number; agora: () => number },
  ) {}

  /** Checkout: cria os pedidos no Módulo 05 e, só se todos entrarem, o pedido com o Pix. */
  criarCompra(compradoraId: string, dados: DadosCompra): Promise<Pedido> {
    const gestao = this.exigirGestao();
    return this.loja.alterarEmFila(async () => {
      const agora = this.regras.agora();
      const pecas = [...new Set(dados.itens)].map((pecaId) => this.pecaDaCompradora(pecaId, compradoraId, agora));

      const porVendedora = new Map<string, Peca[]>();
      for (const p of pecas) porVendedora.set(p.vendedoraId!, [...(porVendedora.get(p.vendedoraId!) ?? []), p]);

      const frete = this.regras.frete();
      const endereco = Object.fromEntries(Object.entries(dados.endereco).filter(([, v]) => v !== undefined)) as Record<string, string>;
      const criados: NonNullable<Pedido["pedidosGestao"]> = [];
      try {
        for (const [vendedoraId, grupo] of porVendedora) {
          const { id } = await gestao.criar({
            compradoraId,
            vendedoraId,
            itens: grupo.map((p) => ({
              id: p.id,
              titulo: p.titulo,
              precoCentavos: p.precoCentavos,
              ...(categoriaPermitida(p.categoria) ? { categoria: p.categoria } : {}),
            })),
            freteCentavos: frete,
            endereco,
          });
          criados.push({ vendedoraId, pedidoId: id });
        }
      } catch (erro) {
        // não deixa pedido pela metade no Módulo 05: cancela os que já tinham entrado
        await Promise.allSettled(criados.map((c) => gestao.expirar(c.pedidoId)));
        console.error("[catalogo] checkout: o serviço de pedidos recusou ou não respondeu:", erro);
        throw new Recusa(502, INDISPONIVEL);
      }

      const subtotal = pecas.reduce((soma, p) => soma + p.precoCentavos, 0);
      const freteTotal = frete * porVendedora.size;
      const novoId = this.loja.novoId();
      const novo: Pedido = {
        id: novoId,
        compradoraId,
        comprador: dados.comprador,
        endereco: dados.endereco,
        itens: pecas.map((p) => ({ id: p.id, titulo: p.titulo, precoCentavos: p.precoCentavos, vendedoraId: p.vendedoraId })),
        subtotalCentavos: subtotal,
        freteCentavos: freteTotal,
        totalCentavos: subtotal + freteTotal,
        status: "aguardando_pagamento",
        pixCopiaECola: pixSimulado(subtotal + freteTotal, novoId),
        pixExpiraEm: pecas.map((p) => p.reservadaAte!).sort()[0],
        criadoEm: new Date(agora).toISOString(),
        pedidosGestao: criados,
      };
      this.loja.listarPedidos().push(novo);
      return novo;
    });
  }

  /**
   * Webhook do Pix: avisa o Módulo 05 (a venda entra na carteira) e marca as peças como
   * vendidas. Idempotente: confirmar de novo devolve o pedido como está.
   */
  async confirmarPagamento(pedidoId: string): Promise<Pedido> {
    const pedido = await this.loja.alterarEmFila(async () => {
      const p = this.loja.pedido(pedidoId);
      if (!p) throw new Recusa(404, "pedido não encontrado.");
      if (p.status !== "aguardando_pagamento") return { ...p };
      if (this.vencido(p)) {
        await this.cancelar(p);
        return { ...p };
      }

      await this.avisar(p, (g, id) => g.confirmarPagamento(id));
      p.status = "pago";
      p.pagoEm = new Date(this.regras.agora()).toISOString();
      for (const item of p.itens) {
        const peca = this.loja.peca(item.id);
        if (peca) {
          peca.status = "vendida";
          peca.reservadaAte = null;
          peca.reservadaPor = null;
        }
      }
      return { ...p };
    });
    if (pedido.status === "cancelado") throw new Recusa(409, "o prazo deste Pix acabou e o pedido foi cancelado.");
    return pedido;
  }

  /**
   * Cancela os pedidos com o Pix vencido, aqui e no Módulo 05, e devolve as peças à vitrine.
   * Roda de tempos em tempos (servidor.ts). Se o Módulo 05 falhar, tenta na próxima rodada.
   */
  expirarVencidos(): Promise<number> {
    return this.loja.alterarEmFila(async () => {
      let cancelados = 0;
      for (const p of this.loja.listarPedidos()) {
        if (p.status !== "aguardando_pagamento" || !this.vencido(p)) continue;
        try {
          await this.cancelar(p);
          cancelados++;
        } catch (erro) {
          console.error(`[catalogo] não deu para cancelar o pedido ${p.id} vencido:`, erro);
        }
      }
      return cancelados;
    });
  }

  /** A peça está num pedido que ainda espera o Pix (não pode ser liberada nem vendida de novo). */
  pecaEmPedidoAberto(pecaId: string): boolean {
    return this.loja.listarPedidos().some((p) => p.status === "aguardando_pagamento" && !this.vencido(p) && p.itens.some((i) => i.id === pecaId));
  }

  private pecaDaCompradora(pecaId: string, compradoraId: string, agora: number): Peca {
    const p = this.loja.peca(pecaId);
    if (!p || p.oculta) throw new Recusa(404, "essa peça não existe mais.");
    if (statusAtual(p, agora) !== "reservada" || p.reservadaPor !== compradoraId || this.pecaEmPedidoAberto(p.id)) {
      throw new Recusa(409, `a reserva de “${p.titulo}” expirou. volte à sacola e tente de novo.`);
    }
    if (!p.vendedoraId) throw new Recusa(409, `“${p.titulo}” ainda não tem vendedora cadastrada e não pode ser vendida.`);
    if (p.vendedoraId === compradoraId) throw new Recusa(403, "você não pode comprar a sua própria peça.");
    return p;
  }

  private vencido(p: Pedido) {
    return new Date(p.pixExpiraEm).getTime() <= this.regras.agora();
  }

  private async cancelar(p: Pedido) {
    await this.avisar(p, (g, id) => g.expirar(id));
    p.status = "cancelado";
    p.canceladoEm = new Date(this.regras.agora()).toISOString();
    for (const item of p.itens) {
      const peca = this.loja.peca(item.id);
      if (peca?.status === "reservada" && peca.reservadaPor === p.compradoraId) {
        peca.status = "disponivel";
        peca.reservadaAte = null;
        peca.reservadaPor = null;
      }
    }
  }

  /** Repete a operação no Módulo 05 para cada pedido ligado a este (pedidos antigos não têm). */
  private async avisar(p: Pedido, operacao: (g: GestaoPedidos, pedidoId: string) => Promise<void>) {
    const ligados = p.pedidosGestao ?? [];
    if (ligados.length === 0) return;
    const gestao = this.exigirGestao();
    try {
      for (const g of ligados) await operacao(gestao, g.pedidoId);
    } catch (erro) {
      console.error(`[catalogo] o serviço de pedidos falhou no pedido ${p.id}:`, erro);
      throw new Recusa(502, "o serviço de pedidos não respondeu. tente de novo em instantes.");
    }
  }

  private exigirGestao(): GestaoPedidos {
    if (!this.gestao) throw new Recusa(503, "checkout indisponível: a integração com o serviço de pedidos está desligada (API_KEYS).");
    return this.gestao;
  }
}
