import Image from "next/image";
import Link from "next/link";
import { IconArrowRight, IconArrowUpRight } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { catalogoUrl, ROUTES } from "@/lib/routes";
import type { Categoria } from "@/types/catalogo";

const FUNDOS = ["bg-chiclete-100", "bg-lilas-100", "bg-pessego-100", "bg-chiclete", "bg-lilas"];

export function CategorySection({ categorias }: { categorias: Categoria[] }) {
  return (
    <section aria-labelledby="categorias-titulo" className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-6">
          <SectionHeading id="categorias-titulo" eyebrow="categorias">
            garimpa <span className="text-cereja italic">do seu jeito</span>
          </SectionHeading>
          <Link
            href={ROUTES.catalogo}
            className="group hidden shrink-0 items-center gap-2 pb-2 text-sm font-semibold text-vinho underline-offset-4 hover:underline sm:inline-flex"
          >
            ver tudo
            <IconArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* Rolagem horizontal no celular, grade no desktop */}
      <ul className="no-scrollbar mx-auto mt-10 flex max-w-7xl snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:scroll-px-6 sm:px-6 lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:px-8">
        {categorias.map((categoria, i) => (
          <li key={categoria.slug} className="w-[58%] shrink-0 snap-start sm:w-[36%] lg:w-auto">
            <Link href={catalogoUrl({ categoria: categoria.slug })} className="group block rounded-[1.5rem]">
              <div
                className={`shape-arch relative aspect-[3/4] overflow-hidden border-2 border-vinho transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[6px_6px_0_0_var(--color-vinho)] ${FUNDOS[i % FUNDOS.length]}`}
              >
                <Image
                  src={categoria.fotoUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 18vw, (min-width: 640px) 36vw, 58vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                />
                <span className="absolute right-3 bottom-3 grid size-10 translate-y-2 place-items-center rounded-full border-2 border-vinho bg-creme text-vinho opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                  <IconArrowUpRight size={18} />
                </span>
              </div>
              <h3 className="mt-4 font-display text-[1.75rem] leading-none font-medium tracking-tight text-vinho transition-colors group-hover:text-cereja">
                {categoria.nome}
              </h3>
              <p className="mt-1.5 font-hand text-xl text-vinho-soft">{categoria.chamada}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
