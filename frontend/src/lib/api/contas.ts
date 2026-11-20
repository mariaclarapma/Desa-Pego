import { ApiErro } from "./cliente";

/**
 * Contas (Módulo 01, Req. 001), servidas pelo serviço de contas do backend (backend/contas).
 * O backend devolve um JWT curto (guardado só na memória) e grava o refresh token num cookie
 * httpOnly; a senha nunca volta na resposta.
 */
export interface UsuarioLogado {
  id: string;
  nome: string;
  email: string;
}

export interface Sessao {
  usuario: UsuarioLogado;
  accessToken: string;
  expiraEm: string;
}

export class ContaErro extends Error {
  constructor(
    mensagem: string,
    public status?: number,
    /** Erros por campo vindos do backend ({ campo: mensagem }), para mostrar ao lado do input. */
    public campos?: Record<string, string>,
  ) {
    super(mensagem);
  }
}

type ErroComDetalhe = ApiErro & { detalhe?: string; campos?: Record<string, string> };

/** Chamada na mesma origem (/api → serviço de contas, ver next.config.ts), com o cookie de sessão. */
async function requisitar<T>(metodo: string, caminho: string, corpo?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (corpo !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const resposta = await fetch(`/api${caminho}`, {
    method: metodo,
    credentials: "same-origin",
    headers: Object.keys(headers).length ? headers : undefined,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!resposta.ok) {
    const erro: ErroComDetalhe = new ApiErro(resposta.status, caminho);
    // o backend responde { erro, campos? } com a mensagem já pronta para mostrar
    const corpoErro = await resposta.json().catch(() => null);
    erro.campos = corpoErro?.campos;
    erro.detalhe = corpoErro?.campos ? Object.values(corpoErro.campos as Record<string, string>)[0] : corpoErro?.erro;
    throw erro;
  }
  return (resposta.status === 204 ? null : await resposta.json()) as T;
}

const postar = <T,>(caminho: string, corpo?: unknown) => requisitar<T>("POST", caminho, corpo);

type Modo = "entrar" | "cadastro" | "sessao" | "conta";

function traduzir(erro: unknown, modo: Modo): ContaErro {
  if (erro instanceof ApiErro) {
    const { detalhe, campos } = erro as ErroComDetalhe;
    // reautenticação recusada (senha atual errada) nas operações da conta
    if (erro.status === 403) return new ContaErro(detalhe ?? "senha atual incorreta.", 403, campos);
    if (erro.status === 400 && modo === "conta") return new ContaErro(detalhe ?? "confira os dados do formulário.", 400, campos);
    if (erro.status === 404 || erro.status === 501) {
      return new ContaErro("o serviço de contas não respondeu. confira se o backend está rodando (npm run dev).", erro.status);
    }
    // mensagem genérica de propósito: não revela se o e-mail existe (Req. 001)
    if (erro.status === 401) {
      return new ContaErro(modo === "sessao" || modo === "conta" ? "sua sessão expirou. entre de novo." : "e-mail ou senha incorretos.", 401);
    }
    if (erro.status === 409) return new ContaErro("já existe uma conta com esse e-mail. tente entrar.", 409);
    if (erro.status === 429) return new ContaErro("muitas tentativas seguidas. espere alguns minutos e tente de novo.", 429);
    if (erro.status === 400 || erro.status === 422) return new ContaErro(detalhe ?? "confira os dados do formulário e tente de novo.", erro.status);
    if (erro.status >= 500) return new ContaErro("o serviço de contas está fora do ar agora. tente de novo em instantes.", erro.status);
  }
  return new ContaErro(
    modo === "cadastro"
      ? "não conseguimos criar sua conta agora. verifique sua conexão e tente de novo."
      : "não conseguimos falar com o servidor agora. verifique sua conexão e tente de novo.",
  );
}

async function chamar<T>(modo: Modo, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (erro) {
    throw traduzir(erro, modo);
  }
}

export const entrar = (email: string, senha: string) => chamar("entrar", () => postar<Sessao>("/auth/login", { email, senha }));

export const cadastrar = (nome: string, email: string, senha: string) =>
  chamar("cadastro", () => postar<Sessao>("/auth/cadastro", { nome, email, senha }));

/** Recupera a sessão pelo cookie httpOnly (ao abrir a página ou quando o JWT vence). */
export const renovarSessao = () =>
  chamar("sessao", async () => {
    const sessao = await postar<Sessao | null>("/auth/refresh");
    if (!sessao?.usuario) throw new ContaErro("sua sessão expirou.", 401);
    return sessao;
  });

export const sair = () => chamar("sessao", () => postar<null>("/auth/logout"));

/* ------------------------------------------------------------------------------------------------
 * CRUD da própria conta. Todas as rotas são privadas: vão com o token de acesso no cabeçalho
 * Authorization. Trocar e-mail, trocar senha e excluir a conta pedem a senha atual.
 * ---------------------------------------------------------------------------------------------- */

/** READ: dados atuais da conta logada. */
export const lerPerfil = (token: string) =>
  chamar("conta", async () => (await requisitar<{ usuario: UsuarioLogado }>("GET", "/auth/me", undefined, token)).usuario);

/** UPDATE: nome e e-mail. Devolve um token de acesso novo (o nome vai dentro do JWT). */
export const atualizarPerfil = (token: string, dados: { nome: string; email: string; senhaAtual?: string }) =>
  chamar("conta", () => requisitar<Sessao>("PATCH", "/auth/me", dados, token));

/** UPDATE: troca a senha. As outras sessões caem e este aparelho recebe uma sessão nova. */
export const alterarSenha = (token: string, senhaAtual: string, novaSenha: string) =>
  chamar("conta", () => requisitar<Sessao>("PUT", "/auth/me/senha", { senhaAtual, novaSenha }, token));

/** DELETE: exclui a conta de vez, com a senha. Todas as sessões são encerradas. */
export const excluirConta = (token: string, senha: string) =>
  chamar("conta", () => requisitar<null>("DELETE", "/auth/me", { senha }, token));

/**
 * Executa uma operação privada com o token da sessão. Se o token de acesso (15 min) tiver
 * vencido, renova a sessão pelo cookie uma única vez e tenta de novo.
 */
export async function comSessao<T>(sessao: Sessao, operacao: (token: string) => Promise<T>, aoRenovar: (nova: Sessao) => void): Promise<T> {
  try {
    return await operacao(sessao.accessToken);
  } catch (erro) {
    if (!(erro instanceof ContaErro) || erro.status !== 401) throw erro;
    const nova = await renovarSessao();
    aoRenovar(nova);
    return operacao(nova.accessToken);
  }
}
