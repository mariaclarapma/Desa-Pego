import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { emailDuplicado, type Banco, type UsuarioRegistro } from "./banco.js";
import { cors } from "../../comum/seguranca.js";
import type { Config } from "./config.js";
import { LimiteTentativas } from "./limite.js";
import { conferirSenha, gerarHashSenha } from "./senhas.js";
import { gerarTokenAcesso, gerarTokenRefresh, hashToken, lerTokenAcesso } from "./tokens.js";
import { errosPorCampo, esquemaCadastro, esquemaExclusao, esquemaLogin, esquemaPerfil, esquemaSenha } from "./validacao.js";

const MINUTO = 60_000;
const ERRO_CREDENCIAIS = "e-mail ou senha incorretos.";

/** Dados públicos do usuário: a senha (nem o hash) nunca sai do serviço. */
const publico = (u: UsuarioRegistro) => ({ id: u.id, nome: u.nome, email: u.email });

/**
 * Serviço de contas (Módulo 01, Req. 001). Rotas em /auth:
 * POST /cadastro, POST /login, POST /refresh, POST /logout e o CRUD da própria conta:
 * GET /me, PATCH /me, PUT /me/senha e DELETE /me.
 */
export function criarApp(banco: Banco, config: Config, agora: () => number = Date.now) {
  // 5 erros em 15 min bloqueiam por 15 min (por e-mail e por IP); cadastro: 10 por hora por IP
  const falhasLogin = new LimiteTentativas(5, 15 * MINUTO, 15 * MINUTO, agora);
  const cadastros = new LimiteTentativas(10, 60 * MINUTO, 60 * MINUTO, agora);

  const app = express();
  app.disable("x-powered-by");
  // o frontend (Next.js, na mesma máquina) repassa as chamadas: o IP real vem do X-Forwarded-For.
  // Na hospedagem (Render) há mais um proxy na frente; veja TRUST_PROXY em config.ts
  app.set("trust proxy", config.trustProxy);
  app.use(helmet());
  app.use(cors(config.origens));
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  async function abrirSessao(res: Response, usuario: UsuarioRegistro) {
    const refresh = gerarTokenRefresh();
    const expira = new Date(agora() + config.refreshDias * 24 * 60 * MINUTO);
    await banco.criarSessao({ id: randomUUID(), usuario_id: usuario.id, token_hash: hashToken(refresh), expira_em: expira.toISOString() });
    res.cookie(config.cookieNome, refresh, {
      httpOnly: true,
      secure: config.cookieSeguro,
      sameSite: "strict",
      path: config.cookiePath,
      expires: expira,
    });
    const acesso = await gerarTokenAcesso({ sub: usuario.id, nome: usuario.nome, perfil: usuario.perfil }, config.jwtSegredo, config.acessoMinutos);
    return { usuario: publico(usuario), accessToken: acesso.token, expiraEm: acesso.expiraEm };
  }

  const limparCookie = (res: Response) =>
    res.clearCookie(config.cookieNome, { httpOnly: true, secure: config.cookieSeguro, sameSite: "strict", path: config.cookiePath });

  const bloqueado = (res: Response, ate: number) => {
    res.set("Retry-After", String(Math.ceil((ate - agora()) / 1000)));
    return res.status(429).json({ erro: "muitas tentativas seguidas. espere alguns minutos e tente de novo." });
  };

  const rotas = express.Router();

  rotas.get("/saude", (_req, res) => {
    res.json({ ok: true });
  });

  rotas.post("/cadastro", async (req, res) => {
    const ip = req.ip ?? "desconhecido";
    const ate = cadastros.bloqueadoAte(`ip:${ip}`);
    if (ate) return bloqueado(res, ate);

    const dados = esquemaCadastro.safeParse(req.body);
    if (!dados.success) return res.status(400).json({ erro: "confira os dados do formulário.", campos: errosPorCampo(dados.error) });
    cadastros.registrarFalha(`ip:${ip}`); // conta cada cadastro feito pelo IP

    const { nome, email, senha } = dados.data;
    if (await banco.usuarioPorEmail(email)) return res.status(409).json({ erro: "já existe uma conta com esse e-mail." });

    const usuario: UsuarioRegistro = {
      id: randomUUID(),
      nome,
      email,
      senha_hash: await gerarHashSenha(senha),
      perfil: "USUARIO",
      criado_em: new Date(agora()).toISOString(),
    };
    try {
      await banco.criarUsuario(usuario);
    } catch (erro) {
      // corrida entre dois cadastros com o mesmo e-mail: a restrição UNIQUE do banco decide
      if (emailDuplicado(erro)) return res.status(409).json({ erro: "já existe uma conta com esse e-mail." });
      throw erro;
    }
    res.status(201).json(await abrirSessao(res, usuario));
  });

  rotas.post("/login", async (req, res) => {
    const dados = esquemaLogin.safeParse(req.body);
    if (!dados.success) return res.status(400).json({ erro: "confira os dados do formulário.", campos: errosPorCampo(dados.error) });

    const { email, senha } = dados.data;
    const chaves = [`email:${email}`, `ip:${req.ip ?? "desconhecido"}`];
    const ate = Math.max(...chaves.map((c) => falhasLogin.bloqueadoAte(c) ?? 0));
    if (ate > agora()) return bloqueado(res, ate);

    const usuario = await banco.usuarioPorEmail(email);
    if (!(await conferirSenha(senha, usuario?.senha_hash))) {
      chaves.forEach((c) => falhasLogin.registrarFalha(c));
      return res.status(401).json({ erro: ERRO_CREDENCIAIS });
    }
    falhasLogin.limpar(chaves[0]);
    res.json(await abrirSessao(res, usuario!));
  });

  rotas.post("/refresh", async (req, res) => {
    const token: string | undefined = req.cookies?.[config.cookieNome];
    const sessao = token ? await banco.sessaoPorHash(hashToken(token)) : undefined;
    if (!sessao) {
      limparCookie(res);
      return res.status(401).json({ erro: "sessão expirada. entre de novo." });
    }
    if (sessao.revogada_em) {
      // um refresh token já usado voltou: pode ter sido roubado. Derruba todas as sessões da conta.
      await banco.revogarSessoesDoUsuario(sessao.usuario_id);
      limparCookie(res);
      return res.status(401).json({ erro: "sessão expirada. entre de novo." });
    }
    const usuario = await banco.usuarioPorId(sessao.usuario_id);
    if (!usuario || new Date(sessao.expira_em).getTime() <= agora()) {
      await banco.revogarSessao(sessao.id);
      limparCookie(res);
      return res.status(401).json({ erro: "sessão expirada. entre de novo." });
    }
    // rotação: cada refresh token vale uma vez só
    await banco.revogarSessao(sessao.id);
    res.json(await abrirSessao(res, usuario));
  });

  rotas.post("/logout", async (req, res) => {
    const token: string | undefined = req.cookies?.[config.cookieNome];
    const sessao = token ? await banco.sessaoPorHash(hashToken(token)) : undefined;
    if (sessao) await banco.revogarSessao(sessao.id);
    limparCookie(res);
    res.status(204).end();
  });

  /** Rotas privadas: exigem o token de acesso (Authorization: Bearer …) de uma conta que ainda existe. */
  async function autenticado(req: Request, res: Response, next: NextFunction) {
    const [tipo, token] = (req.get("authorization") ?? "").split(" ");
    const dados = tipo === "Bearer" && token ? await lerTokenAcesso(token, config.jwtSegredo) : null;
    const usuario = dados ? await banco.usuarioPorId(dados.sub) : undefined;
    if (!usuario) return res.status(401).json({ erro: "não autenticado." });
    res.locals.usuario = usuario;
    next();
  }

  /**
   * Reautenticação para operações sensíveis (trocar e-mail ou senha, excluir a conta).
   * Erros contam no mesmo limite do login: 5 senhas erradas bloqueiam por 15 minutos.
   */
  async function reautenticar(res: Response, usuario: UsuarioRegistro, senha: string | undefined, campo: string) {
    const chave = `conta:${usuario.id}`;
    const ate = falhasLogin.bloqueadoAte(chave);
    if (ate) {
      bloqueado(res, ate);
      return false;
    }
    if (!senha || !(await conferirSenha(senha, usuario.senha_hash))) {
      falhasLogin.registrarFalha(chave);
      res.status(403).json({ erro: "senha atual incorreta.", campos: { [campo]: "senha atual incorreta." } });
      return false;
    }
    falhasLogin.limpar(chave);
    return true;
  }

  const erroValidacao = (res: Response, erro: Parameters<typeof errosPorCampo>[0]) =>
    res.status(400).json({ erro: "confira os dados do formulário.", campos: errosPorCampo(erro) });

  // READ: dados do usuário logado
  rotas.get("/me", autenticado, (_req, res) => {
    res.json({ usuario: publico(res.locals.usuario) });
  });

  // UPDATE: nome e e-mail. Trocar o e-mail pede a senha atual.
  rotas.patch("/me", autenticado, async (req, res) => {
    const usuario: UsuarioRegistro = res.locals.usuario;
    const dados = esquemaPerfil.safeParse(req.body);
    if (!dados.success) return erroValidacao(res, dados.error);

    const { nome, email, senhaAtual } = dados.data;
    if (email !== usuario.email) {
      if (!(await reautenticar(res, usuario, senhaAtual, "senhaAtual"))) return;
      const dono = await banco.usuarioPorEmail(email);
      if (dono && dono.id !== usuario.id) return res.status(409).json({ erro: "já existe uma conta com esse e-mail." });
    }
    try {
      await banco.atualizarPerfil(usuario.id, nome, email);
    } catch (erro) {
      if (emailDuplicado(erro)) return res.status(409).json({ erro: "já existe uma conta com esse e-mail." });
      throw erro;
    }
    const atualizado = { ...usuario, nome, email };
    // o nome vai dentro do JWT: devolve um token de acesso novo (a sessão do cookie continua a mesma)
    const acesso = await gerarTokenAcesso({ sub: usuario.id, nome, perfil: usuario.perfil }, config.jwtSegredo, config.acessoMinutos);
    res.json({ usuario: publico(atualizado), accessToken: acesso.token, expiraEm: acesso.expiraEm });
  });

  // UPDATE: troca de senha com a senha atual. Derruba as outras sessões e abre uma nova neste aparelho.
  rotas.put("/me/senha", autenticado, async (req, res) => {
    const usuario: UsuarioRegistro = res.locals.usuario;
    const dados = esquemaSenha.safeParse(req.body);
    if (!dados.success) return erroValidacao(res, dados.error);
    if (!(await reautenticar(res, usuario, dados.data.senhaAtual, "senhaAtual"))) return;

    await banco.atualizarSenha(usuario.id, await gerarHashSenha(dados.data.novaSenha));
    await banco.revogarSessoesDoUsuario(usuario.id);
    res.json(await abrirSessao(res, usuario));
  });

  // DELETE: exclusão definitiva com a senha. Encerra todas as sessões e apaga o cookie.
  rotas.delete("/me", autenticado, async (req, res) => {
    const usuario: UsuarioRegistro = res.locals.usuario;
    const dados = esquemaExclusao.safeParse(req.body ?? {});
    if (!dados.success) return erroValidacao(res, dados.error);
    if (!(await reautenticar(res, usuario, dados.data.senha, "senha"))) return;

    await banco.revogarSessoesDoUsuario(usuario.id);
    await banco.excluirUsuario(usuario.id);
    limparCookie(res);
    res.status(204).end();
  });

  app.use("/auth", rotas);
  app.use((_req, res) => {
    res.status(404).json({ erro: "rota não encontrada." });
  });
  app.use((erro: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // JSON malformado vira 400; o resto é 500 sem expor detalhes internos
    if ((erro as { type?: string }).type === "entity.parse.failed") return res.status(400).json({ erro: "JSON inválido." });
    if ((erro as { type?: string }).type === "entity.too.large") return res.status(413).json({ erro: "requisição grande demais." });
    console.error("[contas]", erro);
    res.status(500).json({ erro: "erro interno. tente de novo." });
  });
  return app;
}
