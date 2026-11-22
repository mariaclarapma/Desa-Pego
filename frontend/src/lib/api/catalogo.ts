import type { CategoriaSlug, Condicao, Peca, StatusPeca } from "@/types/catalogo";
import { api, ApiErro } from "./cliente";

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
export async function reservarPeca(id: string, token: string): Promise<Peca> {
  try {
    return await api<Peca>(`/pecas/${encodeURIComponent(id)}/reservar`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  } catch (erro) {
    if (erro instanceof ApiErro && erro.status === 409) throw new Error("Essa peça acabou de ser reservada ou vendida por outra pessoa.");
    if (erro instanceof ApiErro && erro.status === 404) throw new Error("Essa peça não existe mais.");
    if (erro instanceof ApiErro && erro.status === 403) throw new Error(erro.detalhe ?? "Você não pode reservar essa peça.");
    throw erro;
  }
}

/** Desfaz a reserva (ao tirar a peça da sacola). Só quem reservou libera; peça vendida continua vendida. */
export const liberarPeca = (id: string, token: string) =>
  api<Peca>(`/pecas/${encodeURIComponent(id)}/liberar`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });

export type Ordem = "recentes" | "menor-preco" | "maior-preco";

export interface FiltrosVitrine {
  busca?: string;
  categoria?: CategoriaSlug;
  tamanho?: string;
  condicao?: Condicao;
  precoMinCentavos?: number;
  precoMaxCentavos?: number;
  ordem?: Ordem;
  pagina?: number;
  porPagina?: number;
}

/** Uma página da vitrine, como o GET /pecas responde. */
export interface PaginaVitrine {
  itens: Peca[];
  /** Total de peças que atendem aos filtros (somando todas as páginas). */
  total: number;
  pagina: number;
  porPagina: number;
}

/**
 * Vitrine (Req. 007). Quem busca, filtra, ordena e pagina é o servidor; aqui só montamos
 * a URL. Ele lista só peças ativas (sem vendidas; reservadas vêm com o status de reservada).
 * Preços vão em centavos, como a API espera.
 */
export function listarPecas(filtros: FiltrosVitrine = {}): Promise<PaginaVitrine> {
  const parametros: Record<string, string | number | undefined> = {
    busca: filtros.busca,
    categoria: filtros.categoria,
    tamanho: filtros.tamanho,
    condicao: filtros.condicao,
    precoMin: filtros.precoMinCentavos,
    precoMax: filtros.precoMaxCentavos,
    ordem: filtros.ordem,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
  };
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== "") query.set(chave, String(valor));
  }
  const texto = query.toString();
  return api<PaginaVitrine>(texto ? `/pecas?${texto}` : "/pecas");
}
