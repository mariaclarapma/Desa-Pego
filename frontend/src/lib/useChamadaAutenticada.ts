"use client";

import { useCallback } from "react";
import { ErroApi } from "@/lib/api/autenticado";
import { renovarSessao } from "@/lib/api/contas";
import { useSessao } from "@/lib/sessao";

/**
 * Executa uma chamada privada com o token da sessão; se o token de 15 minutos tiver vencido
 * (401), renova a sessão pelo cookie uma única vez e tenta de novo.
 */
export function useChamadaAutenticada() {
  const sessao = useSessao((s) => s.sessao);
  const definir = useSessao((s) => s.definir);
  return useCallback(
    async <T,>(operacao: (token: string) => Promise<T>): Promise<T> => {
      try {
        return await operacao(sessao!.accessToken);
      } catch (erro) {
        if (!(erro instanceof ErroApi) || erro.status !== 401) throw erro;
        const nova = await renovarSessao();
        definir(nova);
        return operacao(nova.accessToken);
      }
    },
    [sessao, definir],
  );
}

export type ChamadaAutenticada = ReturnType<typeof useChamadaAutenticada>;
