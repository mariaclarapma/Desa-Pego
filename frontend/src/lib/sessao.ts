"use client";

import { create } from "zustand";
import type { Sessao } from "@/lib/api/contas";

/**
 * Sessão da pessoa logada. Fica só na memória (de propósito, sem localStorage): o token de
 * acesso some ao fechar a aba, e a sessão volta pelo cookie httpOnly com renovarSessao().
 */
interface EstadoSessao {
  sessao: Sessao | null;
  definir: (sessao: Sessao | null) => void;
}

export const useSessao = create<EstadoSessao>()((set) => ({
  sessao: null,
  definir: (sessao) => set({ sessao }),
}));
