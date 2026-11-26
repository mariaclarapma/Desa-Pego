"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { FotoPeca } from "@/types/catalogo";

type Props = {
  fotos: FotoPeca[];
  /** Peça reservada ou vendida: as fotos ficam em tons de cinza. */
  indisponivel?: boolean;
  /** Selos por cima da foto grande (ex.: a condição da peça). */
  children?: ReactNode;
  /** Adesivo que pode passar da borda da foto grande (ex.: "vendida"): não é cortado. */
  adesivo?: ReactNode;
};

/**
 * Só as fotos de demonstração (Unsplash) passam pelo otimizador do Next; as enviadas pelos
 * anúncios vêm da própria API e são servidas como estão (igual a FotosAnuncio).
 */
const otimizavel = (url: string) => url.startsWith("https://images.unsplash.com/");

/**
 * Galeria da página da peça (Req. 008): uma foto grande e, se houver mais de uma, miniaturas
 * clicáveis. Cada miniatura é um botão com o texto alternativo da foto; as setas do teclado
 * passam de uma para a outra.
 */
export function GaleriaFotos({ fotos, indisponivel = false, children, adesivo }: Props) {
  const [atual, setAtual] = useState(0);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const foto = fotos[atual] ?? fotos[0];

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const passo = evento.key === "ArrowRight" ? 1 : evento.key === "ArrowLeft" ? -1 : 0;
    if (!passo) return;
    evento.preventDefault();
    const proximo = (indice + passo + fotos.length) % fotos.length;
    setAtual(proximo);
    botoes.current[proximo]?.focus();
  }

  return (
    <div>
      <div className="relative">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] border-2 border-roxo bg-nevoa-200 shadow-[6px_6px_0_0_var(--color-roxo)]">
          {foto ? (
            <Image
              key={foto.url}
              src={foto.url}
              alt={foto.alt}
              fill
              priority={atual === 0}
              unoptimized={!otimizavel(foto.url)}
              sizes="(min-width: 768px) 45vw, 100vw"
              className={`object-cover ${indisponivel ? "opacity-60 grayscale" : ""}`}
            />
          ) : null}
          {children}
        </div>
        {adesivo}
      </div>

      {fotos.length > 1 ? (
        <ul aria-label="fotos da peça" className="mt-4 flex gap-3 overflow-x-auto p-1">
          {fotos.map((f, i) => (
            <li key={f.url} className="shrink-0">
              <button
                ref={(el) => {
                  botoes.current[i] = el;
                }}
                type="button"
                aria-label={`ver foto ${i + 1} de ${fotos.length}: ${f.alt}`}
                aria-pressed={i === atual}
                tabIndex={i === atual ? 0 : -1}
                onClick={() => setAtual(i)}
                onKeyDown={(e) => aoTeclar(e, i)}
                className={`relative block h-20 w-16 overflow-hidden rounded-xl border-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta ${
                  i === atual ? "border-violeta shadow-[3px_3px_0_0_var(--color-roxo)]" : "border-roxo/30 opacity-70 hover:opacity-100"
                }`}
              >
                <Image src={f.url} alt="" fill unoptimized={!otimizavel(f.url)} sizes="64px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {fotos.length > 1 && foto ? `foto ${atual + 1} de ${fotos.length}: ${foto.alt}` : ""}
      </p>
    </div>
  );
}
