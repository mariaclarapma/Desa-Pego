import type { ComponentType } from "react";
import {
  IconCoins,
  IconGem,
  IconHandshake,
  IconHanger,
  IconUsersHeart,
} from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";

type Beneficio = {
  Icon: ComponentType<{ size?: number }>;
  titulo: string;
  texto: string;
  estilo: string;
  grade: string;
  marca: string;
};

const BENEFICIOS: Beneficio[] = [
  {
    Icon: IconHanger,
    titulo: "dá uma nova vida às suas peças",
    texto: "aquela roupa esquecida no fundo do armário ainda tem muita história pra contar.",
    estilo: "bg-chiclete text-vinho",
    grade: "lg:col-span-3",
    marca: "♡",
  },
  {
    Icon: IconCoins,
    titulo: "ganha dinheiro com o que tá parado",
    texto: "anuncia, vende e recebe via Pix. simples assim.",
    estilo: "bg-lilas text-vinho",
    grade: "lg:col-span-3",
    marca: "R$",
  },
  {
    Icon: IconGem,
    titulo: "encontra peças únicas",
    texto: "nada de arara repetida: cada achado tem uma unidade só.",
    estilo: "bg-pessego text-vinho",
    grade: "lg:col-span-2",
    marca: "✦",
  },
  {
    Icon: IconHandshake,
    titulo: "compra de outras pessoas",
    texto: "de gente real, de várias cidades, com o pagamento intermediado pela plataforma.",
    estilo: "bg-creme-200 text-vinho",
    grade: "lg:col-span-2",
    marca: "↻",
  },
  {
    Icon: IconUsersHeart,
    titulo: "faz parte de uma comunidade",
    texto: "quem compra também vende. a moda circula e todo mundo sai ganhando.",
    estilo: "bg-cereja text-creme",
    grade: "sm:col-span-2 lg:col-span-2",
    marca: "∞",
  },
];

export function BenefitsSection() {
  return (
    <section aria-labelledby="beneficios-titulo" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="beneficios-titulo" eyebrow="por que desaPego" className="max-w-3xl">
          moda que circula, <span className="text-cereja italic">gente que se encontra</span>
        </SectionHeading>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-5">
          {BENEFICIOS.map(({ Icon, titulo, texto, estilo, grade, marca }, i) => (
            <li
              key={titulo}
              className={`group relative flex min-h-[15rem] flex-col overflow-hidden rounded-[2rem] border-2 border-vinho p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--color-vinho)] lg:p-8 ${i % 2 ? "hover:rotate-[0.6deg]" : "hover:-rotate-[0.6deg]"} ${estilo} ${grade}`}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-2 -bottom-8 font-display text-[9rem] leading-none font-semibold italic opacity-15 transition-transform duration-500 group-hover:-rotate-6 lg:text-[11rem]"
              >
                {marca}
              </span>
              <span className="grid size-14 place-items-center rounded-2xl border-2 border-vinho bg-creme text-vinho shadow-[3px_3px_0_0_var(--color-vinho)] transition-transform duration-300 group-hover:-rotate-6">
                <Icon size={26} />
              </span>
              <h3 className="mt-auto max-w-[18rem] pt-8 font-display text-[1.65rem] leading-[1.05] font-medium tracking-tight lg:text-3xl">
                {titulo}
              </h3>
              <p className="relative mt-2 max-w-sm text-[0.95rem] leading-relaxed opacity-85">{texto}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
