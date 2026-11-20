import Image from "next/image";
import Link from "next/link";
import { ConditionBadge } from "@/components/ui/ConditionBadge";
import { Sticker } from "@/components/ui/Sticker";
import { formatarPreco } from "@/lib/format";
import { pecaUrl } from "@/lib/routes";
import type { PecaResumo, StatusPeca } from "@/types/catalogo";
import { FavoriteButton } from "./FavoriteButton";

/**
 * Card de peça para vitrines (Home e, futuramente, catálogo do Req. 007).
 * O card inteiro é clicável (link "esticado" no título); o favorito fica por cima.
 */
export function ProductCard({
  peca,
  prioridade = false,
  status = "disponivel",
}: {
  peca: PecaResumo;
  prioridade?: boolean;
  /** Na vitrine, peças reservadas aparecem com selo e foto esmaecida (Req. 008). */
  status?: StatusPeca;
}) {
  return (
    <article className="group relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.25rem] border-2 border-roxo bg-nevoa-200 transition-shadow duration-300 group-hover:shadow-[5px_5px_0_0_var(--color-roxo)]">
        <Image
          src={peca.fotoUrl}
          alt={peca.fotoAlt}
          fill
          priority={prioridade}
          sizes="(min-width: 1024px) 23vw, (min-width: 768px) 31vw, 48vw"
          className={`object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05] ${
            status !== "disponivel" ? "opacity-60 grayscale" : ""
          }`}
        />
        {status !== "disponivel" ? (
          <Sticker tone={status === "vendida" ? "violeta" : "pervinca"} rotate={-6} className="absolute bottom-3 left-3 !text-base">
            {status === "vendida" ? "vendida" : "reservada"}
          </Sticker>
        ) : null}
        <ConditionBadge condicao={peca.condicao} className="absolute top-2.5 left-2.5 shadow-sm" />
        <span
          aria-hidden="true"
          className="absolute inset-x-2.5 bottom-2.5 hidden translate-y-3 items-center justify-center rounded-full border-2 border-roxo bg-nevoa py-2 text-sm font-semibold text-roxo opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:flex"
        >
          ver peça
        </span>
      </div>

      <FavoriteButton titulo={peca.titulo} className="absolute top-2 right-2 z-20" />

      <div className="mt-3 px-0.5">
        {peca.marca ? (
          <p className="truncate text-[0.68rem] font-semibold tracking-[0.14em] text-roxo-soft uppercase">{peca.marca}</p>
        ) : null}
        <h3 className="mt-0.5 line-clamp-2 text-[0.95rem] leading-snug font-medium text-roxo sm:text-base">
          <Link
            href={pecaUrl(peca.id)}
            className="outline-none after:absolute after:inset-0 after:z-10 after:rounded-[1.25rem] focus-visible:after:outline-3 focus-visible:after:outline-offset-4 focus-visible:after:outline-magenta"
          >
            {peca.titulo}
          </Link>
        </h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="font-display text-xl leading-none font-semibold tracking-tight text-violeta sm:text-[1.4rem]">
            <span className="sr-only">Preço: </span>
            {formatarPreco(peca.precoCentavos)}
          </p>
          <p className="shrink-0 rounded-lg border-2 border-roxo/20 px-2 py-0.5 text-xs font-bold text-roxo">
            <span className="sr-only">Tamanho </span>
            <span aria-hidden="true">tam. </span>
            {peca.tamanho}
          </p>
        </div>
        <p className="mt-1.5 truncate text-xs text-roxo-soft">
          {peca.vendedor.cidade} · por {peca.vendedor.nomePublico}
        </p>
      </div>
    </article>
  );
}
