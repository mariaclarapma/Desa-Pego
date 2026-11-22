"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { liberarPeca, reservarPeca } from "@/lib/api/catalogo";
import { comLogin } from "@/lib/comLogin";
import type { PecaResumo } from "@/types/catalogo";

export type ItemSacola = Pick<PecaResumo, "id" | "titulo" | "marca" | "tamanho" | "precoCentavos" | "fotoUrl" | "fotoAlt" | "vendedoraId"> & {
  reservadaAte: string;
};

interface SacolaEstado {
  itens: ItemSacola[];
  adicionar: (peca: PecaResumo) => Promise<void>;
  remover: (id: string) => Promise<void>;
  removerExpirados: () => void;
  esvaziar: () => void;
}

/** Sacola de compras (Zustand, como no documento de arquitetura), salva no navegador. */
export const useSacola = create<SacolaEstado>()(
  persist(
    (set, get) => ({
      itens: [],

      async adicionar(peca) {
        if (get().itens.some((i) => i.id === peca.id)) return;
        // a reserva fica no nome de quem está logada (sem conta: SemLogin)
        const reservada = await comLogin((token) => reservarPeca(peca.id, token));
        const { id, titulo, marca, tamanho, precoCentavos, fotoUrl, fotoAlt, vendedoraId } = peca;
        set({
          itens: [
            ...get().itens,
            { id, titulo, marca, tamanho, precoCentavos, fotoUrl, fotoAlt, vendedoraId, reservadaAte: reservada.reservadaAte! },
          ],
        });
      },

      async remover(id) {
        set({ itens: get().itens.filter((i) => i.id !== id) });
        try {
          await comLogin((token) => liberarPeca(id, token));
        } catch {
          // a reserva expira sozinha de qualquer forma
        }
      },

      removerExpirados() {
        const agora = Date.now();
        const validos = get().itens.filter((i) => new Date(i.reservadaAte).getTime() > agora);
        if (validos.length !== get().itens.length) set({ itens: validos });
      },

      esvaziar: () => set({ itens: [] }),
    }),
    { name: "desapego-sacola" },
  ),
);

export const subtotalSacola = (itens: ItemSacola[]) => itens.reduce((soma, i) => soma + i.precoCentavos, 0);

/**
 * Quantos envios a compra tem: um por vendedora (cada uma manda a sua parte e cobra o seu
 * frete fixo). O servidor faz a mesma conta ao criar o pedido; esta é só para mostrar antes.
 */
export const enviosSacola = (itens: Pick<ItemSacola, "id" | "vendedoraId">[]) => new Set(itens.map((i) => i.vendedoraId ?? `peca:${i.id}`)).size;

export const rotuloFrete = (envios: number) => (envios > 1 ? `frete fixo (${envios} vendedoras)` : "frete fixo");
