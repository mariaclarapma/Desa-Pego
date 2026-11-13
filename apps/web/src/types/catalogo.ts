/**
 * Tipos de catálogo usados pela vitrine.
 * Espelham os campos do anúncio definidos no Req. 004 (categoria, tamanho, marca,
 * condição, preço e fotos). Quando a API do Módulo 03 existir, estes tipos devem
 * passar a vir do contrato OpenAPI.
 */

/** Selos padronizados de condição (Req. 004). */
export type Condicao = "nova_com_etiqueta" | "otimo_estado" | "bom_estado" | "com_marcas_de_uso";

export type CategoriaSlug = "feminino" | "masculino" | "calcados" | "bolsas" | "acessorios";

export interface Categoria {
  slug: CategoriaSlug;
  nome: string;
  chamada: string;
  fotoUrl: string;
  fotoAlt: string;
}

export interface PecaResumo {
  id: string;
  titulo: string;
  marca?: string;
  categoria: CategoriaSlug;
  tamanho: string;
  condicao: Condicao;
  /** Valores monetários sempre em centavos inteiros (decisão de arquitetura). */
  precoCentavos: number;
  fotoUrl: string;
  fotoAlt: string;
  vendedor: {
    nomePublico: string;
    cidade: string;
  };
}
