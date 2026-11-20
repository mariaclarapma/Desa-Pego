import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/catalogo/ProductCard";
import { ApiIndisponivel } from "@/components/ui/ApiIndisponivel";
import { buttonClasses } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CATEGORIAS } from "@/data/demo/catalogo";
import { filtrarPecas, listarPecas, statusAtual, type FiltrosVitrine, type Ordem } from "@/lib/api/catalogo";
import { CONDICAO_LABEL } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { CategoriaSlug, Condicao, Peca } from "@/types/catalogo";

export const metadata: Metadata = { title: "vitrine" };
// estoque muda a todo momento (reservas): a vitrine é sempre renderizada na hora
export const dynamic = "force-dynamic";

type Busca = Record<string, string | string[] | undefined>;

const ORDENS: Record<Ordem, string> = {
  recentes: "mais recentes",
  "menor-preco": "menor preço",
  "maior-preco": "maior preço",
};

function lerFiltros(sp: Busca): FiltrosVitrine {
  const texto = (chave: string) => (typeof sp[chave] === "string" ? (sp[chave] as string) : undefined);
  const precoMax = Number(texto("precoMax"));
  return {
    busca: texto("busca"),
    categoria: CATEGORIAS.some((c) => c.slug === texto("categoria")) ? (texto("categoria") as CategoriaSlug) : undefined,
    tamanho: texto("tamanho") || undefined,
    condicao: texto("condicao") && texto("condicao")! in CONDICAO_LABEL ? (texto("condicao") as Condicao) : undefined,
    precoMaxCentavos: precoMax > 0 ? Math.round(precoMax * 100) : undefined,
    ordem: texto("ordem") && texto("ordem")! in ORDENS ? (texto("ordem") as Ordem) : undefined,
  };
}

const campo =
  "h-11 w-full rounded-full border-2 border-roxo bg-white/70 px-4 text-sm text-roxo focus:bg-white focus:shadow-[3px_3px_0_0_var(--color-rosa)] focus:outline-none";

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const filtros = lerFiltros(await searchParams);

  let pecas: Peca[];
  try {
    pecas = await listarPecas();
  } catch {
    return <ApiIndisponivel />;
  }

  const visiveis = filtrarPecas(pecas, filtros);
  const tamanhos = [...new Set(pecas.map((p) => p.tamanho))].sort();
  const categoria = CATEGORIAS.find((c) => c.slug === filtros.categoria);
  const temFiltro = Object.values(filtros).some(Boolean);

  return (
    <div className="bg-dots">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <SectionHeading eyebrow={filtros.busca ? `busca: “${filtros.busca}”` : "vitrine"}>
          {categoria ? categoria.nome : "todos os achadinhos"}
        </SectionHeading>

        {/* Formulário GET: os filtros ficam na URL e funcionam sem JavaScript (Req. 007). */}
        <form
          action={ROUTES.catalogo}
          method="get"
          className="mt-8 grid gap-3 rounded-[1.5rem] border-2 border-roxo bg-nevoa p-4 shadow-[4px_4px_0_0_var(--color-roxo)] sm:grid-cols-2 lg:grid-cols-6"
        >
          <input type="search" name="busca" defaultValue={filtros.busca} placeholder="buscar peça, marca…" aria-label="Buscar" className={`${campo} lg:col-span-2`} />
          <select name="categoria" defaultValue={filtros.categoria ?? ""} aria-label="Categoria" className={campo}>
            <option value="">todas as categorias</option>
            {CATEGORIAS.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nome}
              </option>
            ))}
          </select>
          <select name="tamanho" defaultValue={filtros.tamanho ?? ""} aria-label="Tamanho" className={campo}>
            <option value="">todos os tamanhos</option>
            {tamanhos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select name="condicao" defaultValue={filtros.condicao ?? ""} aria-label="Condição" className={campo}>
            <option value="">qualquer condição</option>
            {Object.entries(CONDICAO_LABEL).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <input
            type="number"
            name="precoMax"
            min={1}
            step="any"
            defaultValue={filtros.precoMaxCentavos ? filtros.precoMaxCentavos / 100 : ""}
            placeholder="até R$"
            aria-label="Preço máximo em reais"
            className={campo}
          />
          <select name="ordem" defaultValue={filtros.ordem ?? "recentes"} aria-label="Ordenar por" className={`${campo} lg:col-span-2`}>
            {Object.entries(ORDENS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                ordenar: {rotulo}
              </option>
            ))}
          </select>
          <div className="flex gap-3 sm:col-span-2 lg:col-span-4 lg:justify-end">
            {temFiltro ? (
              <Link href={ROUTES.catalogo} className={buttonClasses("fantasma", "sm", "underline")}>
                limpar filtros
              </Link>
            ) : null}
            <button type="submit" className={buttonClasses("roxo", "sm", "flex-1 sm:flex-none")}>
              aplicar
            </button>
          </div>
        </form>

        <p className="mt-8 text-sm font-medium text-roxo-soft" aria-live="polite">
          {visiveis.length} {visiveis.length === 1 ? "peça encontrada" : "peças encontradas"}
        </p>

        {visiveis.length > 0 ? (
          <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12">
            {visiveis.map((peca, i) => (
              <li key={peca.id}>
                <ProductCard peca={peca} prioridade={i < 2} status={statusAtual(peca)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-3xl border-2 border-dashed border-roxo/40 p-10 text-center font-hand text-2xl">
            nada por aqui com esses filtros… tenta outra combinação ♡
          </p>
        )}
      </div>
    </div>
  );
}
