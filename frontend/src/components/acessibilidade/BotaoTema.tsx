"use client";

import { useEffect, useState } from "react";
import { IconLua, IconSol } from "@/components/ui/icons";
import { usePreferencias } from "@/lib/usePreferencias";

/**
 * Alterna entre modo claro e escuro (atalho no cabeçalho; mais opções na barra de acessibilidade).
 * Some em telas muito estreitas, onde não cabe no cabeçalho: lá o tema fica nas opções visuais.
 */
export function BotaoTema({ className = "" }: { className?: string }) {
  const definirTema = usePreferencias((s) => s.definirTema);
  const preferencias = usePreferencias();
  const [escuro, setEscuro] = useState<boolean | null>(null);

  // o tema real está no <html> (definido antes da pintura); lê depois de montar
  useEffect(() => {
    setEscuro(document.documentElement.dataset.tema !== "claro");
  }, [preferencias.tema, preferencias.altoContraste]);

  const rotulo = escuro ? "Ativar modo claro" : "Ativar modo escuro";
  return (
    <button
      type="button"
      onClick={() => definirTema(escuro ? "claro" : "escuro")}
      aria-label={rotulo}
      title={rotulo}
      disabled={preferencias.altoContraste}
      className={`hidden size-10 place-items-center rounded-full sm:grid text-roxo transition-colors hover:bg-rosa-100 disabled:opacity-40 ${className}`}
    >
      {escuro === null ? <span className="size-[22px]" /> : escuro ? <IconSol /> : <IconLua />}
    </button>
  );
}
