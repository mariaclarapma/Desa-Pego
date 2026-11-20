import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "./app.js";
import { usarBancoDeTeste } from "./banco-teste.js";
import type { Config } from "./config.js";

const config: Config = {
  porta: 0,
  jwtSegredo: new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres"),
  acessoMinutos: 15,
  refreshDias: 30,
  cookieNome: "desapego_refresh",
  cookiePath: "/auth", // nos testes o cliente fala direto com o serviço (sem o proxy /api)
  cookieSeguro: false,
  trustProxy: "loopback",
  origens: ["http://localhost:3000"],
};

const ANA = { nome: "Ana Souza", email: "Ana@Exemplo.com", senha: "garimpo123" };

const lerBanco = usarBancoDeTeste();
let relogio: number;
let app: ReturnType<typeof criarApp>;

beforeEach(() => {
  relogio = Date.now();
  app = criarApp(lerBanco(), config, () => relogio);
});

const cookieRefresh = (res: request.Response) =>
  ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith("desapego_refresh="));

describe("POST /auth/cadastro", () => {
  it("cria a conta, guarda só o hash Argon2id e abre a sessão com cookie httpOnly", async () => {
    const res = await request(app).post("/auth/cadastro").send(ANA).expect(201);

    expect(res.body.usuario).toEqual({ id: expect.any(String), nome: "Ana Souza", email: "ana@exemplo.com", perfil: "USUARIO" });
    expect(res.body.accessToken).toMatch(/^ey/);
    expect(JSON.stringify(res.body)).not.toContain("garimpo123");
    expect(JSON.stringify(res.body)).not.toContain("argon2");

    const cookie = cookieRefresh(res)!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);

    const salvo = (await lerBanco().usuarioPorEmail("ana@exemplo.com"))!;
    expect(salvo.senha_hash).toMatch(/^\$argon2id\$/);
    expect(salvo.senha_hash).not.toContain("garimpo123");
  });

  it("rejeita e-mail repetido, sem diferenciar maiúsculas", async () => {
    await request(app).post("/auth/cadastro").send(ANA).expect(201);
    const res = await request(app).post("/auth/cadastro").send({ ...ANA, email: "ana@exemplo.COM" }).expect(409);
    expect(res.body.erro).toMatch(/já existe uma conta/);
  });

  it("valida os dados no backend e responde por campo", async () => {
    const res = await request(app).post("/auth/cadastro").send({ nome: "Ana", email: "ana@", senha: "curta" }).expect(400);
    expect(res.body.campos).toEqual({
      nome: "informe nome e sobrenome.",
      email: expect.stringContaining("formato"),
      senha: expect.stringContaining("8 caracteres"),
    });
    expect(await lerBanco().usuarioPorEmail("ana@")).toBeUndefined();
  });

  it("recusa JSON malformado com 400", async () => {
    await request(app).post("/auth/cadastro").set("Content-Type", "application/json").send("{quebrado").expect(400);
  });
});

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/auth/cadastro").send(ANA).expect(201);
  });

  it("entra com e-mail (sem diferenciar maiúsculas) e senha corretos", async () => {
    const res = await request(app).post("/auth/login").send({ email: "ANA@exemplo.com", senha: "garimpo123" }).expect(200);
    expect(res.body.usuario.nome).toBe("Ana Souza");
    expect(cookieRefresh(res)).toBeDefined();
  });

  it("usa a mesma mensagem para senha errada e e-mail inexistente", async () => {
    const senhaErrada = await request(app).post("/auth/login").send({ email: ANA.email, senha: "errada123" }).expect(401);
    const semConta = await request(app).post("/auth/login").send({ email: "nao@existe.com", senha: "errada123" }).expect(401);
    expect(senhaErrada.body).toEqual(semConta.body);
    expect(senhaErrada.body.erro).toBe("e-mail ou senha incorretos.");
  });

  it("bloqueia por 15 minutos depois de 5 tentativas erradas", async () => {
    for (let i = 0; i < 5; i++) await request(app).post("/auth/login").send({ email: ANA.email, senha: "errada123" }).expect(401);

    const bloqueado = await request(app).post("/auth/login").send({ email: ANA.email, senha: "garimpo123" }).expect(429);
    expect(Number(bloqueado.headers["retry-after"])).toBeGreaterThan(800);

    relogio += 16 * 60_000;
    await request(app).post("/auth/login").send({ email: ANA.email, senha: "garimpo123" }).expect(200);
  });
});

describe("sessão: /auth/me, /auth/refresh e /auth/logout", () => {
  it("o token de acesso identifica o usuário em /auth/me", async () => {
    const { body } = await request(app).post("/auth/cadastro").send(ANA).expect(201);
    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${body.accessToken}`).expect(200);
    expect(me.body.usuario.email).toBe("ana@exemplo.com");
    await request(app).get("/auth/me").expect(401);
    await request(app).get("/auth/me").set("Authorization", "Bearer token-falso").expect(401);
  });

  it("renova a sessão trocando o refresh token, e derruba tudo se um token antigo for reusado", async () => {
    const cliente = request.agent(app);
    await cliente.post("/auth/cadastro").send(ANA).expect(201);
    const primeiro = cookieRefresh(await cliente.post("/auth/login").send(ANA).expect(200))!;

    const renovado = await cliente.post("/auth/refresh").expect(200);
    expect(renovado.body.usuario.nome).toBe("Ana Souza");
    expect(cookieRefresh(renovado)).not.toBe(primeiro);

    // alguém reapresenta o refresh token antigo (já usado): todas as sessões caem
    await request(app).post("/auth/refresh").set("Cookie", primeiro.split(";")[0]).expect(401);
    await cliente.post("/auth/refresh").expect(401);
  });

  it("sair revoga a sessão e apaga o cookie", async () => {
    const cliente = request.agent(app);
    await cliente.post("/auth/cadastro").send(ANA).expect(201);

    const saida = await cliente.post("/auth/logout").expect(204);
    expect(cookieRefresh(saida)).toMatch(/Expires=Thu, 01 Jan 1970/);
    await cliente.post("/auth/refresh").expect(401);
  });

  it("sessão vencida não renova", async () => {
    const cliente = request.agent(app);
    await cliente.post("/auth/cadastro").send(ANA).expect(201);
    relogio += 31 * 24 * 60 * 60_000;
    await cliente.post("/auth/refresh").expect(401);
  });
});

it("rotas desconhecidas respondem 404 em JSON", async () => {
  const res = await request(app).get("/auth/nada").expect(404);
  expect(res.body.erro).toBeDefined();
});
