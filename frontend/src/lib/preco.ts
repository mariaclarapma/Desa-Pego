/**
 * Converte o que a pessoa digita em reais ("89,90", "89.9", "1.250,00", "R$ 89") para centavos inteiros.
 * Devolve null se não for um valor em reais com no máximo 2 casas decimais.
 */
export function reaisParaCentavos(texto: string): number | null {
  let limpo = texto.replace(/R\$|\s/g, "");
  if (!limpo) return null;
  // com vírgula, os pontos são separadores de milhar (padrão brasileiro)
  if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(limpo)) return null;
  const [inteiro, decimal = ""] = limpo.replace("-", "").split(".");
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, "0"));
  return limpo.startsWith("-") ? -centavos : centavos;
}

/** Centavos no formato do campo de preço (ex.: 8990 → "89,90"). */
export const centavosParaCampo = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");
