/**
 * Ponto único de acesso à API REST do catálogo.
 * - No navegador: mesma origem (/api), repassada pelo Next.js (next.config.ts). Assim o site
 *   funciona em qualquer endereço (localhost ou Render) e não precisa de CORS.
 * - No servidor (páginas renderizadas pelo Next): direto na API do catálogo, na mesma máquina.
 */
export const API_URL =
  typeof window === "undefined" ? (process.env.CATALOGO_API_URL ?? "http://localhost:3001") : "/api";

export class ApiErro extends Error {
  constructor(
    public status: number,
    caminho: string,
    /** Mensagem do backend ({ erro }), quando houver. */
    public detalhe?: string,
  ) {
    super(detalhe ?? `Erro ${status} ao acessar ${caminho}`);
  }
}

export async function api<T>(caminho: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...resto } = init;
  const resposta = await fetch(`${API_URL}${caminho}`, {
    // estoque e preço nunca vêm do cache (documento de arquitetura, §7.2)
    cache: "no-store",
    ...resto,
    headers: { "Content-Type": "application/json", ...resto.headers },
    body: json === undefined ? resto.body : JSON.stringify(json),
  });
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    throw new ApiErro(resposta.status, caminho, corpo?.erro);
  }
  return (await resposta.json()) as T;
}
