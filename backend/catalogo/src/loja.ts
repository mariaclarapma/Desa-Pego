import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Dados do catálogo (peças e pedidos) num arquivo JSON, como antes com o json-server.
 * Toda alteração passa por uma fila: uma de cada vez, então duas pessoas não conseguem
 * reservar a mesma peça ao mesmo tempo (o papel do UPDATE atômico do banco real, ADR-003).
 */
export type StatusPeca = "disponivel" | "reservada" | "vendida";
export type StatusPedido = "aguardando_pagamento" | "pago" | "cancelado";

export interface Peca {
  id: string;
  titulo: string;
  precoCentavos: number;
  status: StatusPeca;
  reservadaAte?: string | null;
  /** Conta que reservou (id do token): só ela libera a reserva e fecha o pedido. Nunca sai na vitrine. */
  reservadaPor?: string | null;
  /**
   * Conta da vendedora (id do serviço de contas). Quem grava é o anúncio (Módulo 02); sem ele,
   * a peça não pode ser vendida, porque o pedido do Módulo 05 precisa saber de quem é a venda.
   */
  vendedoraId?: string;
  /** Ocultada pela administração (anúncio irregular): some da vitrine, da página e da reserva. */
  oculta?: boolean;
  motivoOculta?: string | null;
  [campo: string]: unknown;
}

export interface Pedido {
  id: string;
  /** Conta da compradora (id do token). Só ela consulta o pedido. Pedidos antigos não têm. */
  compradoraId?: string;
  comprador: { nome: string; email: string };
  endereco: Record<string, string | undefined>;
  itens: { id: string; titulo: string; precoCentavos: number; vendedoraId?: string }[];
  subtotalCentavos: number;
  freteCentavos: number;
  totalCentavos: number;
  status: StatusPedido;
  pixCopiaECola: string;
  pixExpiraEm: string;
  criadoEm: string;
  pagoEm?: string;
  canceladoEm?: string;
  /**
   * Pedidos correspondentes no Módulo 05 (um por vendedora), criados pelo CompraFacade. São eles
   * que aparecem em "minhas compras", "minhas vendas" e na carteira.
   */
  pedidosGestao?: { vendedoraId: string; pedidoId: string }[];
}

/** Regras definidas pela administração no painel (sem valor = vale o padrão do servidor). */
export interface ConfiguracaoLoja {
  freteCentavos?: number;
}

interface Dados {
  pecas: Peca[];
  pedidos: Pedido[];
  configuracao?: ConfiguracaoLoja;
}

export type Loja = ReturnType<typeof abrirLoja>;

/**
 * `arquivo`: onde os dados ficam (db.json). `semente`: cópia inicial (db.seed.json), usada se
 * o arquivo ainda não existir. Com `arquivo` = null, fica só na memória (testes).
 */
export function abrirLoja(arquivo: string | null, semente: string) {
  if (arquivo && !existsSync(arquivo)) copyFileSync(semente, arquivo);
  let dados: Dados = JSON.parse(readFileSync(arquivo ?? semente, "utf8"));
  let fila: Promise<unknown> = Promise.resolve();

  /**
   * Executa `alterar` sozinho na fila e grava o arquivo no fim. Pode ser assíncrono (o checkout
   * espera o Módulo 05 responder): enquanto isso, as outras alterações aguardam a vez.
   */
  function alterarEmFila<T>(alterar: (d: Dados) => T | Promise<T>): Promise<T> {
    const proxima = fila.then(async () => {
      const resultado = await alterar(dados);
      if (arquivo) writeFileSync(arquivo, JSON.stringify(dados, null, 2));
      return resultado;
    });
    fila = proxima.catch(() => undefined);
    return proxima;
  }

  return {
    listarPecas: () => dados.pecas,
    peca: (id: string) => dados.pecas.find((p) => p.id === id),
    pedido: (id: string) => dados.pedidos.find((p) => p.id === id),
    listarPedidos: () => dados.pedidos,
    configuracao: (): ConfiguracaoLoja => dados.configuracao ?? {},
    alterarEmFila,
    novoId: () => randomBytes(6).toString("hex"),
    /** Só para os testes: volta ao conteúdo da semente. */
    restaurar() {
      dados = JSON.parse(readFileSync(semente, "utf8"));
    },
  };
}
