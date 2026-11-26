import type { Foto, Peca } from "./loja.js";

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

/**
 * Galeria pública da peça (Req. 008): só `url` e `alt`, nunca a `chave` do armazenamento.
 * Foto sem `alt` (as dos anúncios) ganha um texto a partir do título. Peça sem `fotos` (ou com a
 * lista vazia) devolve a foto principal como única foto, assim o seed antigo continua funcionando.
 */
export function fotosDaPeca(peca: Pick<Peca, "titulo" | "fotos" | "fotoUrl" | "fotoAlt">): { url: string; alt: string }[] {
  const fotos: Foto[] = Array.isArray(peca.fotos) && peca.fotos.length > 0 ? peca.fotos : peca.fotoUrl ? [{ url: peca.fotoUrl, alt: peca.fotoAlt }] : [];
  return fotos.map((f, i) => ({
    url: f.url,
    alt: f.alt || (i === 0 && peca.fotoAlt ? peca.fotoAlt : `foto ${i + 1} de ${fotos.length}: ${peca.titulo}`),
  }));
}

/** Código no formato de Pix copia-e-cola, só para demonstração. */
export function pixSimulado(totalCentavos: number, txid: string) {
  const valor = (totalCentavos / 100).toFixed(2);
  return `00020126360014br.gov.bcb.pix0114DESAPEGODEMO5204000053039865405${valor}5802BR5908desaPego6008BRASILIA62140510${txid.toUpperCase()}6304DEMO`;
}

export const RESERVA_MINUTOS_PADRAO = 15;
export const RESERVA_MINUTOS_MAXIMO = 1440; // 24 horas

/**
 * Quanto tempo a reserva de uma peça dura, em minutos (RESERVA_MINUTOS no ambiente).
 * Vazio ou ausente usa o padrão de 15 (o .env gerado deixa a variável em branco). Valor inválido
 * derruba a inicialização com uma mensagem clara, em vez de criar reservas de 0 minutos sem ninguém notar.
 */
export function lerReservaMinutos(valor?: string) {
  const texto = (valor ?? "").trim();
  if (!texto) return RESERVA_MINUTOS_PADRAO;
  const minutos = /^\d+$/.test(texto) ? Number(texto) : NaN;
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > RESERVA_MINUTOS_MAXIMO) {
    throw new Error(`RESERVA_MINUTOS inválido ("${texto}"): use um número inteiro de minutos entre 1 e ${RESERVA_MINUTOS_MAXIMO}.`);
  }
  return minutos;
}
