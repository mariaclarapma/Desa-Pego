"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { renovarSessao } from "@/lib/api/contas";
import { ROUTES } from "@/lib/routes";
import { useSessao } from "@/lib/sessao";

/**
 * Para as páginas privadas: devolve a sessão da memória ou tenta recuperá-la pelo cookie
 * httpOnly (uma vez); sem sessão válida, manda para o login. Enquanto isso, devolve null.
 */
export function useSessaoObrigatoria() {
  const router = useRouter();
  const sessao = useSessao((s) => s.sessao);
  const definir = useSessao((s) => s.definir);
  const jaTentou = useRef(false);

  useEffect(() => {
    if (sessao || jaTentou.current) return;
    jaTentou.current = true;
    renovarSessao()
      .then(definir)
      .catch(() => router.replace(ROUTES.entrar));
  }, [sessao, definir, router]);

  return sessao;
}
