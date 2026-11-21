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
  /** "ADMIN_MASTER" mostra o atalho do painel. Quem decide o acesso é o backend. */
  perfil?: "USUARIO" | "ADMIN" | "ADMIN_MASTER";
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
    // e-mail ou CPF já cadastrado: o backend diz qual campo, sem revelar dados da outra conta
    if (erro.status === 409) {
      if (campos?.cpf) return new ContaErro(campos.cpf, 409, { cpf: campos.cpf });
      return new ContaErro("já existe uma conta com esse e-mail. tente entrar.", 409, campos?.email ? { email: campos.email } : undefined);
    }
    if (erro.status === 429) return new ContaErro("muitas tentativas seguidas. espere alguns minutos e tente de novo.", 429);
    if (erro.status === 400 || erro.status === 422) {
      return new ContaErro(detalhe ?? "confira os dados do formulário e tente de novo.", erro.status, campos);
    }
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

/** O CPF vai só com os dígitos; o backend valida de novo e nunca o devolve. */
export const cadastrar = (nome: string, email: string, cpf: string, senha: string) =>
  chamar("cadastro", () => postar<Sessao>("/auth/cadastro", { nome, email, cpf: cpf.replace(/\D/g, ""), senha }));

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

/* ------------------------------------------------------------------------------------------------
 * Perfil de vendedora e chave Pix (Req. 002). A chave completa nunca volta do backend: só o tipo,
 * a máscara e a data. Cadastrar ou trocar a chave pede a senha atual.
 * ---------------------------------------------------------------------------------------------- */

export type TipoChavePix = "cpf" | "email" | "telefone" | "aleatoria";

export interface PerfilVendedora {
  id: string;
  /** null = a vitrine mostra o primeiro nome (`nomeNaVitrine`). */
  nomePublico: string | null;
  nomeNaVitrine: string;
  cidade: string | null;
  pix: { tipo: TipoChavePix; mascarada: string; atualizadaEm: string } | null;
  /** Existe uma chave salva, mas ela não pode ser lida: a vendedora precisa cadastrar de novo. */
  pixIndisponivel: boolean;
}

/** READ: nome público, cidade e a chave Pix mascarada da conta logada. */
export const lerPerfilVendedora = (token: string) =>
  chamar("conta", async () => (await requisitar<{ vendedora: PerfilVendedora }>("GET", "/auth/me/vendedora", undefined, token)).vendedora);

/** UPDATE: nome público (vazio = primeiro nome) e cidade. */
export const atualizarPerfilVendedora = (token: string, dados: { nomePublico: string; cidade: string }) =>
  chamar("conta", async () => (await requisitar<{ vendedora: PerfilVendedora }>("PATCH", "/auth/me/vendedora", dados, token)).vendedora);

/** UPDATE: cadastra ou troca a chave Pix. Devolve um token novo, que já libera a publicação de anúncios. */
export const salvarChavePix = (token: string, dados: { tipo: TipoChavePix; chave: string; senhaAtual: string }) =>
  chamar("conta", () =>
    requisitar<{ vendedora: PerfilVendedora; accessToken: string; expiraEm: string }>("PUT", "/auth/me/pix", dados, token),
  );
