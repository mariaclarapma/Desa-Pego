import { ProductCard } from "@/components/catalogo/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { IconArrowRight } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Sticker } from "@/components/ui/Sticker";
import { catalogoUrl } from "@/lib/routes";
import type { PecaResumo } from "@/types/catalogo";

export function ProductShowcase({ pecas }: { pecas: PecaResumo[] }) {
  return (
    <section aria-labelledby="achadinhos-titulo" className="border-y-2 border-vinho bg-chiclete-100/60 py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading id="achadinhos-titulo" eyebrow="acabou de chegar">
            achadinhos pra
            <br className="hidden sm:block" /> chamar <span className="text-cereja italic">de seus</span>
          </SectionHeading>
          <Sticker tone="creme" rotate={3} className="self-start sm:self-auto">
            só tem uma de cada, viu?
          </Sticker>
        </div>

        {pecas.length > 0 ? (
          <ul className="mt-10 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 lg:mt-14 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12">
            {pecas.map((peca, i) => (
              <li key={peca.id}>
                <ProductCard peca={peca} prioridade={i < 2} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-10 rounded-3xl border-2 border-dashed border-vinho/40 p-10 text-center font-hand text-2xl">
            as peças estão chegando… volta daqui a pouquinho ♡
          </p>
        )}

        <div className="mt-12 flex justify-center">
          <ButtonLink
            href={catalogoUrl({ ordem: "recentes" })}
            variant="vinho"
            size="lg"
            iconRight={<IconArrowRight size={20} />}
          >
            ver todos os achadinhos
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
