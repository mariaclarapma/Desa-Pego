"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { liberarPeca, reservarPeca } from "@/lib/api/catalogo";
import type { PecaResumo } from "@/types/catalogo";

export type ItemSacola = Pick<PecaResumo, "id" | "titulo" | "marca" | "tamanho" | "precoCentavos" | "fotoUrl" | "fotoAlt"> & {
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
        const reservada = await reservarPeca(peca.id);
        const { id, titulo, marca, tamanho, precoCentavos, fotoUrl, fotoAlt } = peca;
        set({
          itens: [
            ...get().itens,
            { id, titulo, marca, tamanho, precoCentavos, fotoUrl, fotoAlt, reservadaAte: reservada.reservadaAte! },
          ],
        });
      },

      async remover(id) {
        set({ itens: get().itens.filter((i) => i.id !== id) });
        try {
          await liberarPeca(id);
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
