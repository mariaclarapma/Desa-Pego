import type { Condicao } from "@/types/catalogo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata centavos inteiros como moeda brasileira (ex.: 18990 → "R$ 189,90"). */
export function formatarPreco(centavos: number): string {
  if (!Number.isInteger(centavos)) {
    throw new TypeError("O preço deve estar em centavos inteiros.");
  }
  return brl.format(centavos / 100);
}

export const CONDICAO_LABEL: Record<Condicao, string> = {
  nova_com_etiqueta: "nova com etiqueta",
  otimo_estado: "ótimo estado",
  bom_estado: "bom estado",
  com_marcas_de_uso: "com marcas de uso",
};
