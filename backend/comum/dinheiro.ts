/**
 * Dinheiro sempre em centavos inteiros (decisão de arquitetura, Req. 014). Nunca float.
 *
 * A comissão é guardada em "pontos-base": 1 ponto-base = 0,01%. Então 1000 = 10,00% e
 * 1250 = 12,50%. Assim o percentual também é inteiro.
 */
export const PONTOS_BASE_100 = 10_000;

export interface Divisao {
  totalCentavos: number;
  comissaoCentavos: number;
  vendedoraCentavos: number;
}

const inteiroNaoNegativo = (v: number) => Number.isSafeInteger(v) && v >= 0;

/**
 * Divide o valor das peças entre a plataforma (comissão) e a vendedora.
 * A comissão é arredondada para o centavo mais próximo (meio centavo sobe) usando só
 * inteiros, e a vendedora fica com o resto: comissão + vendedora = total, sempre, sem
 * diferença de centavo.
 */
export function dividirValor(totalCentavos: number, comissaoPontosBase: number): Divisao {
  if (!inteiroNaoNegativo(totalCentavos)) throw new RangeError("o total precisa ser um inteiro em centavos, maior ou igual a zero.");
  if (!inteiroNaoNegativo(comissaoPontosBase) || comissaoPontosBase > PONTOS_BASE_100) {
    throw new RangeError("a comissão precisa ser um inteiro entre 0 e 10000 pontos-base (0% a 100%).");
  }
  // BigInt: total × pontos-base não perde precisão nem para valores muito altos
  const produto = BigInt(totalCentavos) * BigInt(comissaoPontosBase);
  const comissaoCentavos = Number((produto + BigInt(PONTOS_BASE_100 / 2)) / BigInt(PONTOS_BASE_100));
  return { totalCentavos, comissaoCentavos, vendedoraCentavos: totalCentavos - comissaoCentavos };
}

/** "10,00%" a partir de 1000 pontos-base (para mensagens e telas). */
export const formatarPercentual = (pontosBase: number) =>
  `${Math.floor(pontosBase / 100)},${String(pontosBase % 100).padStart(2, "0")}%`;
