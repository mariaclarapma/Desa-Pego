"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/cliente";
import { FRETE_FIXO_CENTAVOS } from "@/lib/config";

/**
 * Frete fixo definido pela administração (Req. 014), lido do catálogo (GET /api/config).
 * Enquanto carrega, ou se o servidor não responder, mostra o padrão. O valor cobrado de
 * verdade é sempre o que o servidor calcula ao criar o pedido.
 */
export function useFrete(): number {
  const [frete, setFrete] = useState(FRETE_FIXO_CENTAVOS);
  useEffect(() => {
    let ativo = true;
    api<{ freteCentavos: number }>("/config")
      .then((c) => {
        if (ativo && Number.isInteger(c.freteCentavos)) setFrete(c.freteCentavos);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);
  return frete;
}
