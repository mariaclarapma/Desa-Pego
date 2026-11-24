"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { IconAlerta, IconOlho, IconOlhoRiscado } from "@/components/ui/icons";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  /** Campo de senha com o botão de mostrar/ocultar. */
  senha?: boolean;
  /** Ícone decorativo à esquerda do texto (ex.: envelope no e-mail). */
  icone?: ReactNode;
  /** "editorial": borda fina e realce suave no foco (login e cadastro). O padrão é o contorno grosso. */
  estilo?: "padrao" | "editorial";
};

/**
 * Campo com rótulo visível, dica e mensagem de erro ligadas ao input por aria-describedby.
 * O erro aparece em texto e com ícone (nunca só pela cor).
 */
export function CampoConta({ id, rotulo, erro, dica, senha = false, icone, estilo = "padrao", className = "", ...input }: Props) {
  const [visivel, setVisivel] = useState(false);
  const idDica = dica ? `${id}-dica` : undefined;
  const idErro = erro ? `${id}-erro` : undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-roxo">
        {rotulo}
      </label>
      <div className="relative">
        <input
          id={id}
          {...input}
          type={senha ? (visivel ? "text" : "password") : input.type}
          aria-invalid={erro ? true : undefined}
          aria-describedby={[idErro, idDica].filter(Boolean).join(" ") || undefined}
          className={`w-full text-roxo transition-[background-color,box-shadow,border-color] placeholder:text-roxo-soft/80 focus:outline-none ${
            senha ? "pr-14" : ""
          } ${icone ? "pl-12" : "pl-4"} ${senha ? "" : "pr-4"} ${
            estilo === "editorial"
              ? `h-13 rounded-2xl border-[1.5px] bg-white ${
                  erro
                    ? "border-magenta focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-magenta)_22%,transparent)]"
                    : "border-roxo-soft/70 hover:border-roxo-soft focus:border-violeta focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-lilas)_55%,transparent)]"
                }`
              : `h-12 rounded-2xl border-2 bg-white/70 hover:bg-white focus:bg-white ${
                  erro
                    ? "border-magenta focus:shadow-[3px_3px_0_0_var(--color-magenta)]"
                    : "border-roxo focus:shadow-[3px_3px_0_0_var(--color-rosa)]"
                }`
          }`}
        />
        {icone ? (
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-roxo-soft">
            {icone}
          </span>
        ) : null}
        {senha ? (
          <button
            type="button"
            onClick={() => setVisivel((v) => !v)}
            aria-label={visivel ? `ocultar ${rotulo.toLowerCase()}` : `mostrar ${rotulo.toLowerCase()}`}
            aria-pressed={visivel}
            aria-controls={id}
            className="absolute top-1/2 right-1.5 grid size-10 -translate-y-1/2 place-items-center rounded-full text-roxo transition-colors hover:bg-rosa-100"
          >
            {visivel ? <IconOlhoRiscado size={20} /> : <IconOlho size={20} />}
          </button>
        ) : null}
      </div>
      {erro ? (
        <p id={idErro} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-magenta">
          <IconAlerta size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      ) : null}
      {dica ? (
        <p id={idDica} className="mt-1.5 text-sm text-roxo-soft">
          {dica}
        </p>
      ) : null}
    </div>
  );
}
