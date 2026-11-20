import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { IconArrowRight, IconHeart, IconPix, IconSparkle, IconTag } from "@/components/ui/icons";
import { Sticker } from "@/components/ui/Sticker";
import { formatarPreco } from "@/lib/format";
import { pecaUrl, ROUTES } from "@/lib/routes";
import type { PecaResumo } from "@/types/catalogo";

const GARANTIAS = [
  { Icon: IconPix, texto: "pagamento via Pix" },
  { Icon: IconTag, texto: "cada peça é única" },
  { Icon: IconHeart, texto: "de gente pra gente" },
];

/**
 * Posição de cada peça na colagem (em % do quadro, para escalar do celular ao desktop).
 * A ordem segue a de listarDestaquesHero().
 */
const COLAGEM = [
  {
    posicao: "left-[2%] top-[9%] w-[44%] -rotate-[5deg]",
    proporcao: "aspect-[4/5]",
    etiqueta: "-bottom-4 left-1/2 -translate-x-1/2 rotate-[4deg] bg-rosa",
  },
  {
    posicao: "right-[3%] top-[1%] w-[40%] rotate-[4deg]",
    proporcao: "aspect-square",
    etiqueta: "-bottom-4 -left-3 -rotate-[6deg] bg-pervinca",
  },
  {
    posicao: "right-0 bottom-[5%] w-[46%] -rotate-[3deg]",
    proporcao: "aspect-[5/4]",
    etiqueta: "-top-4 right-4 rotate-[5deg] bg-lilas",
  },
  {
    posicao: "left-[12%] bottom-0 w-[33%] rotate-[7deg]",
    proporcao: "aspect-square",
    etiqueta: "-right-5 bottom-3 -rotate-[8deg] bg-nevoa",
  },
];

/** Selo redondo girando com texto em volta. Decorativo. */
function SeloGiratorio({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none grid place-items-center ${className}`}>
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full animate-spin-slow">
        <defs>
          <path id="selo-circulo" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
        </defs>
        <circle cx="60" cy="60" r="58" className="fill-violeta stroke-roxo" strokeWidth="2" />
        <text className="fill-nevoa font-sans text-[11.5px] font-bold tracking-[0.2em] uppercase">
          <textPath href="#selo-circulo">desapega · garimpa · repete ✦ </textPath>
        </text>
      </svg>
      <IconHeart filled size={28} className="relative text-rosa" />
    </div>
  );
}

/** Peça "colada" na colagem: foto com moldura branca de adesivo + etiqueta de preço. */
function PecaColada({ peca, indice }: { peca: PecaResumo; indice: number }) {
  const layout = COLAGEM[indice % COLAGEM.length];
  const preco = formatarPreco(peca.precoCentavos);
  return (
    <Link
      href={pecaUrl(peca.id)}
      aria-label={`${peca.titulo}, ${preco}`}
      className={`group absolute rounded-[1.4rem] transition-transform duration-300 ease-out hover:z-20 hover:rotate-0 hover:scale-[1.04] focus-visible:z-20 ${layout.posicao}`}
    >
      <div className="rounded-[1.4rem] border-2 border-roxo bg-white p-1.5 shadow-[6px_6px_0_0_var(--color-roxo)] sm:p-2">
        <div className={`relative overflow-hidden rounded-[1rem] bg-nevoa-200 ${layout.proporcao}`}>
          <Image
            src={peca.fotoUrl}
            alt=""
            fill
            priority={indice === 0}
            sizes="(min-width: 1024px) 22vw, 45vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
        </div>
      </div>
      <span
        aria-hidden="true"
        className={`absolute inline-flex items-center gap-1.5 rounded-full border-2 border-roxo py-0.5 pr-3 pl-2 font-display text-sm font-semibold whitespace-nowrap text-roxo shadow-[2px_2px_0_0_var(--color-roxo)] sm:text-base ${layout.etiqueta}`}
      >
        <span className="size-2 rounded-full border-2 border-roxo bg-white" />
        {preco}
      </span>
    </Link>
  );
}

export function HeroSection({ destaques }: { destaques: PecaResumo[] }) {
  return (
    <section aria-labelledby="hero-titulo" className="relative overflow-hidden">
      <div aria-hidden="true" className="bg-dots absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:pt-14 lg:pb-20">
        {/* Texto */}
        <div className="lg:col-span-6">
          <Sticker tone="lilas" rotate={-3}>
            <IconSparkle size={14} /> brechó online comunitário
          </Sticker>

          <h1
            id="hero-titulo"
            className="mt-6 font-display text-[3.4rem] leading-[0.9] font-medium tracking-[-0.05em] text-roxo [font-variation-settings:'SOFT'_100,'WONK'_1] sm:text-[5rem] xl:text-[6.1rem]"
          >
            seu próximo{" "}
            <br />
            <span className="relative inline-block font-semibold text-violeta italic">
              achadinho
              <svg
                aria-hidden="true"
                viewBox="0 0 300 24"
                preserveAspectRatio="none"
                className="absolute -bottom-2 left-0 h-4 w-full text-magenta sm:-bottom-3 sm:h-5"
              >
                <path
                  d="M3 15C40 4 70 22 105 12s68-9 100 1 60 4 92-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            <br />
            está aqui<span className="text-magenta">.</span>
          </h1>

          <p className="mt-8 max-w-[30rem] text-lg leading-relaxed text-roxo-soft sm:text-xl">
            o que você não usa mais pode ser <strong className="font-semibold text-roxo">o novo favorito de alguém</strong>.
            garimpa peças únicas ou anuncia as suas, tudo com pagamento via Pix.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <ButtonLink href={ROUTES.catalogo} size="lg" variant="violeta" iconRight={<IconArrowRight size={20} />}>
              explorar peças
            </ButtonLink>
            <ButtonLink href={ROUTES.anunciar} size="lg" variant="nevoa">
              anunciar minhas peças
            </ButtonLink>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-roxo">
            {GARANTIAS.map(({ Icon, texto }) => (
              <li key={texto} className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-rosa-100 text-violeta">
                  <Icon size={15} />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        {/* Colagem de peças */}
        <div className="relative mx-auto h-[27rem] w-full max-w-[34rem] sm:h-[34rem] lg:col-span-6 lg:h-[38rem] lg:max-w-none">
          <div
            aria-hidden="true"
            className="absolute top-[10%] left-[6%] h-[80%] w-[88%] rounded-[46%_54%_42%_58%/55%_45%_55%_45%] bg-rosa-100"
          />
          <div aria-hidden="true" className="bg-gingham absolute top-[30%] right-[16%] h-[34%] w-[30%] rotate-6 rounded-3xl opacity-80" />
          <IconSparkle aria-hidden="true" size={30} className="absolute top-[3%] left-[48%] text-magenta" />
          <IconSparkle aria-hidden="true" size={18} className="absolute bottom-[34%] left-[3%] text-lilas" />

          <p className="sr-only">Achadinhos em destaque:</p>
          <ul>
            {destaques.map((peca, i) => (
              <li key={peca.id}>
                <PecaColada peca={peca} indice={i} />
              </li>
            ))}
          </ul>

          <SeloGiratorio className="absolute top-[40%] left-[38%] z-10 size-24 sm:size-28" />

          <Sticker tone="rosa" rotate={-7} className="absolute top-0 left-0 z-10 text-base sm:text-xl">
            achadinhos do dia ♡
          </Sticker>
        </div>
      </div>
    </section>
  );
}
