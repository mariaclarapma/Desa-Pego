import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/catalogo/ProductCard";
import { ApiIndisponivel } from "@/components/ui/ApiIndisponivel";
import { buttonClasses } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CATEGORIAS } from "@/data/demo/catalogo";
import { listarPecas, statusAtual, type FiltrosVitrine, type Ordem, type PaginaVitrine } from "@/lib/api/catalogo";
import { CONDICAO_LABEL } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { CategoriaSlug, Condicao } from "@/types/catalogo";

export const metadata: Metadata = { title: "vitrine" };
// estoque muda a todo momento (reservas): a vitrine é sempre renderizada na hora
export const dynamic = "force-dynamic";

type Busca = Record<string, string | string[] | undefined>;

const ORDENS: Record<Ordem, string> = {
  recentes: "mais recentes",
  "menor-preco": "menor preço",
  "maior-preco": "maior preço",
};

/**
 * Lista fixa do select de tamanhos: com a paginação, o site só recebe uma página de peças,
 * então não dá mais para montar a lista a partir delas. Roupas, "único" e numeração de calçados.
 */
const TAMANHOS = ["PP", "P", "M", "G", "GG", "XG", "único", ...Array.from({ length: 12 }, (_, i) => String(33 + i))];

// mesmos limites que a API valida (backend/catalogo/src/app.ts)
const BUSCA_MAXIMA = 100;
const PRECO_MAXIMO_CENTAVOS = 10_000_000;
const PAGINA_MAXIMA = 10_000;

/**
 * Lê os filtros da URL da página. Aqui os preços estão em reais (é o que a pessoa digita);
 * a API recebe centavos. Valores estranhos são ignorados ou corrigidos, para a página
 * nunca mandar à API algo que ela recusaria.
 */
function lerFiltros(sp: Busca): FiltrosVitrine {
  const texto = (chave: string) => (typeof sp[chave] === "string" ? (sp[chave] as string) : undefined);
  const centavos = (chave: string) => {
    const reais = Number(texto(chave)?.replace(",", "."));
    return reais > 0 ? Math.min(Math.round(reais * 100), PRECO_MAXIMO_CENTAVOS) : undefined;
  };
  let precoMinCentavos = centavos("precoMin");
  let precoMaxCentavos = centavos("precoMax");
  // "de 100 até 50" vira "de 50 até 100", em vez de um erro
  if (precoMinCentavos && precoMaxCentavos && precoMinCentavos > precoMaxCentavos) {
    [precoMinCentavos, precoMaxCentavos] = [precoMaxCentavos, precoMinCentavos];
  }
  const pagina = Number(texto("pagina"));
  return {
    busca: texto("busca")?.trim().slice(0, BUSCA_MAXIMA) || undefined,
    categoria: CATEGORIAS.some((c) => c.slug === texto("categoria")) ? (texto("categoria") as CategoriaSlug) : undefined,
    tamanho: TAMANHOS.includes(texto("tamanho") ?? "") ? texto("tamanho") : undefined,
    condicao: texto("condicao") && texto("condicao")! in CONDICAO_LABEL ? (texto("condicao") as Condicao) : undefined,
    precoMinCentavos,
    precoMaxCentavos,
    ordem: texto("ordem") && texto("ordem")! in ORDENS ? (texto("ordem") as Ordem) : undefined,
    pagina: Number.isInteger(pagina) && pagina > 1 ? Math.min(pagina, PAGINA_MAXIMA) : undefined,
  };
}

/** Link para uma página da vitrine mantendo os filtros atuais (formato da URL do site, em reais). */
function hrefVitrine(filtros: FiltrosVitrine, pagina: number): string {
  const query = new URLSearchParams();
  if (filtros.busca) query.set("busca", filtros.busca);
  if (filtros.categoria) query.set("categoria", filtros.categoria);
  if (filtros.tamanho) query.set("tamanho", filtros.tamanho);
  if (filtros.condicao) query.set("condicao", filtros.condicao);
  if (filtros.precoMinCentavos) query.set("precoMin", String(filtros.precoMinCentavos / 100));
  if (filtros.precoMaxCentavos) query.set("precoMax", String(filtros.precoMaxCentavos / 100));
  if (filtros.ordem) query.set("ordem", filtros.ordem);
  if (pagina > 1) query.set("pagina", String(pagina));
  const texto = query.toString();
  return texto ? `${ROUTES.catalogo}?${texto}` : ROUTES.catalogo;
}

const campo =
  "h-11 w-full rounded-full border-2 border-roxo bg-white/70 px-4 text-sm text-roxo focus:bg-white focus:shadow-[3px_3px_0_0_var(--color-rosa)] focus:outline-none";

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const filtros = lerFiltros(await searchParams);

  let resultado: PaginaVitrine;
  try {
    resultado = await listarPecas(filtros);
  } catch {
    return <ApiIndisponivel />;
  }

  const { itens, total, pagina, porPagina } = resultado;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const categoria = CATEGORIAS.find((c) => c.slug === filtros.categoria);
  // a página atual não é um filtro: sozinha, não mostra "limpar filtros"
  const temFiltro = Object.entries(filtros).some(([chave, valor]) => chave !== "pagina" && Boolean(valor));

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
            {TAMANHOS.map((t) => (
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
            name="precoMin"
            min={1}
            step="any"
            defaultValue={filtros.precoMinCentavos ? filtros.precoMinCentavos / 100 : ""}
            placeholder="de R$"
            aria-label="Preço mínimo em reais"
            className={campo}
          />
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
          <div className="flex gap-3 sm:col-span-2 lg:col-span-3 lg:justify-end">
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
          {total} {total === 1 ? "peça encontrada" : "peças encontradas"}
          {totalPaginas > 1 ? ` · página ${pagina} de ${totalPaginas}` : ""}
        </p>

        {itens.length > 0 ? (
          <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12">
            {itens.map((peca, i) => (
              <li key={peca.id}>
                <ProductCard peca={peca} prioridade={i < 2} status={statusAtual(peca)} />
              </li>
            ))}
          </ul>
        ) : total > 0 ? (
          // há peças, mas a página pedida passou do fim (ex.: link antigo com ?pagina=9)
          <p className="mt-6 rounded-3xl border-2 border-dashed border-roxo/40 p-10 text-center font-hand text-2xl">
            essa página não tem peças.{" "}
            <Link href={hrefVitrine(filtros, 1)} className="underline">
              voltar para a primeira
            </Link>
          </p>
        ) : (
          <p className="mt-6 rounded-3xl border-2 border-dashed border-roxo/40 p-10 text-center font-hand text-2xl">
            nada por aqui com esses filtros… tenta outra combinação ♡
          </p>
        )}

        {/* Paginação com links comuns: funciona sem JavaScript e mantém os filtros na URL. */}
        {totalPaginas > 1 ? (
          <nav aria-label="Paginação" className="mt-12 flex items-center justify-center gap-4">
            {pagina > 1 ? (
              <Link href={hrefVitrine(filtros, Math.min(pagina - 1, totalPaginas))} rel="prev" className={buttonClasses("fantasma", "sm", "underline")}>
                ← anterior
              </Link>
            ) : null}
            <span className="text-sm font-medium text-roxo-soft">
              página {pagina} de {totalPaginas}
            </span>
            {pagina < totalPaginas ? (
              <Link href={hrefVitrine(filtros, pagina + 1)} rel="next" className={buttonClasses("roxo", "sm")}>
                próxima →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
