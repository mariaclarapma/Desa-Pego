/**
 * Categorias permitidas no desaPego: só moda (roupas, calçados, bolsas e acessórios).
 * Lista fixa, controlada pela administração: mudar exige mudar este arquivo (com revisão).
 * O Módulo 02 (anúncios) usa `categoriaPermitida` para recusar anúncio fora da lista
 * (ex.: veículos, eletrônicos, imóveis); o painel do admin usa para marcar anúncios irregulares.
 */
export const CATEGORIAS = [
  { slug: "feminino", nome: "roupas femininas" },
  { slug: "masculino", nome: "roupas masculinas" },
  { slug: "calcados", nome: "calçados" },
  { slug: "bolsas", nome: "bolsas" },
  { slug: "acessorios", nome: "acessórios (bijuterias, cintos, óculos, chapéus…)" },
] as const;

export type CategoriaSlug = (typeof CATEGORIAS)[number]["slug"];

const SLUGS = new Set<string>(CATEGORIAS.map((c) => c.slug));

export const categoriaPermitida = (slug: unknown): slug is CategoriaSlug => typeof slug === "string" && SLUGS.has(slug);

/** Condições de uma peça (as mesmas do site, em `types/catalogo.ts`). */
export const CONDICOES = ["nova_com_etiqueta", "otimo_estado", "bom_estado", "com_marcas_de_uso"] as const;

export type Condicao = (typeof CONDICOES)[number];

export const condicaoValida = (v: unknown): v is Condicao => typeof v === "string" && (CONDICOES as readonly string[]).includes(v);
