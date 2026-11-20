"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconClose, IconLibras, IconOlhoRiscado, IconParar, IconVoz } from "@/components/ui/icons";
import { falar, leitorDisponivel, pararDeFalar } from "@/lib/leitor";
import type { EscolhaTema } from "@/lib/preferencias";
import { usePreferencias } from "@/lib/usePreferencias";
import { abrirVLibras } from "@/lib/vlibras";

// no celular: fileira no canto inferior; a partir de md: pilha na lateral esquerda (como nos sites gov.br)
const botaoLateral =
  "grid size-11 place-items-center rounded-xl border-2 border-nevoa bg-roxo text-nevoa shadow-[3px_3px_0_0_var(--color-magenta)] transition-[transform,background-color] duration-200 hover:bg-violeta aria-pressed:bg-violeta aria-expanded:bg-violeta md:size-12 md:rounded-l-none md:border-l-0 md:hover:translate-x-1";

const TEMAS: { valor: EscolhaTema; rotulo: string }[] = [
  { valor: "claro", rotulo: "claro" },
  { valor: "escuro", rotulo: "escuro" },
  { valor: "sistema", rotulo: "do sistema" },
];

/**
 * Barra de acessibilidade fixa na lateral esquerda, no padrão dos sites públicos brasileiros:
 * Libras (VLibras), leitor de voz e opções visuais (tema, alto contraste e tamanho da fonte).
 */
export function BarraAcessibilidade() {
  const [lendo, setLendo] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [aviso, setAviso] = useState("");
  const [vozOk, setVozOk] = useState(true);
  const idPainel = useId();
  const painelRef = useRef<HTMLDivElement>(null);
  const botaoVisualRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setVozOk(leitorDisponivel()), []);
  useEffect(() => () => pararDeFalar(), []);

  // fecha o painel com Esc ou clicando fora, devolvendo o foco ao botão
  useEffect(() => {
    if (!painelAberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPainelAberto(false);
        botaoVisualRef.current?.focus();
      }
    };
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!painelRef.current?.contains(alvo) && !botaoVisualRef.current?.contains(alvo)) setPainelAberto(false);
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("mousedown", aoClicar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("mousedown", aoClicar);
    };
  }, [painelAberto]);

  async function libras() {
    setAviso("carregando o tradutor de Libras…");
    try {
      await abrirVLibras();
      setAviso("");
    } catch (erro) {
      setAviso(erro instanceof Error ? erro.message : "Não foi possível abrir o VLibras.");
    }
  }

  function alternarLeitura() {
    if (lendo) {
      pararDeFalar();
      setLendo(false);
      return;
    }
    // lê o trecho selecionado; sem seleção, lê o conteúdo principal da página
    const selecionado = window.getSelection()?.toString().trim();
    const principal = document.getElementById("conteudo");
    const texto = selecionado || principal?.innerText || principal?.textContent || "";
    setLendo(true);
    falar(texto, () => setLendo(false));
  }

  return (
    <>
      <nav
        aria-label="Acessibilidade"
        className="fixed bottom-3 left-3 z-40 flex gap-2 md:top-1/2 md:bottom-auto md:left-0 md:-translate-y-1/2 md:flex-col"
      >
        <BotaoLateral rotulo="Traduzir para Libras (VLibras)" onClick={libras}>
          <IconLibras size={26} />
        </BotaoLateral>
        <BotaoLateral
          rotulo={lendo ? "Parar a leitura em voz alta" : "Ler a página em voz alta (ou o texto selecionado)"}
          onClick={alternarLeitura}
          pressionado={lendo}
          desabilitado={!vozOk}
        >
          {lendo ? <IconParar size={24} /> : <IconVoz size={26} />}
        </BotaoLateral>
        <BotaoLateral
          ref={botaoVisualRef}
          rotulo="Opções visuais: tema, contraste e tamanho da fonte"
          onClick={() => setPainelAberto((v) => !v)}
          expandido={painelAberto}
          controla={idPainel}
        >
          <IconOlhoRiscado size={26} />
        </BotaoLateral>
      </nav>

      <p role="status" className="sr-only">
        {aviso}
      </p>
      {aviso ? (
        <p className="fixed bottom-20 left-3 z-40 max-w-xs md:bottom-4 md:left-16 rounded-2xl border-2 border-roxo bg-nevoa px-4 py-2 text-sm text-roxo shadow-[3px_3px_0_0_var(--color-roxo)]">
          {aviso}
        </p>
      ) : null}

      {painelAberto ? <PainelVisual id={idPainel} ref={painelRef} fechar={() => setPainelAberto(false)} /> : null}
    </>
  );
}

function BotaoLateral({
  rotulo,
  onClick,
  children,
  pressionado,
  expandido,
  controla,
  desabilitado,
  ref,
}: {
  rotulo: string;
  onClick: () => void;
  children: ReactNode;
  pressionado?: boolean;
  expandido?: boolean;
  controla?: string;
  desabilitado?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      aria-pressed={pressionado}
      aria-expanded={expandido}
      aria-controls={controla}
      disabled={desabilitado}
      className={`${botaoLateral} disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

function PainelVisual({ id, ref, fechar }: { id: string; ref: React.Ref<HTMLDivElement>; fechar: () => void }) {
  const p = usePreferencias();
  const titulo = useId();
  const opcao =
    "flex-1 rounded-full border-2 border-roxo px-3 py-1.5 text-sm font-semibold transition-colors aria-pressed:bg-roxo aria-pressed:text-nevoa hover:bg-rosa-100 aria-pressed:hover:bg-roxo";

  return (
    <div
      id={id}
      ref={ref}
      role="dialog"
      aria-labelledby={titulo}
      className="fixed inset-x-3 bottom-20 z-50 rounded-[1.25rem] border-2 border-roxo bg-nevoa p-5 text-roxo shadow-[5px_5px_0_0_var(--color-roxo)] md:inset-x-auto md:top-1/2 md:bottom-auto md:left-16 md:w-80 md:-translate-y-1/2"
    >
      <div className="flex items-center justify-between">
        <h2 id={titulo} className="font-display text-2xl font-medium">
          opções visuais
        </h2>
        <button type="button" onClick={fechar} aria-label="Fechar opções visuais" autoFocus className="grid size-9 place-items-center rounded-full border-2 border-roxo hover:bg-rosa-100">
          <IconClose size={16} />
        </button>
      </div>

      <fieldset className="mt-5" disabled={p.altoContraste}>
        <legend className="mb-2 text-xs font-bold tracking-[0.18em] text-violeta uppercase">tema</legend>
        <div className="flex gap-2">
          {TEMAS.map((t) => (
            <button key={t.valor} type="button" aria-pressed={p.tema === t.valor} onClick={() => p.definirTema(t.valor)} className={`${opcao} disabled:cursor-not-allowed disabled:border-dashed`}>
              {t.rotulo}
            </button>
          ))}
        </div>
        {p.altoContraste ? (
          <p className="mt-2 text-xs">com o alto contraste ligado, as cores ficam fixas em preto, branco e amarelo.</p>
        ) : null}
      </fieldset>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span aria-hidden="true" className="text-sm font-semibold">
          alto contraste
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={p.altoContraste}
          aria-label="alto contraste"
          onClick={p.alternarContraste}
          className="relative h-8 w-14 shrink-0 rounded-full border-2 border-roxo bg-nevoa-200 transition-colors aria-checked:bg-violeta"
        >
          <span
            aria-hidden="true"
            className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full bg-roxo transition-[left] ${p.altoContraste ? "left-7 !bg-nevoa" : "left-1"}`}
          />
        </button>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-bold tracking-[0.18em] text-violeta uppercase">tamanho da fonte</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={p.diminuirFonte} aria-label="Diminuir fonte" disabled={p.escalaFonte <= 0.9} className={`${opcao} !flex-none px-4 disabled:opacity-40`}>
            A−
          </button>
          <output aria-live="polite" className="flex-1 text-center font-semibold tabular-nums">
            {Math.round(p.escalaFonte * 100)}%
          </output>
          <button type="button" onClick={p.aumentarFonte} aria-label="Aumentar fonte" disabled={p.escalaFonte >= 1.5} className={`${opcao} !flex-none px-4 disabled:opacity-40`}>
            A+
          </button>
        </div>
      </div>

      <button type="button" onClick={p.restaurar} className="mt-6 w-full text-sm underline underline-offset-4 hover:text-violeta">
        restaurar o padrão
      </button>
    </div>
  );
}
