import { randomBytes } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { lerToken } from "../../comum/autenticacao.js";
import { criarApp } from "./app.js";
import { usarBancoDeTeste } from "./banco-teste.js";
import type { Config } from "./config.js";
import { chavesCpfTemporarias } from "./cpf-cripto.js";
import { lerChavePixCompletaParaRepasse } from "./pix.js";

/**
 * Req. 002: perfil de vendedora (nome público e cidade) e chave Pix.
 * GET/PATCH /auth/me/vendedora, PUT /auth/me/pix e GET /auth/vendedoras/:id.
 */
const jwtSegredo = new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres");
const pixCriptoChave = randomBytes(32);
const config: Config = {
  porta: 0,
  jwtSegredo,
  acessoMinutos: 15,
  refreshDias: 30,
  cookieNome: "desapego_refresh",
  cookiePath: "/auth",
  cookieSeguro: false,
  trustProxy: "loopback",
  origens: ["http://localhost:3000"],
  cpf: chavesCpfTemporarias(),
  pixCriptoChave,
};

// o cadastro exige CPF desde o Req. 001 (os mesmos CPFs de teste do crud.test.ts)
const ANA = { nome: "Ana Souza", email: "ana@exemplo.com", cpf: "529.982.247-25", senha: "garimpo123" };
const BEA = { nome: "Bea Lima", email: "bea@exemplo.com", cpf: "111.444.777-35", senha: "brecho2026" };
const CPF = "52998224725";

const lerBanco = usarBancoDeTeste();
let app: ReturnType<typeof criarApp>;

beforeEach(() => {
  app = criarApp(lerBanco(), config);
});

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function criarConta(dados = ANA) {
  const cliente = request.agent(app);
  const res = await cliente.post("/auth/cadastro").send(dados).expect(201);
  return { cliente, token: res.body.accessToken as string, id: res.body.usuario.id as string };
}

const salvarPix = (token: string, corpo: Record<string, unknown>) => request(app).put("/auth/me/pix").set(bearer(token)).send(corpo);

describe("GET/PATCH /auth/me/vendedora: nome público e cidade", () => {
  it("conta nova: sem nome público (vitrine usa o primeiro nome), sem cidade e sem chave", async () => {
    const { token, id } = await criarConta();
    const res = await request(app).get("/auth/me/vendedora").set(bearer(token)).expect(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toEqual({ vendedora: { id, nomePublico: null, nomeNaVitrine: "Ana", cidade: null, pix: null, pixIndisponivel: false } });
  });

  it("edita nome público e cidade, e os dados ficam salvos no banco", async () => {
    const { token, id } = await criarConta();
    const res = await request(app)
      .patch("/auth/me/vendedora")
      .set(bearer(token))
      .send({ nomePublico: "  Brechó   da Ana ", cidade: "Brasília/DF" })
      .expect(200);
    expect(res.body.vendedora).toMatchObject({ nomePublico: "Brechó da Ana", nomeNaVitrine: "Brechó da Ana", cidade: "Brasília/DF" });
    expect(await lerBanco().usuarioPorId(id)).toMatchObject({ nome_publico: "Brechó da Ana", cidade: "Brasília/DF" });
  });

  it("nome público vazio volta para o primeiro nome", async () => {
    const { token } = await criarConta();
    await request(app).patch("/auth/me/vendedora").set(bearer(token)).send({ nomePublico: "Brechó da Ana", cidade: "Recife" }).expect(200);
    const res = await request(app).patch("/auth/me/vendedora").set(bearer(token)).send({ nomePublico: "", cidade: "Recife" }).expect(200);
    expect(res.body.vendedora).toMatchObject({ nomePublico: null, nomeNaVitrine: "Ana" });
  });

  it("nome público ausente, null, vazio ou só espaços: grava NULL (nunca texto vazio)", async () => {
    const { token, id } = await criarConta();
    for (const corpo of [{ cidade: "Recife" }, { nomePublico: null, cidade: "Recife" }, { nomePublico: "", cidade: "Recife" }, { nomePublico: "   ", cidade: "Recife" }]) {
      await request(app).patch("/auth/me/vendedora").set(bearer(token)).send({ nomePublico: "Brechó da Ana", cidade: "Recife" }).expect(200);
      const res = await request(app).patch("/auth/me/vendedora").set(bearer(token)).send(corpo).expect(200);
      expect(res.body.vendedora).toMatchObject({ nomePublico: null, nomeNaVitrine: "Ana" });
      expect((await lerBanco().usuarioPorId(id))?.nome_publico).toBeNull();
    }
  });

  it("números curtos no nome público continuam permitidos", async () => {
    const { token } = await criarConta();
    // 10 números no total: ainda não pode ser um CPF
    for (const nomePublico of ["Brechó 2026 loja 7", "Ana 12345 67890"]) {
      await request(app).patch("/auth/me/vendedora").set(bearer(token)).send({ nomePublico, cidade: "Recife" }).expect(200);
    }
  });

  it("campos inválidos: 400 com a mensagem por campo", async () => {
    const { token } = await criarConta();
    const casos: [Record<string, unknown>, string][] = [
      [{ nomePublico: "Ana", cidade: "" }, "cidade"],
      [{ nomePublico: "Ana" }, "cidade"],
      [{ nomePublico: "Ana", cidade: "Cidade 123" }, "cidade"],
      [{ nomePublico: "A", cidade: "Recife" }, "nomePublico"],
      [{ nomePublico: "x".repeat(41), cidade: "Recife" }, "nomePublico"],
      [{ nomePublico: "<script>", cidade: "Recife" }, "nomePublico"],
      // CPF nunca no perfil público, nem se a pessoa digitar no nome
      [{ nomePublico: "Ana 529.982.247-25", cidade: "Recife" }, "nomePublico"],
      [{ nomePublico: "Ana 52998224725", cidade: "Recife" }, "nomePublico"],
      // CPF separado por espaços ou outros caracteres também não passa
      [{ nomePublico: "Ana 529 982 247 25", cidade: "Recife" }, "nomePublico"],
      [{ nomePublico: "Ana 529-982 247.25", cidade: "Recife" }, "nomePublico"],
      [{ nomePublico: "5 2 9 9 8 2 2 4 7 2 5", cidade: "Recife" }, "nomePublico"],
      [{ nomePublico: "a5a2a9a9a8a2a2a4a7a2a5", cidade: "Recife" }, "nomePublico"],
    ];
    for (const [corpo, campo] of casos) {
      const res = await request(app).patch("/auth/me/vendedora").set(bearer(token)).send(corpo).expect(400);
      expect(res.body.campos).toHaveProperty(campo);
    }
  });

  it("sem token: 401", async () => {
    await request(app).get("/auth/me/vendedora").expect(401);
    await request(app).patch("/auth/me/vendedora").send({ cidade: "Recife" }).expect(401);
  });
});

describe("PUT /auth/me/pix: cadastrar e trocar a chave Pix", () => {
  it("cadastra com a senha: guarda só cifrada, devolve mascarada e um token que libera anúncios", async () => {
    const { token, id } = await criarConta();
    expect((await lerToken(`Bearer ${token}`, jwtSegredo))?.temChavePix).toBe(false);

    const res = await salvarPix(token, { tipo: "cpf", chave: "529.982.247-25", senhaAtual: ANA.senha }).expect(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.vendedora.pix).toMatchObject({ tipo: "cpf", mascarada: "***.982.247-**" });
    expect(JSON.stringify(res.body)).not.toContain(CPF);
    expect((await lerToken(`Bearer ${res.body.accessToken}`, jwtSegredo))?.temChavePix).toBe(true);

    const registro = await lerBanco().chavePix(id);
    expect(registro).toMatchObject({ usuario_id: id, tipo: "cpf" });
    expect(registro!.chave_cifrada).not.toContain(CPF);
    expect(registro!.chave_cifrada).toMatch(/^v1\./);
  });

  it("troca a chave (inclusive de tipo): fica só a nova", async () => {
    const { token, id } = await criarConta();
    await salvarPix(token, { tipo: "cpf", chave: CPF, senhaAtual: ANA.senha }).expect(200);
    const res = await salvarPix(token, { tipo: "telefone", chave: "(61) 91234-5678", senhaAtual: ANA.senha }).expect(200);
    expect(res.body.vendedora.pix).toMatchObject({ tipo: "telefone", mascarada: "(61) *****-5678" });
    expect(await lerBanco().chavePix(id)).toMatchObject({ tipo: "telefone" });
    // a administração (Issue #014) lê a chave nova completa, pelo uso restrito do serviço
    expect(await lerChavePixCompletaParaRepasse(lerBanco(), pixCriptoChave, id)).toEqual({ tipo: "telefone", chave: "+5561912345678" });
  });

  it.each([
    ["email", "Ana@Exemplo.com", "an***@exemplo.com"],
    ["aleatoria", "3f2a8b1c-4d5e-4f60-8a7b-9c0d1e2f9c1d", "3f2a****…****9c1d"],
  ])("aceita chave do tipo %s", async (tipo, chave, mascarada) => {
    const { token } = await criarConta();
    const res = await salvarPix(token, { tipo, chave, senhaAtual: ANA.senha }).expect(200);
    expect(res.body.vendedora.pix.mascarada).toBe(mascarada);
  });

  it("chave inválida para o tipo, tipo desconhecido ou sem senha: 400 e nada é salvo", async () => {
    const { token, id } = await criarConta();
    const casos: [Record<string, unknown>, string][] = [
      [{ tipo: "cpf", chave: "529.982.247-24", senhaAtual: ANA.senha }, "chave"],
      [{ tipo: "email", chave: "ana@", senhaAtual: ANA.senha }, "chave"],
      [{ tipo: "telefone", chave: "(61) 3123-4567", senhaAtual: ANA.senha }, "chave"],
      [{ tipo: "aleatoria", chave: "123", senhaAtual: ANA.senha }, "chave"],
      [{ tipo: "cpf", chave: "", senhaAtual: ANA.senha }, "chave"],
      [{ tipo: "boleto", chave: CPF, senhaAtual: ANA.senha }, "tipo"],
      [{ tipo: "cpf", chave: CPF }, "senhaAtual"],
    ];
    for (const [corpo, campo] of casos) {
      const res = await salvarPix(token, corpo).expect(400);
      expect(res.body.campos).toHaveProperty(campo);
    }
    expect(await lerBanco().chavePix(id)).toBeUndefined();
  });

  it("senha errada: 403 e a chave antiga continua; 5 erros bloqueiam (429)", async () => {
    const { token, id } = await criarConta();
    await salvarPix(token, { tipo: "cpf", chave: CPF, senhaAtual: ANA.senha }).expect(200);
    const res = await salvarPix(token, { tipo: "email", chave: "golpe@exemplo.com", senhaAtual: "errada123" }).expect(403);
    expect(res.body.campos).toHaveProperty("senhaAtual");
    expect(await lerBanco().chavePix(id)).toMatchObject({ tipo: "cpf" });
    for (let i = 0; i < 4; i++) await salvarPix(token, { tipo: "email", chave: "golpe@exemplo.com", senhaAtual: "errada123" }).expect(403);
    await salvarPix(token, { tipo: "email", chave: "golpe@exemplo.com", senhaAtual: ANA.senha }).expect(429);
  });

  it("sem token: 401", async () => {
    await request(app).put("/auth/me/pix").send({ tipo: "cpf", chave: CPF, senhaAtual: ANA.senha }).expect(401);
  });
});

describe("persistência e sessão", () => {
  it("depois de sair e entrar de novo: dados salvos e o token já vem com temChavePix", async () => {
    const { cliente, token } = await criarConta();
    await request(app).patch("/auth/me/vendedora").set(bearer(token)).send({ nomePublico: "Brechó da Ana", cidade: "Recife" }).expect(200);
    await salvarPix(token, { tipo: "cpf", chave: CPF, senhaAtual: ANA.senha }).expect(200);
    await cliente.post("/auth/logout").expect(204);

    const login = await request(app).post("/auth/login").send({ email: ANA.email, senha: ANA.senha }).expect(200);
    expect((await lerToken(`Bearer ${login.body.accessToken}`, jwtSegredo))?.temChavePix).toBe(true);
    const res = await request(app).get("/auth/me/vendedora").set(bearer(login.body.accessToken)).expect(200);
    expect(res.body.vendedora).toMatchObject({
      nomePublico: "Brechó da Ana",
      cidade: "Recife",
      pix: { tipo: "cpf", mascarada: "***.982.247-**" },
    });
  });

  it("editar nome ou e-mail (PATCH /me) mantém temChavePix no token novo", async () => {
    const { token } = await criarConta();
    await salvarPix(token, { tipo: "cpf", chave: CPF, senhaAtual: ANA.senha }).expect(200);
    const res = await request(app).patch("/auth/me").set(bearer(token)).send({ nome: "Ana Souza Lima", email: ANA.email }).expect(200);
    expect((await lerToken(`Bearer ${res.body.accessToken}`, jwtSegredo))?.temChavePix).toBe(true);
  });

  it("excluir a conta apaga a chave Pix junto", async () => {
    const { token, id } = await criarConta();
    await salvarPix(token, { tipo: "cpf", chave: CPF, senhaAtual: ANA.senha }).expect(200);
    await request(app).delete("/auth/me").set(bearer(token)).send({ senha: ANA.senha }).expect(204);
    expect(await lerBanco().chavePix(id)).toBeUndefined();
  });
});

describe("isolamento entre contas", () => {
  it("cada conta vê e altera só o próprio perfil (o id vem do token, nunca da requisição)", async () => {
    const ana = await criarConta(ANA);
    const bea = await criarConta(BEA);
    await salvarPix(ana.token, { tipo: "cpf", chave: CPF, senhaAtual: ANA.senha }).expect(200);
    await request(app).patch("/auth/me/vendedora").set(bearer(ana.token)).send({ nomePublico: "Brechó da Ana", cidade: "Recife" }).expect(200);

    // a Bea tenta mandar o id da Ana no corpo: é ignorado, e só o perfil dela muda
    await request(app).patch("/auth/me/vendedora").set(bearer(bea.token)).send({ id: ana.id, nomePublico: "Invasora", cidade: "Natal" }).expect(200);
    await salvarPix(bea.token, { id: ana.id, usuarioId: ana.id, tipo: "email", chave: "bea@exemplo.com", senhaAtual: BEA.senha }).expect(200);

    const daAna = await request(app).get("/auth/me/vendedora").set(bearer(ana.token)).expect(200);
    expect(daAna.body.vendedora).toMatchObject({ nomePublico: "Brechó da Ana", cidade: "Recife", pix: { tipo: "cpf" } });
    const daBea = await request(app).get("/auth/me/vendedora").set(bearer(bea.token)).expect(200);
    expect(daBea.body.vendedora).toMatchObject({ id: bea.id, nomePublico: "Invasora", pix: { tipo: "email" } });
    expect(JSON.stringify(daBea.body)).not.toContain("982.247");
  });

  it("a cifra de uma conta não abre em outra (proteção contra troca de linhas no banco)", async () => {
    const ana = await criarConta(ANA);
    const bea = await criarConta(BEA);
    await salvarPix(ana.token, { tipo: "cpf", chave: CPF, senhaAtual: ANA.senha }).expect(200);
    const daAna = (await lerBanco().chavePix(ana.id))!;
    await lerBanco().salvarChavePix(bea.id, "cpf", daAna.chave_cifrada);
    await expect(lerChavePixCompletaParaRepasse(lerBanco(), pixCriptoChave, bea.id)).rejects.toThrow();
  });
});

describe("chave Pix ilegível (PIX_CRIPTO_CHAVE trocada ou cifra corrompida)", () => {
  /** Cadastra a chave com a chave de criptografia atual e devolve um app com outra chave. */
  async function comChaveIlegivel() {
    const conta = await criarConta();
    await salvarPix(conta.token, { tipo: "cpf", chave: CPF, senhaAtual: ANA.senha }).expect(200);
    const outra = criarApp(lerBanco(), { ...config, pixCriptoChave: randomBytes(32) });
    return { ...conta, outra };
  }

  it("GET /me/vendedora responde 200 com pixIndisponivel, sem expor cifra nem chave", async () => {
    const { token, id, outra } = await comChaveIlegivel();
    const res = await request(outra).get("/auth/me/vendedora").set(bearer(token)).expect(200);
    expect(res.body.vendedora).toMatchObject({ id, pix: null, pixIndisponivel: true });
    const cifra = (await lerBanco().chavePix(id))!.chave_cifrada;
    for (const proibido of [CPF, "982.247", cifra, cifra.split(".")[3]]) expect(JSON.stringify(res.body)).not.toContain(proibido);
  });

  it("chave ilegível conta como sem chave: token sem temChavePix e perfil público 404", async () => {
    const { id, outra } = await comChaveIlegivel();
    const login = await request(outra).post("/auth/login").send({ email: ANA.email, senha: ANA.senha }).expect(200);
    expect((await lerToken(`Bearer ${login.body.accessToken}`, jwtSegredo))?.temChavePix).toBe(false);
    await request(outra).get(`/auth/vendedoras/${id}`).expect(404);
  });

  it("a vendedora cadastra de novo e tudo volta: chave legível, token liberado e perfil público", async () => {
    const { token, id, outra } = await comChaveIlegivel();
    const res = await request(outra)
      .put("/auth/me/pix")
      .set(bearer(token))
      .send({ tipo: "email", chave: "ana@exemplo.com", senhaAtual: ANA.senha })
      .expect(200);
    expect(res.body.vendedora).toMatchObject({ pix: { tipo: "email", mascarada: "an***@exemplo.com" }, pixIndisponivel: false });
    expect((await lerToken(`Bearer ${res.body.accessToken}`, jwtSegredo))?.temChavePix).toBe(true);
    await request(outra).get(`/auth/vendedoras/${id}`).expect(200);
  });

  it("cifra corrompida no banco também não derruba a página", async () => {
    const { token, id } = await criarConta();
    await lerBanco().salvarChavePix(id, "cpf", "v1.lixo.lixo.lixo");
    const res = await request(app).get("/auth/me/vendedora").set(bearer(token)).expect(200);
    expect(res.body.vendedora).toMatchObject({ pix: null, pixIndisponivel: true });
  });

  it("o repasse da administração (Issue #014) para com erro em vez de seguir sem a chave", async () => {
    const { id } = await comChaveIlegivel();
    await expect(lerChavePixCompletaParaRepasse(lerBanco(), randomBytes(32), id)).rejects.toThrow();
  });
});

describe("GET /auth/vendedoras/:id: perfil público", () => {
  it("mostra só id, nome na vitrine e cidade: nada de e-mail, nome completo, CPF ou chave", async () => {
    const ana = await criarConta(ANA);
    await request(app).patch("/auth/me/vendedora").set(bearer(ana.token)).send({ nomePublico: "", cidade: "Recife" }).expect(200);
    await salvarPix(ana.token, { tipo: "cpf", chave: CPF, senhaAtual: ANA.senha }).expect(200);

    const res = await request(app).get(`/auth/vendedoras/${ana.id}`).expect(200);
    expect(res.body).toEqual({ vendedora: { id: ana.id, nomePublico: "Ana", cidade: "Recife" } });
    const texto = JSON.stringify(res.body);
    for (const proibido of [ANA.email, "Souza", CPF, "982.247", "pix"]) expect(texto).not.toContain(proibido);
  });

  it("404 para quem ainda não é vendedora, conta bloqueada, inexistente ou id inválido", async () => {
    const ana = await criarConta(ANA);
    await request(app).get(`/auth/vendedoras/${ana.id}`).expect(404);
    await salvarPix(ana.token, { tipo: "cpf", chave: CPF, senhaAtual: ANA.senha }).expect(200);
    await lerBanco().definirBloqueio(ana.id, true);
    await request(app).get(`/auth/vendedoras/${ana.id}`).expect(404);
    await request(app).get("/auth/vendedoras/6f1c2c8e-0000-4000-8000-000000000000").expect(404);
    await request(app).get("/auth/vendedoras/nao-e-um-uuid").expect(404);
  });
});
