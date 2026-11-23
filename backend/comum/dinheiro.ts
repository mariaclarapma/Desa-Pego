/**
 * Dinheiro sempre em centavos inteiros (decisão de arquitetura, Req. 014). Nunca float.
 *
 * O cálculo mudou para o pacote compartilhado `@desapego/core/pricing` (app/core do documento de
 * arquitetura, Req. 005), para o frontend usar exatamente o mesmo código no simulador de ganho.
 * Este arquivo continua exportando as mesmas funções, então quem já importava daqui não muda.
 */
export { dividirValor, formatarPercentual, PONTOS_BASE_100, type Divisao } from "@desapego/core/pricing";
