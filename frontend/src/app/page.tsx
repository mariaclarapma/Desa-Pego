import { BenefitsSection } from "@/components/home/BenefitsSection";
import { CategorySection } from "@/components/home/CategorySection";
import { EditorialSection } from "@/components/home/EditorialSection";
import { HeroSection } from "@/components/home/HeroSection";
import { MarqueeStrip } from "@/components/home/MarqueeStrip";
import { ProductShowcase } from "@/components/home/ProductShowcase";
import { SellCtaSection } from "@/components/home/SellCtaSection";
// ⚠️ dados de demonstração até a API do catálogo (Módulo 03) existir
import { CATEGORIAS, GARIMPOS_DA_SEMANA, listarAchadinhos, listarDestaquesHero } from "@/data/demo/catalogo";

// ISR: regenera a Home a cada hora (vitrine e "edição do mês" sempre atuais).
export const revalidate = 3600;

export default async function HomePage() {
  const [achadinhos, destaques] = await Promise.all([listarAchadinhos(8), listarDestaquesHero()]);

  return (
    <>
      <HeroSection destaques={destaques} />
      <MarqueeStrip />
      <CategorySection categorias={CATEGORIAS} />
      <ProductShowcase pecas={achadinhos} />
      <SellCtaSection />
      <BenefitsSection />
      <EditorialSection garimpos={GARIMPOS_DA_SEMANA} />
    </>
  );
}
