import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarAppPedidos } from "../../pedidos/src/app.js";
import { abrirBancoPedidos, type BancoPedidos } from "../../pedidos/src/banco.js";
import { criarAppCatalogo } from "./app.js";
import { gestaoPorHttp } from "./gestao.js";
import { abrirLoja } from "./loja.js";

/**
 * Issue #31, de ponta a ponta: o catálogo e o serviço de pedidos (Módulo 05) rodando de verdade,
 * conversando por HTTP com a API key, como no Render. A compra feita pelo checkout precisa
 * aparecer em "minhas compras", em "minhas vendas" e na carteira da vendedora.
 */
const SEGREDO = new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres");
const CHAVE = "chave-interna-de-teste";
const SEMENTE = fileURLToPath(new URL("../../db.seed.json", import.meta.url));
const ENDERECO = { cep: "70000-000", logradouro: "Rua A", numero: "10", bairro: "Asa Sul", cidade: "Brasília", uf: "DF" };
const COMPRADORA = "conta-ana";

let banco: BancoPedidos;
let servidorPedidos: Server;
let urlPedidos: string;
const loja = abrirLoja(null, SEMENTE);
let relogio: number;
let catalogo: ReturnType<typeof criarAppCatalogo>;
const pedidos = () => servidorPedidos;

const como = async (id: string) => ({
  Authorization: `Bearer ${await new SignJWT({ nome: id, perfil: "USUARIO" }).setProtectedHeader({ alg: "HS256" }).setSubject(id).setExpirationTime("15m").sign(SEGREDO)}`,
});

beforeAll(async () => {
  banco = await abrirBancoPedidos(undefined, "pedidos");
  const app = criarAppPedidos(banco, { jwtSegredo: SEGREDO, apiKeys: [CHAVE], origens: [], trustProxy: "loopback" });
  servidorPedidos = await new Promise<Server>((pronto) => {
    const s = app.listen(0, "127.0.0.1", () => pronto(s));
  });
  urlPedidos = `http://127.0.0.1:${(servidorPedidos.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise((fim) => servidorPedidos?.close(fim));
  await banco?.fechar();
});
beforeEach(async () => {
  await banco.limpar();
  loja.restaurar();
  relogio = Date.now();
  catalogo = criarAppCatalogo(
    loja,
    {
      origens: [],
      apiKeys: [CHAVE],
      trustProxy: "loopback",
      reservaMinutos: 15,
      freteCentavos: 1990,
      jwtSegredo: SEGREDO,
      gestao: gestaoPorHttp({ baseUrl: urlPedidos, apiKey: CHAVE }),
    },
    () => relogio,
  );
});

/** Reserva as peças e fecha o pedido pelo checkout, como a compradora logada no site. */
async function comprar(pecaIds: string[]) {
  const ana = await como(COMPRADORA);
  for (const id of pecaIds) await request(catalogo).post(`/pecas/${id}/reservar`).set(ana).expect(200);
  const res = await request(catalogo)
    .post("/pedidos")
    .set(ana)
    .send({ comprador: { nome: "Ana Souza", email: "ana@exemplo.com" }, endereco: ENDERECO, itens: pecaIds })
    .expect(201);
  return res.body as { id: string; pedidosGestao: { vendedoraId: string; pedidoId: string }[] };
}
const pagar = (id: string) => request(catalogo).post(`/integracao/pagamentos/${id}/confirmar`).set("X-API-Key", CHAVE);

describe("checkout → Módulo 05 (issue #31)", () => {
  it("a compra paga aparece em compras, em vendas e na carteira da vendedora, uma vez só", async () => {
    const peca = loja.peca("demo-jaqueta-couro")!;
    const vendedora = peca.vendedoraId!;
    const pedido = await comprar([peca.id]);

    // antes do Pix: a compradora já vê o pedido aguardando pagamento
    const compras = (await request(pedidos()).get("/pedidos/compras").set(await como(COMPRADORA)).expect(200)).body;
    expect(compras.pedidos).toEqual(expect.arrayContaining([expect.objectContaining({ status: "AGUARDANDO_PAGAMENTO" })]));

    await pagar(pedido.id).expect(200);
    await pagar(pedido.id).expect(200); // webhook repetido

    const vendas = (await request(pedidos()).get("/pedidos/vendas").set(await como(vendedora)).expect(200)).body;
    const lista = vendas.pedidos as { id: string; status: string; itens: { id: string }[]; endereco?: unknown }[];
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: pedido.pedidosGestao[0].pedidoId, status: "PAGO", itens: [{ id: peca.id }] });
    expect(lista[0].endereco).toMatchObject({ cep: "70000-000" });

    const carteira = (await request(pedidos()).get("/carteira").set(await como(vendedora)).expect(200)).body;
    // peça + frete − comissão de 10% (taxa do Pix padrão: 0), lançado uma vez só
    expect(carteira.pendenteCentavos).toBe(peca.precoCentavos + 1990 - Math.round(peca.precoCentavos * 0.1));
    expect(loja.peca(peca.id)!.status).toBe("vendida");
  });

  it("sacola com duas vendedoras: cada uma vê só a sua venda, com o seu frete", async () => {
    const [a, b] = ["demo-jaqueta-couro", "demo-bolsa-cereja"].map((id) => loja.peca(id)!);
    const pedido = await comprar([a.id, b.id]);
    await pagar(pedido.id).expect(200);

    for (const peca of [a, b]) {
      const vendas = (await request(pedidos()).get("/pedidos/vendas").set(await como(peca.vendedoraId!)).expect(200)).body;
      const lista = vendas.pedidos as { itens: { id: string }[]; freteCentavos: number }[];
      expect(lista).toHaveLength(1);
      expect(lista[0]).toMatchObject({ itens: [{ id: peca.id }], freteCentavos: 1990 });
    }
  });

  it("Pix vencido: o pedido é cancelado também no Módulo 05", async () => {
    const pedido = await comprar(["demo-bolsa-palha"]);
    relogio += 16 * 60_000;
    expect(await catalogo.compras.expirarVencidos()).toBe(1);
    const compras = (await request(pedidos()).get("/pedidos/compras").set(await como(COMPRADORA)).expect(200)).body;
    const lista = compras.pedidos as { id: string; status: string }[];
    expect(lista.find((p) => p.id === pedido.pedidosGestao[0].pedidoId)?.status).toBe("CANCELADO");
  });

  it("serviço de pedidos fora do ar: o checkout responde 502 e não cria nada", async () => {
    const foraDoAr = criarAppCatalogo(loja, {
      origens: [],
      apiKeys: [CHAVE],
      trustProxy: "loopback",
      reservaMinutos: 15,
      freteCentavos: 1990,
      jwtSegredo: SEGREDO,
      gestao: gestaoPorHttp({ baseUrl: "http://127.0.0.1:9", apiKey: CHAVE, timeoutMs: 1000 }),
    });
    const ana = await como(COMPRADORA);
    await request(foraDoAr).post("/pecas/demo-tenis-pastel/reservar").set(ana).expect(200);
    await request(foraDoAr)
      .post("/pedidos")
      .set(ana)
      .send({ comprador: { nome: "Ana", email: "ana@exemplo.com" }, endereco: ENDERECO, itens: ["demo-tenis-pastel"] })
      .expect(502);
    expect(loja.listarPedidos()).toHaveLength(0);
  });
});
