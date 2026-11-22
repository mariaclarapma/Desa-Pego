import type { Peca } from "./loja.js";

/** Erro de regra de negócio: vira a resposta { erro } com o status dado. */
export class Recusa extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/** Uma reserva vencida volta a contar como disponível. */
export function statusAtual(peca: Pick<Peca, "status" | "reservadaAte">, agora: number) {
  if (peca.status === "reservada" && peca.reservadaAte && new Date(peca.reservadaAte).getTime() <= agora) return "disponivel";
  return peca.status;
}

/** Código no formato de Pix copia-e-cola, só para demonstração. */
export function pixSimulado(totalCentavos: number, txid: string) {
  const valor = (totalCentavos / 100).toFixed(2);
  return `00020126360014br.gov.bcb.pix0114DESAPEGODEMO5204000053039865405${valor}5802BR5908desaPego6008BRASILIA62140510${txid.toUpperCase()}6304DEMO`;
}
