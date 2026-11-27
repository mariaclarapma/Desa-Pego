"use client";

import { useSyncExternalStore } from "react";
import { IconLua, IconSol } from "@/components/ui/icons";
import { temaAplicado } from "@/lib/preferencias";
import { usePreferencias } from "@/lib/usePreferencias";

const CONSULTA_ESCURO = "(prefers-color-scheme: dark)";

/** matchMedia existe em todo navegador atual; a checagem cobre ambientes sem ele (testes, navegadores antigos). */
const consultarSistema = () => (typeof window.matchMedia === "function" ? window.matchMedia(CONSULTA_ESCURO) : null);

function assinarSistema(avisar: () => void) {
  const consulta = consultarSistema();
  consulta?.addEventListener("change", avisar);
  return () => consulta?.removeEventListener("change", avisar);
}

/** Acompanha o tema do sistema operacional (no servidor não há como saber: começa como claro). */
const useSistemaEscuro = () =>
  useSyncExternalStore(
    assinarSistema,
    () => consultarSistema()?.matches ?? false,
    () => false,
  );

/** No servidor e na primeira pintura as preferências salvas ainda não existem: evita mostrar o ícone errado. */
const useMontado = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

/**
 * Alterna entre modo claro e escuro (atalho no cabeçalho; mais opções na barra de acessibilidade).
 * Some em telas muito estreitas, onde não cabe no cabeçalho: lá o tema fica nas opções visuais.
 *
 * O estado vem das preferências (a mesma regra que pinta o <html>), e não da leitura do <html>:
 * o cabeçalho é renderizado antes de AplicarPreferencias, então ler o <html> logo depois do clique
 * pegava o tema antigo, e o botão ficava preso, repetindo a mesma escolha a cada clique.
 */
export function BotaoTema({ className = "" }: { className?: string }) {
  const tema = usePreferencias((s) => s.tema);
  const altoContraste = usePreferencias((s) => s.altoContraste);
  const definirTema = usePreferencias((s) => s.definirTema);
  const sistemaEscuro = useSistemaEscuro();
  const montado = useMontado();

  const escuro = temaAplicado({ tema, altoContraste: false, escalaFonte: 1 }, sistemaEscuro) === "escuro";
  const rotulo = altoContraste
    ? "Tema bloqueado pelo alto contraste (desative-o na barra de acessibilidade)"
    : escuro
      ? "Ativar modo claro"
      : "Ativar modo escuro";
  const icone = "absolute transition-[opacity,rotate,scale] duration-300 motion-reduce:transition-none";

  return (
    <button
      type="button"
      onClick={() => definirTema(escuro ? "claro" : "escuro")}
      aria-label={rotulo}
      title={rotulo}
      disabled={altoContraste}
      className={`relative hidden size-10 place-items-center rounded-full sm:grid text-roxo transition-colors hover:bg-rosa-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {montado ? (
        <>
          {/* no escuro aparece o sol (vai para o claro); no claro, a lua */}
          <IconSol aria-hidden="true" className={`${icone} ${escuro ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`} />
          <IconLua aria-hidden="true" className={`${icone} ${escuro ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
        </>
      ) : (
        <span className="size-[22px]" />
      )}
    </button>
  );
}
