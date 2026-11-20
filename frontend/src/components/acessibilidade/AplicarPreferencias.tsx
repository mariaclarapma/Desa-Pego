"use client";

import { useEffect } from "react";
import { aplicarPreferencias } from "@/lib/preferencias";
import { usePreferencias } from "@/lib/usePreferencias";

/** Mantém o <html> sincronizado com as preferências e com o tema do sistema operacional. */
export function AplicarPreferencias() {
  const tema = usePreferencias((s) => s.tema);
  const altoContraste = usePreferencias((s) => s.altoContraste);
  const escalaFonte = usePreferencias((s) => s.escalaFonte);

  useEffect(() => {
    aplicarPreferencias({ tema, altoContraste, escalaFonte });
    if (tema !== "sistema") return;
    const consulta = window.matchMedia("(prefers-color-scheme: dark)");
    const aoMudar = () => aplicarPreferencias({ tema, altoContraste, escalaFonte });
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, [tema, altoContraste, escalaFonte]);

  return null;
}
