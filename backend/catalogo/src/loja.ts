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
  /** Ocultada pela administração (anúncio irregular): some da vitrine, da página e da reserva. */
  oculta?: boolean;
  motivoOculta?: string | null;
  [campo: string]: unknown;
}

export interface Pedido {
  id: string;
  comprador: { nome: string; email: string };
  endereco: Record<string, string | undefined>;
  itens: { id: string; titulo: string; precoCentavos: number }[];
  subtotalCentavos: number;
  freteCentavos: number;
  totalCentavos: number;
  status: StatusPedido;
  pixCopiaECola: string;
  pixExpiraEm: string;
  criadoEm: string;
  pagoEm?: string;
}

interface Dados {
  pecas: Peca[];
  pedidos: Pedido[];
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

  /** Executa `alterar` sozinho na fila e grava o arquivo no fim. */
  function alterarEmFila<T>(alterar: (d: Dados) => T): Promise<T> {
    const proxima = fila.then(() => {
      const resultado = alterar(dados);
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
    alterarEmFila,
    novoId: () => randomBytes(6).toString("hex"),
    /** Só para os testes: volta ao conteúdo da semente. */
    restaurar() {
      dados = JSON.parse(readFileSync(semente, "utf8"));
    },
  };
}
