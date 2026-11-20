"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CHAVE_PREFERENCIAS, ESCALAS, PADRAO, type EscolhaTema, type Preferencias } from "./preferencias";

interface EstadoPreferencias extends Preferencias {
  definirTema: (tema: EscolhaTema) => void;
  alternarContraste: () => void;
  aumentarFonte: () => void;
  diminuirFonte: () => void;
  restaurar: () => void;
}

const passo = (atual: number, direcao: 1 | -1) => {
  const i = ESCALAS.findIndex((e) => e >= atual);
  const indice = Math.min(ESCALAS.length - 1, Math.max(0, (i === -1 ? ESCALAS.length - 1 : i) + direcao));
  return ESCALAS[indice];
};

export const usePreferencias = create<EstadoPreferencias>()(
  persist(
    (set) => ({
      ...PADRAO,
      definirTema: (tema) => set({ tema }),
      alternarContraste: () => set((s) => ({ altoContraste: !s.altoContraste })),
      aumentarFonte: () => set((s) => ({ escalaFonte: passo(s.escalaFonte, 1) })),
      diminuirFonte: () => set((s) => ({ escalaFonte: passo(s.escalaFonte, -1) })),
      restaurar: () => set(PADRAO),
    }),
    {
      name: CHAVE_PREFERENCIAS,
      partialize: ({ tema, altoContraste, escalaFonte }) => ({ tema, altoContraste, escalaFonte }),
    },
  ),
);
