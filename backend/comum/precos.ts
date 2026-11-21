import { CATEGORIAS, CONDICOES, type CategoriaSlug, type Condicao } from "./categorias.js";

/**
 * Tabela de preço sugerido (Req. 005 e 014): uma faixa (mínimo e máximo, em centavos) para
 * cada categoria e condição. A administração pode trocar a tabela; enquanto não troca, vale
 * esta tabela inicial.
 */
export interface FaixaPreco {
  categoria: CategoriaSlug;
  condicao: Condicao;
  minimoCentavos: number;
  maximoCentavos: number;
}

/** Faixa de uma peça em ótimo estado, por categoria. */
const BASE: Record<CategoriaSlug, [number, number]> = {
  feminino: [3000, 12_000],
  masculino: [3000, 12_000],
  calcados: [4000, 18_000],
  bolsas: [5000, 25_000],
  acessorios: [1500, 8000],
};

/** Quanto cada condição vale em relação a "ótimo estado" (em %). */
const FATOR: Record<Condicao, number> = {
  nova_com_etiqueta: 140,
  otimo_estado: 100,
  bom_estado: 75,
  com_marcas_de_uso: 50,
};

/** Arredonda para o real inteiro mais próximo (só inteiros). */
const emReais = (centavos: number) => Math.round(centavos / 100) * 100;

export const TABELA_PRECOS_INICIAL: FaixaPreco[] = CATEGORIAS.flatMap(({ slug }) =>
  CONDICOES.map((condicao) => ({
    categoria: slug,
    condicao,
    minimoCentavos: emReais((BASE[slug][0] * FATOR[condicao]) / 100),
    maximoCentavos: emReais((BASE[slug][1] * FATOR[condicao]) / 100),
  })),
);
