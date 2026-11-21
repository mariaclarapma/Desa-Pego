import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { criarAppCatalogo } from "./app.js";
import { abrirLoja } from "./loja.js";

const SEMENTE = fileURLToPath(new URL("../../db.seed.json", import.meta.url));
const CHAVE = "chave-de-teste-da-integracao";
const SEGREDO = new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres");
const ORIGEM = "http://localhost:3000";

const loja = abrirLoja(null, SEMENTE);
let relogio: number;
let app: ReturnType<typeof criarAppCatalogo>;

beforeEach(() => {
  loja.restaurar();
  relogio = Date.now();
  app = criarAppCatalogo(
    loja,
    { origens: [ORIGEM], apiKeys: [CHAVE], trustProxy: "loopback", reservaMinutos: 15, freteCentavos: 1990, jwtSegredo: SEGREDO },
    () => relogio,
  );
});

const disponivel = () => loja.listarPecas().find((p) => p.status === "disponivel")!;
const ENDERECO = { cep: "70000-000", logradouro: "Rua A", numero: "10", bairro: "Asa Sul", cidade: "Brasília", uf: "df" };
const COMPRADOR = { nome: "Ana Souza", email: "Ana@Exemplo.com" };

async function reservarECriarPedido() {
  const peca = disponivel();
  await request(app).post(`/pecas/${peca.id}/reservar`).expect(200);
  const res = await request(app).post("/pedidos").send({ comprador: COMPRADOR, endereco: ENDERECO, itens: [peca.id] }).expect(201);
  return { peca, pedido: res.body };
}

describe("vitrine: GET /pecas e GET /pecas/:id", () => {
  it("lista as peças e devolve uma peça pelo id", async () => {
    const lista = await request(app).get("/pecas").expect(200);
    expect(lista.body.length).toBe(loja.listarPecas().length);
    const peca = disponivel();
    expect((await request(app).get(`/pecas/${peca.id}`).expect(200)).body.titulo).toBe(peca.titulo);
  });

  it("404 para peça que não existe e 400 para id malformado", async () => {
    await request(app).get("/pecas/nao-existe").expect(404);
    await request(app).get("/pecas/%3Cscript%3E").expect(400);
  });

  it("uma reserva vencida volta a aparecer como disponível", async () => {
    const peca = disponivel();
    await request(app).post(`/pecas/${peca.id}/reservar`).expect(200);
    relogio += 16 * 60_000;
    expect((await request(app).get(`/pecas/${peca.id}`)).body.status).toBe("disponivel");
  });
});

describe("reserva: POST /pecas/:id/reservar e /liberar", () => {
  it("reserva por 15 minutos e recusa uma segunda reserva", async () => {
    const peca = disponivel();
    const res = await request(app).post(`/pecas/${peca.id}/reservar`).expect(200);
    expect(res.body.status).toBe("reservada");
    expect(new Date(res.body.reservadaAte).getTime()).toBe(relogio + 15 * 60_000);
    await request(app).post(`/pecas/${peca.id}/reservar`).expect(409);
  });

  it("duas reservas ao mesmo tempo: só uma passa", async () => {
    const peca = disponivel();
    const respostas = await Promise.all([1, 2, 3].map(() => request(app).post(`/pecas/${peca.id}/reservar`)));
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409, 409]);
  });

  it("liberar desfaz a reserva, mas não desfaz uma venda", async () => {
    const peca = disponivel();
    await request(app).post(`/pecas/${peca.id}/reservar`).expect(200);
    expect((await request(app).post(`/pecas/${peca.id}/liberar`).expect(200)).body.status).toBe("disponivel");

    const { pedido, peca: vendida } = await reservarECriarPedido();
    await request(app).post(`/integracao/pagamentos/${pedido.id}/confirmar`).set("X-API-Key", CHAVE).expect(200);
    expect((await request(app).post(`/pecas/${vendida.id}/liberar`).expect(200)).body.status).toBe("vendida");
  });
});

describe("pedido: POST /pedidos e GET /pedidos/:id", () => {
  it("calcula preço, frete e total no servidor (ignora valores do navegador)", async () => {
    const peca = disponivel();
    await request(app).post(`/pecas/${peca.id}/reservar`).expect(200);
    const res = await request(app)
      .post("/pedidos")
      .send({ comprador: COMPRADOR, endereco: ENDERECO, itens: [peca.id], totalCentavos: 1, status: "pago" })
      .expect(201);
    expect(res.body).toMatchObject({
      status: "aguardando_pagamento",
      subtotalCentavos: peca.precoCentavos,
      freteCentavos: 1990,
      totalCentavos: peca.precoCentavos + 1990,
      comprador: { email: "ana@exemplo.com" },
      endereco: { uf: "DF" },
    });
    expect(res.body.pixCopiaECola).toContain("br.gov.bcb.pix");
    expect((await request(app).get(`/pedidos/${res.body.id}`).expect(200)).body.id).toBe(res.body.id);
  });

  it("recusa peça sem reserva (409) e dados inválidos (400)", async () => {
    const peca = disponivel();
    await request(app).post("/pedidos").send({ comprador: COMPRADOR, endereco: ENDERECO, itens: [peca.id] }).expect(409);
    const ruim = await request(app)
      .post("/pedidos")
      .send({ comprador: { nome: "", email: "x" }, endereco: { ...ENDERECO, cep: "abc" }, itens: [] })
      .expect(400);
    expect(Object.keys(ruim.body.campos)).toEqual(expect.arrayContaining(["comprador.email", "endereco.cep", "itens"]));
  });

  it("404 para pedido que não existe; JSON malformado é 400", async () => {
    await request(app).get("/pedidos/abc123").expect(404);
    await request(app).post("/pedidos").set("Content-Type", "application/json").send("{oops").expect(400);
  });

  it("não expõe as rotas genéricas do antigo json-server", async () => {
    const peca = disponivel();
    await request(app).delete(`/pecas/${peca.id}`).expect(404);
    await request(app).patch(`/pecas/${peca.id}`).send({ status: "vendida" }).expect(404);
    await request(app).put(`/pecas/${peca.id}`).send({}).expect(404);
    expect(loja.peca(peca.id)!.status).toBe("disponivel");
  });
});

describe("integração (X-API-Key)", () => {
  it("sem chave ou com chave errada: 401", async () => {
    const { pedido } = await reservarECriarPedido();
    await request(app).post(`/integracao/pagamentos/${pedido.id}/confirmar`).expect(401);
    await request(app).post(`/integracao/pagamentos/${pedido.id}/confirmar`).set("X-API-Key", "errada").expect(401);
    await request(app).get("/integracao/pedidos").expect(401);
  });

  it("confirma o pagamento (peças vendidas) de forma idempotente", async () => {
    const { pedido, peca } = await reservarECriarPedido();
    const pago = await request(app).post(`/integracao/pagamentos/${pedido.id}/confirmar`).set("X-API-Key", CHAVE).expect(200);
    expect(pago.body.status).toBe("pago");
    expect(loja.peca(peca.id)!.status).toBe("vendida");
    const outra = await request(app).post(`/integracao/pagamentos/${pedido.id}/confirmar`).set("X-API-Key", CHAVE).expect(200);
    expect(outra.body.pagoEm).toBe(pago.body.pagoEm);
    await request(app).post("/integracao/pagamentos/nao-existe/confirmar").set("X-API-Key", CHAVE).expect(404);
  });

  it("exporta os pedidos, com filtro por status", async () => {
    const { pedido } = await reservarECriarPedido();
    const todos = await request(app).get("/integracao/pedidos").set("X-API-Key", CHAVE).expect(200);
    expect(todos.body.total).toBe(1);
    const pagos = await request(app).get("/integracao/pedidos?status=pago").set("X-API-Key", CHAVE).expect(200);
    expect(pagos.body.total).toBe(0);
    await request(app).get("/integracao/pedidos?status=qualquer").set("X-API-Key", CHAVE).expect(400);
    expect(todos.body.pedidos[0].id).toBe(pedido.id);
  });

  it("sem API_KEYS configurado, a integração fica desligada (503)", async () => {
    const semChave = criarAppCatalogo(loja, { origens: [ORIGEM], apiKeys: [], trustProxy: "loopback", reservaMinutos: 15, freteCentavos: 1990, jwtSegredo: SEGREDO });
    await request(semChave).get("/integracao/pedidos").set("X-API-Key", "qualquer").expect(503);
  });
});

describe("segurança HTTP", () => {
  it("CORS: libera só a origem do frontend e barra as outras", async () => {
    const ok = await request(app).get("/pecas").set("Origin", ORIGEM).expect(200);
    expect(ok.headers["access-control-allow-origin"]).toBe(ORIGEM);
    await request(app).post(`/pecas/${disponivel().id}/reservar`).set("Origin", "https://site-malicioso.com").expect(403);
    const preflight = await request(app).options("/pedidos").set("Origin", ORIGEM).expect(204);
    expect(preflight.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("cabeçalhos do Helmet e sem x-powered-by", async () => {
    const res = await request(app).get("/pecas");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("limita a escrita a 30 requisições por minuto por IP", async () => {
    const peca = disponivel();
    for (let i = 0; i < 30; i++) await request(app).post(`/pecas/${peca.id}/liberar`);
    const bloqueada = await request(app).post(`/pecas/${peca.id}/liberar`).expect(429);
    expect(bloqueada.headers["retry-after"]).toBeDefined();
    relogio += 60_000;
    await request(app).post(`/pecas/${peca.id}/liberar`).expect(200);
  });

  it("rota desconhecida: 404", async () => {
    await request(app).get("/rota-que-nao-existe").expect(404);
  });
});

describe("painel do admin: anúncios (Módulo 05)", () => {
  const como = async (perfil: string) => ({
    Authorization: `Bearer ${await new SignJWT({ nome: "x", perfil }).setProtectedHeader({ alg: "HS256" }).setSubject("u-1").setExpirationTime("15m").sign(SEGREDO)}`,
  });

  it("quem não é administradora recebe 403; sem login, 401", async () => {
    const peca = disponivel();
    await request(app).get("/admin/pecas").set(await como("USUARIO")).expect(403);
    await request(app).post(`/admin/pecas/${peca.id}/ocultar`).set(await como("ADMIN")).expect(403);
    await request(app).get("/admin/pecas").expect(401);
  });

  it("ocultar tira o anúncio da vitrine, da página e da reserva; reexibir devolve", async () => {
    const ludy = await como("ADMIN_MASTER");
    const peca = disponivel();
    await request(app).post(`/admin/pecas/${peca.id}/ocultar`).set(ludy).send({ motivo: "foto imprópria" }).expect(200);
    expect((await request(app).get("/pecas")).body.map((p: { id: string }) => p.id)).not.toContain(peca.id);
    await request(app).get(`/pecas/${peca.id}`).expect(404);
    await request(app).post(`/pecas/${peca.id}/reservar`).expect(404);
    const lista = (await request(app).get("/admin/pecas").set(ludy).expect(200)).body.pecas;
    expect(lista.find((p: { id: string }) => p.id === peca.id)).toMatchObject({ oculta: true, motivoOculta: "foto imprópria", irregular: false });

    await request(app).post(`/admin/pecas/${peca.id}/reexibir`).set(ludy).expect(200);
    await request(app).get(`/pecas/${peca.id}`).expect(200);
  });

  it("anúncio em categoria não permitida (ex.: eletrônicos) é marcado irregular e não pode voltar à vitrine", async () => {
    const ludy = await como("ADMIN_MASTER");
    const peca = disponivel();
    peca.categoria = "eletronicos"; // simula um anúncio irregular vindo do Módulo 02
    const lista = (await request(app).get("/admin/pecas").set(ludy).expect(200)).body.pecas;
    expect(lista.find((p: { id: string }) => p.id === peca.id).irregular).toBe(true);

    const oculta = await request(app).post(`/admin/pecas/${peca.id}/ocultar`).set(ludy).expect(200);
    expect(oculta.body.motivoOculta).toBe("fora das categorias permitidas");
    const recusa = await request(app).post(`/admin/pecas/${peca.id}/reexibir`).set(ludy).expect(422);
    expect(recusa.body.erro).toMatch(/categoria não permitida/);
    await request(app).get(`/pecas/${peca.id}`).expect(404);
  });

  it("anúncio inexistente: 404", async () => {
    await request(app).post("/admin/pecas/nao-existe/ocultar").set(await como("ADMIN_MASTER")).expect(404);
  });
});
