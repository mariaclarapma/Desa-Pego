/**
 * Chamada a uma rota privada com o token de acesso da sessão (Authorization: Bearer …).
 * Usada pelo painel da administração e pelas telas de compras e vendas (Módulo 05).
 * O backend responde { erro, campos? }; a mensagem dele vira a mensagem do erro.
 */
export class ErroApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export async function chamarComToken<T>(token: string, metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`/api${caminho}`, {
      method: metodo,
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, ...(corpo === undefined ? {} : { "Content-Type": "application/json" }) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(0, "não conseguimos falar com o servidor. verifique sua conexão.");
  }
  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => null);
    const campos = dados?.campos ? Object.values(dados.campos as Record<string, string>)[0] : undefined;
    throw new ErroApi(resposta.status, campos ?? dados?.erro ?? `erro ${resposta.status}.`);
  }
  return (await resposta.json()) as T;
}
