/**
 * app/core/pricing (Req. 005, ADR-002): o cálculo de dinheiro da plataforma, num lugar só.
 * O serviço de pedidos usa para gravar o pedido e a carteira; o frontend usa no simulador de ganho.
 * Como é o mesmo código, o valor que a vendedora vê ao anunciar é o valor que ela recebe.
 *
 * Dinheiro sempre em centavos inteiros (Req. 014), nunca float. Percentuais em "pontos-base":
 * 1 ponto-base = 0,01%, então 1000 = 10,00% e 1250 = 12,50%. Os percentuais NÃO ficam aqui:
 * vêm da configuração do admin (GET /api/gestao/config).
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

/** Comissão e taxa do Pix vigentes, como o admin definiu. */
export interface TaxasPlataforma {
  comissaoPontosBase: number;
  taxaPixPontosBase: number;
}

export interface Repasse {
  subtotalCentavos: number;
  freteCentavos: number;
  /** O que a compradora paga: peças + frete. */
  totalCentavos: number;
  comissaoCentavos: number;
  taxaPixCentavos: number;
  /** O que a vendedora recebe na carteira. */
  vendedoraCentavos: number;
}

/**
 * Regra da carteira (Req. 011 e 014) para um pedido de uma vendedora:
 * - a comissão incide só sobre as peças;
 * - a taxa do Pix incide sobre tudo o que a compradora paga (peças + frete);
 * - a vendedora recebe as peças menos a comissão, mais o frete (quem envia é ela), menos a taxa do Pix.
 */
export function calcularRepasse(subtotalCentavos: number, freteCentavos: number, taxas: TaxasPlataforma): Repasse {
  if (!inteiroNaoNegativo(freteCentavos)) throw new RangeError("o frete precisa ser um inteiro em centavos, maior ou igual a zero.");
  const totalCentavos = subtotalCentavos + freteCentavos;
  const divisao = dividirValor(subtotalCentavos, taxas.comissaoPontosBase);
  const taxaPixCentavos = dividirValor(totalCentavos, taxas.taxaPixPontosBase).comissaoCentavos;
  return {
    subtotalCentavos,
    freteCentavos,
    totalCentavos,
    comissaoCentavos: divisao.comissaoCentavos,
    taxaPixCentavos,
    vendedoraCentavos: divisao.vendedoraCentavos + freteCentavos - taxaPixCentavos,
  };
}

/** Mensagem de erro do preço de uma peça, ou null se é válido (centavos inteiros e maior que zero). */
export function validarPreco(precoCentavos: unknown): string | null {
  if (typeof precoCentavos !== "number" || !Number.isInteger(precoCentavos)) return "o preço precisa estar em centavos inteiros.";
  if (precoCentavos <= 0) return "o preço precisa ser maior que zero.";
  if (!Number.isSafeInteger(precoCentavos)) return "o preço é alto demais.";
  return null;
}

/**
 * Simulador de ganho (Req. 005): quanto a vendedora recebe se esta peça for vendida sozinha num pedido.
 * É a mesma conta da carteira (calcularRepasse) com o subtotal igual ao preço da peça.
 */
export function simularGanho(precoCentavos: number, freteCentavos: number, taxas: TaxasPlataforma): Repasse {
  const erro = validarPreco(precoCentavos);
  if (erro) throw new RangeError(erro);
  return calcularRepasse(precoCentavos, freteCentavos, taxas);
}
