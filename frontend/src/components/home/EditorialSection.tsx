import Image from "next/image";
import Link from "next/link";
import { IconArrowUpRight } from "@/components/ui/icons";
import { Sticker } from "@/components/ui/Sticker";
import type { Garimpo } from "@/data/demo/catalogo";
import { catalogoUrl } from "@/lib/routes";

const LAYOUT = [
  // destaque grande à esquerda
  { grade: "col-span-2 lg:col-span-6 lg:row-span-2", proporcao: "aspect-[4/5] lg:aspect-auto lg:h-full", sizes: "(min-width: 1024px) 48vw, 100vw" },
  { grade: "col-span-1 lg:col-span-3", proporcao: "aspect-[3/4]", sizes: "(min-width: 1024px) 24vw, 50vw" },
  { grade: "col-span-1 lg:col-span-3", proporcao: "aspect-[3/4]", sizes: "(min-width: 1024px) 24vw, 50vw" },
  { grade: "col-span-2 lg:col-span-6", proporcao: "aspect-[16/10] lg:aspect-[2/1]", sizes: "(min-width: 1024px) 48vw, 100vw" },
];

function GarimpoCard({ garimpo, indice }: { garimpo: Garimpo; indice: number }) {
  const layout = LAYOUT[indice % LAYOUT.length];
  const destaque = indice === 0;
  return (
    <li className={`${layout.grade}`}>
      <Link
        href={catalogoUrl({ busca: garimpo.busca })}
        className="group relative block h-full overflow-hidden rounded-[1.5rem] border-2 border-roxo bg-roxo"
      >
        <div className={`relative ${layout.proporcao}`}>
          <Image
            src={garimpo.fotoUrl}
            alt={garimpo.fotoAlt}
            fill
            sizes={layout.sizes}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-roxo-900/85 via-roxo-900/15 to-transparent"
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-nevoa sm:p-6">
          <div>
            <p className="font-hand text-xl text-rosa sm:text-2xl">nº {garimpo.numero}</p>
            <h3
              className={`font-display leading-[0.95] font-medium tracking-tight ${
                destaque ? "text-4xl sm:text-5xl lg:text-6xl" : "text-2xl sm:text-3xl"
              }`}
            >
              {garimpo.titulo}
            </h3>
            <p className={`mt-1.5 text-sm text-nevoa/80 ${destaque ? "" : "hidden sm:block"}`}>{garimpo.legenda}</p>
          </div>
          <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-nevoa transition-all duration-300 group-hover:rotate-45 group-hover:bg-rosa group-hover:text-roxo">
            <IconArrowUpRight size={18} />
          </span>
        </div>
      </Link>
    </li>
  );
}

export function EditorialSection({ garimpos }: { garimpos: Garimpo[] }) {
  const mes = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date());

  return (
    <section
      aria-labelledby="garimpos-titulo"
      className="relative overflow-hidden border-t-2 border-roxo bg-pervinca-100 py-20 lg:py-28"
    >
      <div aria-hidden="true" className="bg-dots absolute inset-0 opacity-70" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 border-b-2 border-roxo pb-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="flex items-center gap-3 text-xs font-bold tracking-[0.2em] text-violeta uppercase">
              <span>edição de {mes}</span>
              <span aria-hidden="true" className="h-px w-10 bg-current" />
              <span>curadoria</span>
            </p>
            <h2
              id="garimpos-titulo"
              className="mt-4 font-display text-[3.2rem] leading-[0.88] font-medium tracking-[-0.05em] text-roxo [font-variation-settings:'SOFT'_100,'WONK'_1] sm:text-7xl lg:text-[6.5rem]"
            >
              garimpos <span className="text-violeta italic">da semana</span>
            </h2>
          </div>
          <div className="lg:col-span-4">
            <p className="text-lg leading-relaxed text-roxo-soft">
              <strong className="font-semibold text-roxo">peças que merecem outro armário.</strong> a nossa seleção de
              tendências pra você garimpar por cor, clima e estilo.
            </p>
          </div>
        </div>

        <div className="relative mt-10">
          <Sticker
            tone="rosa"
            rotate={-8}
            className="absolute -top-5 left-3 z-10 text-xl sm:left-6 sm:text-2xl lg:-top-6"
          >
            um novo amor por aqui ♡
          </Sticker>
          <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
            {garimpos.map((garimpo, i) => (
              <GarimpoCard key={garimpo.numero} garimpo={garimpo} indice={i} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
