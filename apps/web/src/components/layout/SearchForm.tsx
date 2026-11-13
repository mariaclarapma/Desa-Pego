import { useId } from "react";
import { IconSearch } from "@/components/ui/icons";
import { ROUTES } from "@/lib/routes";

/**
 * Busca da vitrine (Req. 007). É um formulário GET comum: funciona sem JS e
 * leva para /catalogo?busca=..., onde o Módulo 03 aplica a busca full-text.
 */
export function SearchForm({ className = "" }: { className?: string }) {
  const id = useId();
  return (
    <form role="search" action={ROUTES.catalogo} method="get" className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        Buscar peças
      </label>
      <input
        id={id}
        type="search"
        name="busca"
        autoComplete="off"
        enterKeyHint="search"
        placeholder="procura um achadinho: vestido, jeans, bolsa…"
        className="peer h-11 w-full rounded-full border-2 border-vinho bg-white/70 pr-14 pl-5 text-[0.95rem] text-vinho transition-[background-color,box-shadow] placeholder:text-vinho-soft/80 hover:bg-white focus:bg-white focus:shadow-[3px_3px_0_0_var(--color-chiclete)] focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-vinho text-creme transition-colors hover:bg-cereja"
      >
        <IconSearch size={17} />
      </button>
    </form>
  );
}
