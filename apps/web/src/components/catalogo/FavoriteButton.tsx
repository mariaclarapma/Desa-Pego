"use client";

import { useState } from "react";
import { IconHeart } from "@/components/ui/icons";

/**
 * Coração de favoritar.
 * Favoritos estão FORA do MVP (ver ARQUITETURA.md §1.2): por enquanto o estado
 * é só visual e local, sem persistência. Quando houver API, troque o useState
 * por uma mutation mantendo a mesma interface.
 */
export function FavoriteButton({ titulo, className = "" }: { titulo: string; className?: string }) {
  const [favorito, setFavorito] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={favorito}
      aria-label={`Favoritar ${titulo}`}
      onClick={() => setFavorito((v) => !v)}
      className={`grid size-10 place-items-center rounded-full border-2 border-vinho shadow-[2px_2px_0_0_var(--color-vinho)] transition-[background-color,transform] duration-200 hover:scale-110 active:scale-95 ${
        favorito ? "bg-chiclete text-cereja" : "bg-creme/90 text-vinho backdrop-blur-sm hover:bg-chiclete-100"
      } ${className}`}
    >
      <IconHeart key={String(favorito)} filled={favorito} size={18} className={favorito ? "animate-wiggle" : ""} />
    </button>
  );
}
