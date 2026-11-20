/**
 * Ponto único de acesso à API REST.
 * Em desenvolvimento é o json-server (db.json); no sistema real será o backend NestJS.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiErro extends Error {
  constructor(
    public status: number,
    caminho: string,
  ) {
    super(`Erro ${status} ao acessar ${caminho}`);
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
  if (!resposta.ok) throw new ApiErro(resposta.status, caminho);
  return (await resposta.json()) as T;
}
