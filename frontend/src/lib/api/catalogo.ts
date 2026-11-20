import type { CategoriaSlug, Condicao, Peca, StatusPeca } from "@/types/catalogo";
import { api, ApiErro } from "./cliente";

export const listarPecas = () => api<Peca[]>("/pecas");

export async function buscarPeca(id: string): Promise<Peca | null> {
  try {
    return await api<Peca>(`/pecas/${encodeURIComponent(id)}`);
  } catch (erro) {
    if (erro instanceof ApiErro && erro.status === 404) return null;
    throw erro;
  }
}

/** Uma reserva vencida volta a contar como disponível (o "job de limpeza" da arquitetura). */
export function statusAtual(peca: Pick<Peca, "status" | "reservadaAte">, agora = new Date()): StatusPeca {
  if (peca.status === "reservada" && peca.reservadaAte && new Date(peca.reservadaAte) <= agora) {
    return "disponivel";
  }
  return peca.status;
}

/**
 * Reserva a peça única por 15 minutos (ADR-003). Quem decide é o servidor: ele confere,
 * numa fila, se a peça continua disponível (409 se outra pessoa reservou antes).
 */
export async function reservarPeca(id: string): Promise<Peca> {
  try {
    return await api<Peca>(`/pecas/${encodeURIComponent(id)}/reservar`, { method: "POST" });
  } catch (erro) {
    if (erro instanceof ApiErro && erro.status === 409) throw new Error("Essa peça acabou de ser reservada ou vendida por outra pessoa.");
    if (erro instanceof ApiErro && erro.status === 404) throw new Error("Essa peça não existe mais.");
    throw erro;
  }
}

/** Desfaz a reserva (ao tirar a peça da sacola). Uma peça vendida continua vendida. */
export const liberarPeca = (id: string) => api<Peca>(`/pecas/${encodeURIComponent(id)}/liberar`, { method: "POST" });

export type Ordem = "recentes" | "menor-preco" | "maior-preco";

export interface FiltrosVitrine {
  busca?: string;
  categoria?: CategoriaSlug;
  tamanho?: string;
  condicao?: Condicao;
  precoMaxCentavos?: number;
  ordem?: Ordem;
}

/** Minúsculas e sem acento, para a busca não diferenciar "Óculos" de "oculos". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/**
 * Filtros da vitrine (Req. 007). Lista só peças ativas: vendidas ficam de fora,
 * reservadas aparecem com o selo de reservada.
 */
export function filtrarPecas(pecas: Peca[], filtros: FiltrosVitrine, agora = new Date()): Peca[] {
  const termo = filtros.busca ? normalizar(filtros.busca) : "";
  const resultado = pecas.filter(
    (p) =>
      statusAtual(p, agora) !== "vendida" &&
      (!termo || normalizar(`${p.titulo} ${p.marca ?? ""} ${p.descricao}`).includes(termo)) &&
      (!filtros.categoria || p.categoria === filtros.categoria) &&
      (!filtros.tamanho || p.tamanho === filtros.tamanho) &&
      (!filtros.condicao || p.condicao === filtros.condicao) &&
      (!filtros.precoMaxCentavos || p.precoCentavos <= filtros.precoMaxCentavos),
  );
  const ordem = filtros.ordem ?? "recentes";
  return resultado.sort((a, b) => {
    if (ordem === "menor-preco") return a.precoCentavos - b.precoCentavos;
    if (ordem === "maior-preco") return b.precoCentavos - a.precoCentavos;
    return b.criadoEm.localeCompare(a.criadoEm);
  });
}
