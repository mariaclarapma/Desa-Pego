import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import { IconCamera, IconPix, IconSparkle, IconTag } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Sticker, Tape } from "@/components/ui/Sticker";
import { IMAGENS_HOME } from "@/data/demo/imagens";
import { ROUTES } from "@/lib/routes";

const PASSOS = [
  {
    Icon: IconCamera,
    titulo: "fotografa sua peça",
    texto: "de 1 a 5 fotos, de preferência com luz natural. mostra os detalhes e, se tiver, os defeitos também.",
  },
  {
    Icon: IconTag,
    titulo: "cadastra o anúncio",
    texto: "tamanho, marca, condição e preço. o simulador mostra na hora quanto fica pra você.",
  },
  {
    Icon: IconPix,
    titulo: "recebe quando vender",
    texto: "a compra é paga via Pix e o valor entra na sua carteira, prontinho para o repasse.",
  },
];

export function SellCtaSection() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="desapega-titulo"
      className="relative scroll-mt-28 overflow-hidden bg-vinho py-20 text-creme lg:py-28"
    >
      <div
        aria-hidden="true"
        className="absolute -top-40 -right-40 size-[28rem] rounded-full bg-cereja/40 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-7xl gap-16 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-10 lg:px-8">
        <div className="lg:col-span-7">
          <SectionHeading id="desapega-titulo" eyebrow="desapega também" tom="creme">
            tem peça parada no armário?{" "}
            <span className="text-chiclete italic">vira dinheiro.</span>
          </SectionHeading>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-creme/80">
            anunciar é simples e você vê quanto vai receber antes mesmo de publicar. a gente cuida da reserva e da
            cobrança, você só separa a peça.
          </p>

          <ol className="mt-10 grid gap-4 sm:grid-cols-3 lg:gap-5">
            {PASSOS.map(({ Icon, titulo, texto }, i) => (
              <li
                key={titulo}
                className="group relative rounded-[1.5rem] border-2 border-creme/25 bg-vinho-900/40 p-5 transition-colors hover:border-chiclete"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-full bg-chiclete text-vinho transition-transform duration-300 group-hover:-rotate-12">
                    <Icon size={22} />
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-display text-5xl leading-none font-semibold text-transparent italic [-webkit-text-stroke:1.5px_var(--color-chiclete)]"
                  >
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-2xl leading-tight font-medium">
                  <span className="sr-only">Passo {i + 1}: </span>
                  {titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-creme/75">{texto}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap items-center gap-5">
            <ButtonLink href={ROUTES.anunciar} variant="chicleteSobreEscuro" size="lg">
              quero desapegar
            </ButtonLink>
            <span className="font-hand text-2xl text-chiclete">é rapidinho, prometo ✦</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-sm lg:col-span-5 lg:max-w-none">
          <div className="relative mx-auto w-[85%] rotate-[-3deg]">
            <Tape className="-top-3 left-1/2 -translate-x-1/2 rotate-2" />
            <div className="shape-arch relative aspect-[3/4] overflow-hidden border-2 border-creme shadow-[10px_10px_0_0_var(--color-chiclete)]">
              <Image
                src={IMAGENS_HOME.arara.src}
                alt={IMAGENS_HOME.arara.alt}
                fill
                sizes="(min-width: 1024px) 34vw, 80vw"
                className="object-cover"
              />
            </div>
          </div>
          <Sticker tone="creme" rotate={-6} className="absolute top-[18%] -left-1 max-w-[12rem] text-center sm:-left-4">
            você vê quanto vai receber antes de publicar
          </Sticker>
          <Sticker tone="pessego" rotate={7} className="absolute -right-1 bottom-[12%] sm:-right-3">
            <IconSparkle size={14} /> vendeu, recebeu!
          </Sticker>
        </div>
      </div>
    </section>
  );
}
