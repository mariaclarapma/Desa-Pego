import { randomBytes } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "./app.js";
import { usarBancoDeTeste } from "./banco-teste.js";
import type { Config } from "./config.js";
import { chavesCpfTemporarias } from "./cpf-cripto.js";
import { garantirAdminMaster } from "./seed.js";

/** Módulo 05: administradora master (seed), bloqueio de contas e acesso ao painel. */
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
  cpf: chavesCpfTemporarias(),
};

// senhas geradas a cada execução: nenhuma credencial (nem de teste) fica escrita no código
const senhaDeTeste = () => `Teste${randomBytes(6).toString("hex")}9`;
const MASTER = { ADMIN_MASTER_EMAIL: "lucy@desapego.test", ADMIN_MASTER_PASSWORD: senhaDeTeste() };
const ANA = { nome: "Ana Souza", email: "ana@exemplo.com", cpf: "529.982.247-25", senha: "garimpo123" };

const lerBanco = usarBancoDeTeste();
let app: ReturnType<typeof criarApp>;

beforeEach(() => {
  app = criarApp(lerBanco(), config);
});

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function entrarComoMaster() {
  await garantirAdminMaster(lerBanco(), MASTER);
  const res = await request(app).post("/auth/login").send({ email: MASTER.ADMIN_MASTER_EMAIL, senha: MASTER.ADMIN_MASTER_PASSWORD }).expect(200);
  return res.body.accessToken as string;
}

async function criarAna() {
  const cliente = request.agent(app);
  const res = await cliente.post("/auth/cadastro").send(ANA).expect(201);
  return { cliente, token: res.body.accessToken as string, id: res.body.usuario.id as string };
}

describe("seed da administradora master", () => {
  it("cria a conta a partir do ambiente, com perfil ADMIN_MASTER, e não duplica", async () => {
    expect(await garantirAdminMaster(lerBanco(), MASTER)).toBe("criada");
    expect(await garantirAdminMaster(lerBanco(), MASTER)).toBe("ok");
    const lucy = await lerBanco().usuarioPorEmail(MASTER.ADMIN_MASTER_EMAIL);
    expect(lucy).toMatchObject({ perfil: "ADMIN_MASTER", bloqueada: false });
    expect(lucy!.senha_hash).toMatch(/^\$argon2id\$/);
  });

  it("sem as variáveis, não cria nada", async () => {
    expect(await garantirAdminMaster(lerBanco(), {})).toBe("sem-config");
    expect(await lerBanco().adminMaster()).toBeUndefined();
  });

  it("promove uma conta que já existe com o e-mail configurado", async () => {
    await criarAna();
    expect(await garantirAdminMaster(lerBanco(), { ADMIN_MASTER_EMAIL: ANA.email, ADMIN_MASTER_PASSWORD: senhaDeTeste() })).toBe("promovida");
    expect((await lerBanco().usuarioPorEmail(ANA.email))!.perfil).toBe("ADMIN_MASTER");
  });

  it("só existe uma: recusa uma segunda master com outro e-mail", async () => {
    await garantirAdminMaster(lerBanco(), MASTER);
    await expect(garantirAdminMaster(lerBanco(), { ADMIN_MASTER_EMAIL: "outra@desapego.test", ADMIN_MASTER_PASSWORD: senhaDeTeste() })).rejects.toThrow(
      /só pode existir uma/,
    );
  });

  it("recusa e-mail inválido ou senha fraca no ambiente", async () => {
    await expect(garantirAdminMaster(lerBanco(), { ADMIN_MASTER_EMAIL: "lucy@", ADMIN_MASTER_PASSWORD: senhaDeTeste() })).rejects.toThrow();
    await expect(garantirAdminMaster(lerBanco(), { ADMIN_MASTER_EMAIL: MASTER.ADMIN_MASTER_EMAIL, ADMIN_MASTER_PASSWORD: "fraca" })).rejects.toThrow();
  });

  it("a administradora master não pode excluir a própria conta", async () => {
    const token = await entrarComoMaster();
    await request(app).delete("/auth/me").set(bearer(token)).send({ senha: MASTER.ADMIN_MASTER_PASSWORD }).expect(403);
    expect(await lerBanco().adminMaster()).toBeDefined();
  });
});

describe("painel do admin: usuárias (Req. 015: acesso de quem não é admin)", () => {
  it("quem não é administradora recebe 403; sem login, 401", async () => {
    const { token, id } = await criarAna();
    await request(app).get("/auth/admin/usuarios").set(bearer(token)).expect(403);
    await request(app).post(`/auth/admin/usuarios/${id}/bloquear`).set(bearer(token)).expect(403);
    await request(app).get("/auth/admin/usuarios").expect(401);
  });

  it("lista e busca contas por nome ou e-mail, sem senha nem hash", async () => {
    const token = await entrarComoMaster();
    await criarAna();
    const todas = await request(app).get("/auth/admin/usuarios").set(bearer(token)).expect(200);
    expect(todas.body.usuarios).toHaveLength(2);
    expect(JSON.stringify(todas.body)).not.toContain("senha_hash");
    const busca = await request(app).get("/auth/admin/usuarios?busca=SOUZA").set(bearer(token)).expect(200);
    expect(busca.body.usuarios.map((u: { email: string }) => u.email)).toEqual([ANA.email]);
  });

  it("bloquear impede login, renovação e uso do token; desbloquear devolve o acesso", async () => {
    const master = await entrarComoMaster();
    const ana = await criarAna();

    const res = await request(app).post(`/auth/admin/usuarios/${ana.id}/bloquear`).set(bearer(master)).expect(200);
    expect(res.body.usuario.bloqueada).toBe(true);
    await request(app).post("/auth/login").send({ email: ANA.email, senha: ANA.senha }).expect(403);
    await ana.cliente.post("/auth/refresh").expect(401);
    await request(app).get("/auth/me").set(bearer(ana.token)).expect(403);

    await request(app).post(`/auth/admin/usuarios/${ana.id}/desbloquear`).set(bearer(master)).expect(200);
    await request(app).post("/auth/login").send({ email: ANA.email, senha: ANA.senha }).expect(200);
  });

  it("senha errada de conta bloqueada continua com a mensagem genérica (não revela o bloqueio)", async () => {
    const master = await entrarComoMaster();
    const ana = await criarAna();
    await request(app).post(`/auth/admin/usuarios/${ana.id}/bloquear`).set(bearer(master)).expect(200);
    const res = await request(app).post("/auth/login").send({ email: ANA.email, senha: "errada123" }).expect(401);
    expect(res.body.erro).toBe("e-mail ou senha incorretos.");
  });

  it("não bloqueia a administradora master; id inválido é 400 e conta inexistente é 404", async () => {
    const master = await entrarComoMaster();
    const lucy = await lerBanco().adminMaster();
    await request(app).post(`/auth/admin/usuarios/${lucy!.id}/bloquear`).set(bearer(master)).expect(403);
    await request(app).post("/auth/admin/usuarios/nao-e-uuid/bloquear").set(bearer(master)).expect(400);
    await request(app).post("/auth/admin/usuarios/00000000-0000-4000-8000-000000000000/bloquear").set(bearer(master)).expect(404);
  });
});
