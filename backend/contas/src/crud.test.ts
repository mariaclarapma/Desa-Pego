import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "./app.js";
import { usarBancoDeTeste } from "./banco-teste.js";
import type { Config } from "./config.js";

/**
 * CRUD da própria conta: CREATE (POST /auth/cadastro), READ (GET /auth/me),
 * UPDATE (PATCH /auth/me e PUT /auth/me/senha) e DELETE (DELETE /auth/me).
 */
const config: Config = {
  porta: 0,
  jwtSegredo: new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres"),
  acessoMinutos: 15,
  refreshDias: 30,
  cookieNome: "desapego_refresh",
  cookiePath: "/auth",
  cookieSeguro: false,
  trustProxy: "loopback",
  origens: ["http://localhost:3000"],
};

const ANA = { nome: "Ana Souza", email: "ana@exemplo.com", senha: "garimpo123" };
const BEA = { nome: "Bea Lima", email: "bea@exemplo.com", senha: "brecho2026" };

const lerBanco = usarBancoDeTeste();
let relogio: number;
let app: ReturnType<typeof criarApp>;

beforeEach(() => {
  relogio = Date.now();
  app = criarApp(lerBanco(), config, () => relogio);
});

const cookieRefresh = (res: request.Response) =>
  ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith("desapego_refresh="));

/** Cria a conta com um agente (que guarda o cookie) e devolve o token de acesso. */
async function criarConta(dados = ANA) {
  const cliente = request.agent(app);
  const res = await cliente.post("/auth/cadastro").send(dados).expect(201);
  return { cliente, token: res.body.accessToken as string, id: res.body.usuario.id as string };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("CREATE: POST /auth/cadastro", () => {
  it("cria a conta e grava no banco", async () => {
    const { id } = await criarConta();
    expect(await lerBanco().usuarioPorId(id)).toMatchObject({ nome: "Ana Souza", email: "ana@exemplo.com", perfil: "USUARIO" });
  });
});

describe("READ: GET /auth/me", () => {
  it("devolve só os dados públicos da conta logada", async () => {
    const { token, id } = await criarConta();
    const res = await request(app).get("/auth/me").set(bearer(token)).expect(200);
    expect(res.body).toEqual({ usuario: { id, nome: "Ana Souza", email: "ana@exemplo.com" } });
  });

  it("é privada: sem token ou com token vencido responde 401", async () => {
    await request(app).get("/auth/me").expect(401);
    await request(app).get("/auth/me").set("Authorization", "Basic abc").expect(401);
  });
});

describe("UPDATE: PATCH /auth/me (nome e e-mail)", () => {
  it("troca o nome sem pedir senha e devolve um token de acesso novo", async () => {
    const { token, id } = await criarConta();
    const res = await request(app).patch("/auth/me").set(bearer(token)).send({ nome: "Ana Paula Souza", email: ANA.email }).expect(200);

    expect(res.body.usuario).toEqual({ id, nome: "Ana Paula Souza", email: "ana@exemplo.com" });
    expect(res.body.accessToken).toMatch(/^ey/);
    expect((await lerBanco().usuarioPorId(id))!.nome).toBe("Ana Paula Souza");
  });

  it("trocar o e-mail exige a senha atual", async () => {
    const { token, id } = await criarConta();
    const novo = { nome: ANA.nome, email: "Ana.Nova@Exemplo.com" };

    const semSenha = await request(app).patch("/auth/me").set(bearer(token)).send(novo).expect(403);
    expect(semSenha.body.campos.senhaAtual).toBe("senha atual incorreta.");
    await request(app).patch("/auth/me").set(bearer(token)).send({ ...novo, senhaAtual: "errada123" }).expect(403);
    expect((await lerBanco().usuarioPorId(id))!.email).toBe("ana@exemplo.com");

    const ok = await request(app).patch("/auth/me").set(bearer(token)).send({ ...novo, senhaAtual: ANA.senha }).expect(200);
    expect(ok.body.usuario.email).toBe("ana.nova@exemplo.com");
    // o login passa a ser com o e-mail novo
    await request(app).post("/auth/login").send({ email: "ana.nova@exemplo.com", senha: ANA.senha }).expect(200);
    await request(app).post("/auth/login").send({ email: ANA.email, senha: ANA.senha }).expect(401);
  });

  it("não deixa usar o e-mail de outra conta", async () => {
    await criarConta(BEA);
    const { token } = await criarConta();
    const res = await request(app)
      .patch("/auth/me")
      .set(bearer(token))
      .send({ nome: ANA.nome, email: "BEA@exemplo.com", senhaAtual: ANA.senha })
      .expect(409);
    expect(res.body.erro).toMatch(/já existe uma conta/);
  });

  it("valida os dados no backend", async () => {
    const { token } = await criarConta();
    const res = await request(app).patch("/auth/me").set(bearer(token)).send({ nome: "Ana", email: "ana@" }).expect(400);
    expect(res.body.campos).toEqual({ nome: "informe nome e sobrenome.", email: expect.stringContaining("formato") });
  });

  it("exige autenticação", async () => {
    await request(app).patch("/auth/me").send({ nome: "Ana Souza", email: ANA.email }).expect(401);
  });
});

describe("UPDATE: PUT /auth/me/senha", () => {
  it("troca a senha conferindo a atual, guarda o novo hash e derruba as outras sessões", async () => {
    const { cliente, token, id } = await criarConta();
    // outra sessão aberta em outro aparelho
    const outroAparelho = request.agent(app);
    await outroAparelho.post("/auth/login").send(ANA).expect(200);
    const hashAntigo = (await lerBanco().usuarioPorId(id))!.senha_hash;

    const res = await cliente.put("/auth/me/senha").set(bearer(token)).send({ senhaAtual: ANA.senha, novaSenha: "novaSenha456" }).expect(200);
    expect(res.body.accessToken).toMatch(/^ey/);
    expect(cookieRefresh(res)).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain("novaSenha456");

    const hashNovo = (await lerBanco().usuarioPorId(id))!.senha_hash;
    expect(hashNovo).toMatch(/^\$argon2id\$/);
    expect(hashNovo).not.toBe(hashAntigo);

    // este aparelho continua logado com a sessão nova; o outro cai
    await cliente.post("/auth/refresh").expect(200);
    await outroAparelho.post("/auth/refresh").expect(401);

    await request(app).post("/auth/login").send(ANA).expect(401);
    await request(app).post("/auth/login").send({ email: ANA.email, senha: "novaSenha456" }).expect(200);
  });

  it("recusa senha atual errada, nova senha fraca ou igual à atual", async () => {
    const { token } = await criarConta();
    await request(app).put("/auth/me/senha").set(bearer(token)).send({ senhaAtual: "errada123", novaSenha: "novaSenha456" }).expect(403);

    const fraca = await request(app).put("/auth/me/senha").set(bearer(token)).send({ senhaAtual: ANA.senha, novaSenha: "curta" }).expect(400);
    expect(fraca.body.campos.novaSenha).toMatch(/8 caracteres/);

    const igual = await request(app).put("/auth/me/senha").set(bearer(token)).send({ senhaAtual: ANA.senha, novaSenha: ANA.senha }).expect(400);
    expect(igual.body.campos.novaSenha).toMatch(/diferente da atual/);

    await request(app).post("/auth/login").send(ANA).expect(200);
  });

  it("bloqueia depois de 5 senhas atuais erradas", async () => {
    const { token } = await criarConta();
    const tentar = (senhaAtual: string) => request(app).put("/auth/me/senha").set(bearer(token)).send({ senhaAtual, novaSenha: "novaSenha456" });
    for (let i = 0; i < 5; i++) await tentar("errada123").expect(403);
    await tentar(ANA.senha).expect(429);

    relogio += 16 * 60_000;
    await tentar(ANA.senha).expect(200);
  });
});

describe("DELETE: DELETE /auth/me", () => {
  it("exclui a conta com a senha, encerra as sessões e apaga o cookie", async () => {
    const { cliente, token, id } = await criarConta();
    const outroAparelho = request.agent(app);
    await outroAparelho.post("/auth/login").send(ANA).expect(200);

    const res = await cliente.delete("/auth/me").set(bearer(token)).send({ senha: ANA.senha }).expect(204);
    expect(cookieRefresh(res)).toMatch(/Expires=Thu, 01 Jan 1970/);

    expect(await lerBanco().usuarioPorId(id)).toBeUndefined();
    // nenhuma sessão sobrevive: nem o token de acesso, nem os refresh tokens dos aparelhos
    await request(app).get("/auth/me").set(bearer(token)).expect(401);
    await outroAparelho.post("/auth/refresh").expect(401);
    await request(app).post("/auth/login").send(ANA).expect(401);
  });

  it("o e-mail fica livre para um novo cadastro", async () => {
    const { token } = await criarConta();
    await request(app).delete("/auth/me").set(bearer(token)).send({ senha: ANA.senha }).expect(204);
    await request(app).post("/auth/cadastro").send(ANA).expect(201);
  });

  it("sem a senha certa, não exclui", async () => {
    const { token, id } = await criarConta();
    const semSenha = await request(app).delete("/auth/me").set(bearer(token)).expect(400);
    expect(semSenha.body.campos.senha).toBe("informe sua senha atual.");
    await request(app).delete("/auth/me").set(bearer(token)).send({ senha: "errada123" }).expect(403);
    expect(await lerBanco().usuarioPorId(id)).toBeDefined();
  });

  it("exige autenticação", async () => {
    await request(app).delete("/auth/me").send({ senha: ANA.senha }).expect(401);
  });

  it("uma conta não consegue excluir outra", async () => {
    const bea = await criarConta(BEA);
    const { token } = await criarConta();
    // o token da Ana só alcança a conta da Ana, mesmo com a senha da Bea
    await request(app).delete("/auth/me").set(bearer(token)).send({ senha: BEA.senha }).expect(403);
    expect(await lerBanco().usuarioPorId(bea.id)).toBeDefined();
  });
});
