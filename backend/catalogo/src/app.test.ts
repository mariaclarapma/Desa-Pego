import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { criarAppCatalogo } from "./app.js";
import { FalhaGestao, type GestaoPedidos, type NovoPedidoGestao } from "./gestao.js";
import { abrirLoja } from "./loja.js";

const SEMENTE = fileURLToPath(new URL("../../db.seed.json", import.meta.url));
const CHAVE = "chave-de-teste-da-integracao";
const SEGREDO = new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres");
const ORIGEM = "http://localhost:3000";

/** Módulo 05 de mentira: guarda o que o catálogo pediu e pode falhar de propósito. */
class GestaoFalsa implements GestaoPedidos {
  criados: (NovoPedidoGestao & { id: string })[] = [];
  confirmados: string[] = [];
  expirados: string[] = [];
  /** Falha a partir da n-ésima criação (1 = a primeira; 0 = nunca). */
  falharCriacao = 0;
  falharConfirmacao = false;
  async criar(dados: NovoPedidoGestao) {
    if (this.falharCriacao && this.criados.length + 1 >= this.falharCriacao) throw new FalhaGestao(0, "fora do ar");
    const id = `gestao-${this.criados.length + 1}`;
    this.criados.push({ ...dados, id });
    return { id };
  }
  async confirmarPagamento(id: string) {
    if (this.falharConfirmacao) throw new FalhaGestao(503, "fora do ar");
    this.confirmados.push(id);
  }
  async expirar(id: string) {
    this.expirados.push(id);
  }
}

const loja = abrirLoja(null, SEMENTE);
let relogio: number;
let gestao: GestaoFalsa;
let app: ReturnType<typeof criarAppCatalogo>;

beforeEach(() => {
  loja.restaurar();
  relogio = Date.now();
  gestao = new GestaoFalsa();
  app = criarAppCatalogo(
    loja,
    { origens: [ORIGEM], apiKeys: [CHAVE], trustProxy: "loopback", reservaMinutos: 15, freteCentavos: 1990, jwtSegredo: SEGREDO, gestao },
    () => relogio,
  );
});

/** Cabeçalho de login de uma conta (o token que o serviço de contas emite). */
const conta = async (sub: string, perfil = "USUARIO") => ({
  Authorization: `Bearer ${await new SignJWT({ nome: sub, perfil }).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setExpirationTime("15m").sign(SEGREDO)}`,
});
const ANA = "conta-ana";

const disponivel = () => loja.listarPecas().find((p) => p.status === "disponivel")!;
const ENDERECO = { cep: "70000-000", logradouro: "Rua A", numero: "10", bairro: "Asa Sul", cidade: "Brasília", uf: "df" };
const COMPRADOR = { nome: "Ana Souza", email: "Ana@Exemplo.com" };

async function reservarECriarPedido() {
  const ana = await conta(ANA);
  const peca = disponivel();
  await request(app).post(`/pecas/${peca.id}/reservar`).set(ana).expect(200);
  const res = await request(app).post("/pedidos").set(ana).send({ comprador: COMPRADOR, endereco: ENDERECO, itens: [peca.id] }).expect(201);
  return { peca, pedido: res.body };
}

describe("vitrine: GET /pecas e GET /pecas/:id", () => {
  it("lista as peças e devolve uma peça pelo id", async () => {
    const lista = await request(app).get("/pecas").expect(200);
    expect(lista.body.total).toBe(loja.listarPecas().length);
    const peca = disponivel();
    expect((await request(app).get(`/pecas/${peca.id}`).expect(200)).body.titulo).toBe(peca.titulo);
  });

  it("404 para peça que não existe e 400 para id malformado", async () => {
    await request(app).get("/pecas/nao-existe").expect(404);
    await request(app).get("/pecas/%3Cscript%3E").expect(400);
  });

  it("uma reserva vencida volta a aparecer como disponível", async () => {
    const peca = disponivel();
    await request(app).post(`/pecas/${peca.id}/reservar`).set(await conta(ANA)).expect(200);
    relogio += 16 * 60_000;
    expect((await request(app).get(`/pecas/${peca.id}`)).body.status).toBe("disponivel");
  });
});

describe("galeria de fotos no GET /pecas/:id (Req. 008)", () => {
  it("devolve a galeria na ordem, com url e texto alternativo de cada foto", async () => {
    const { body } = await request(app).get("/pecas/demo-jaqueta-couro").expect(200);
    expect(body.fotos).toHaveLength(3);
    expect(body.fotos[0]).toEqual({ url: body.fotoUrl, alt: body.fotoAlt });
    for (const foto of body.fotos) expect(foto.alt).not.toBe("");
  });

  it("peça sem galeria devolve a foto principal como única foto", async () => {
    const peca = loja.peca("demo-scarpin-floral")!;
    expect(peca.fotos).toBeUndefined();
    const { body } = await request(app).get(`/pecas/${peca.id}`).expect(200);
    expect(body.fotos).toEqual([{ url: peca.fotoUrl, alt: peca.fotoAlt }]);
  });

  it("foto de anúncio: não expõe a chave do armazenamento e ganha um texto alternativo", async () => {
    await loja.alterarEmFila((d) => {
      const p = d.pecas.find((x) => x.id === "demo-scarpin-floral")!;
      p.fotos = [
        { chave: "a1b2c3d4.jpg", url: "/fotos/a1b2c3d4.jpg" },
        { chave: "e5f6a7b8.jpg", url: "/fotos/e5f6a7b8.jpg" },
      ];
    });
    const peca = loja.peca("demo-scarpin-floral")!;
    const { body } = await request(app).get(`/pecas/${peca.id}`).expect(200);
    expect(body.fotos).toEqual([
      { url: "/fotos/a1b2c3d4.jpg", alt: peca.fotoAlt },
      { url: "/fotos/e5f6a7b8.jpg", alt: `foto 2 de 2: ${peca.titulo}` },
    ]);
    // toEqual garante que cada foto só tem url e alt; a vitrine usa a mesma forma pública
    const vitrine = await request(app).get("/pecas").query({ porPagina: 48 }).expect(200);
    const naVitrine = vitrine.body.itens.find((p: { id: string }) => p.id === peca.id);
    expect(naVitrine.fotos.every((f: object) => !("chave" in f))).toBe(true);
  });
});

describe("vitrine: busca, filtros, ordenação e paginação no GET /pecas (Req. 007)", () => {
  const ids = (res: request.Response) => res.body.itens.map((p: { id: string }) => p.id);
  const vitrine = (query = "") => request(app).get(`/pecas${query}`).expect(200);

  it("sem filtros: devolve { itens, total, pagina, porPagina }, mais recentes primeiro", async () => {
    const res = await vitrine();
    expect(res.body).toMatchObject({ total: 11, pagina: 1, porPagina: 12 });
    expect(res.body.itens).toHaveLength(11);
    expect(ids(res)[0]).toBe("demo-jaqueta-couro"); // criada em 18/11, a mais nova da semente
    expect(ids(res).at(-1)).toBe("demo-oculos-redondo"); // criada em 08/11, a mais antiga
  });

  it("lista só peças ativas: tira vendidas e ocultas; reservada aparece com o status de reservada", async () => {
    loja.peca("demo-jaqueta-couro")!.status = "vendida";
    loja.peca("demo-bolsa-cereja")!.oculta = true;
    Object.assign(loja.peca("demo-scarpin-floral")!, { status: "reservada", reservadaAte: new Date(relogio + 60_000).toISOString() });

    const res = await vitrine();
    expect(res.body.total).toBe(9);
    expect(ids(res)).not.toContain("demo-jaqueta-couro");
    expect(ids(res)).not.toContain("demo-bolsa-cereja");
    expect(res.body.itens.find((p: { id: string }) => p.id === "demo-scarpin-floral").status).toBe("reservada");
    // campos internos da administração não vazam para o público
    expect(res.body.itens[0]).not.toHaveProperty("oculta");
    expect(res.body.itens[0]).not.toHaveProperty("motivoOculta");
  });

  it("busca por título, marca e descrição, sem diferenciar maiúsculas e acentos", async () => {
    expect(ids(await vitrine("?busca=OCULOS"))).toEqual(["demo-oculos-redondo"]); // título "Óculos..."
    expect(ids(await vitrine(`?busca=${encodeURIComponent("feito a mao")}`))).toEqual(["demo-bolsa-palha", "demo-poncho-trico"]); // marca "feito à mão"
    loja.peca("demo-tenis-pastel")!.descricao = "solado com detalhe de girassóis";
    expect(ids(await vitrine("?busca=GIRASSOIS"))).toEqual(["demo-tenis-pastel"]);
    expect((await vitrine("?busca=nao-existe-nada-assim")).body).toMatchObject({ itens: [], total: 0 });
  });

  it("combina filtros (categoria, tamanho, condição, faixa de preço em centavos) com a ordenação", async () => {
    expect(ids(await vitrine("?categoria=bolsas&precoMax=9500&ordem=menor-preco"))).toEqual(["demo-bolsa-palha", "demo-bolsa-rosa"]);
    expect(ids(await vitrine(`?condicao=nova_com_etiqueta&tamanho=${encodeURIComponent("único")}`))).toEqual(["demo-bolsa-cereja", "demo-oculos-redondo"]);
    expect(ids(await vitrine("?precoMin=13000&ordem=maior-preco"))).toEqual(["demo-jaqueta-couro", "demo-bolsa-cereja", "demo-tenis-pastel"]);
    expect(ids(await vitrine("?precoMin=9990&precoMax=9990"))).toEqual(["demo-bomber-caramelo"]); // os limites entram na faixa
  });

  it("ordena por menor e por maior preço", async () => {
    const menor = ids(await vitrine("?ordem=menor-preco"));
    const maior = ids(await vitrine("?ordem=maior-preco"));
    expect(menor[0]).toBe("demo-poncho-trico"); // R$ 59,90
    expect(maior[0]).toBe("demo-jaqueta-couro"); // R$ 189,90
    expect(maior).toEqual([...menor].reverse());
  });

  it("pagina o resultado; o total conta todas as peças filtradas, não só as da página", async () => {
    const p1 = await vitrine("?porPagina=4");
    const p3 = await vitrine("?porPagina=4&pagina=3");
    expect(p1.body).toMatchObject({ total: 11, pagina: 1, porPagina: 4 });
    expect(p1.body.itens).toHaveLength(4);
    expect(p3.body.itens).toHaveLength(3); // 4 + 4 + 3
    expect(ids(p3).filter((id: string) => ids(p1).includes(id))).toEqual([]); // páginas não se repetem
    // página além do fim: lista vazia, mas o total continua certo
    expect((await vitrine("?porPagina=4&pagina=10")).body).toMatchObject({ itens: [], total: 11, pagina: 10 });
  });

  it("campos vazios (o formulário GET manda ?busca=&categoria=) contam como sem filtro", async () => {
    const res = await vitrine("?busca=&categoria=&tamanho=&condicao=&precoMin=&precoMax=&ordem=&pagina=&porPagina=");
    expect(res.body).toMatchObject({ total: 11, pagina: 1, porPagina: 12 });
  });

  it("parâmetros inválidos: 400 com o campo que está errado", async () => {
    const invalidos = [
      "categoria=eletronicos",
      "condicao=usada",
      "ordem=aleatoria",
      "pagina=0",
      "pagina=abc",
      "porPagina=1000",
      "precoMin=-1",
      "precoMax=10.5",
      `busca=${"a".repeat(101)}`,
      "categoria=bolsas&categoria=feminino", // parâmetro repetido vira lista: recusado
    ];
    for (const q of invalidos) await request(app).get(`/pecas?${q}`).expect(400);

    const res = await request(app).get("/pecas?precoMin=10000&precoMax=5000").expect(400);
    expect(res.body.campos).toHaveProperty("precoMin");
    expect((await request(app).get("/pecas?ordem=aleatoria")).body.campos).toHaveProperty("ordem");
  });
});

describe("reserva: POST /pecas/:id/reservar e /liberar", () => {
  it("sem login: 401 (a reserva fica no nome de quem reservou)", async () => {
    const peca = disponivel();
    await request(app).post(`/pecas/${peca.id}/reservar`).expect(401);
    await request(app).post(`/pecas/${peca.id}/liberar`).expect(401);
    expect(loja.peca(peca.id)!.status).toBe("disponivel");
  });

  it("reserva por 15 minutos, recusa uma segunda reserva e não mostra quem reservou", async () => {
    const peca = disponivel();
    const res = await request(app).post(`/pecas/${peca.id}/reservar`).set(await conta(ANA)).expect(200);
    expect(res.body.status).toBe("reservada");
    expect(res.body.reservadaPor).toBeUndefined();
    expect(new Date(res.body.reservadaAte).getTime()).toBe(relogio + 15 * 60_000);
    await request(app).post(`/pecas/${peca.id}/reservar`).set(await conta("conta-bia")).expect(409);
    expect((await request(app).get(`/pecas/${peca.id}`)).body.reservadaPor).toBeUndefined();
  });

  it("duas reservas ao mesmo tempo: só uma passa", async () => {
    const peca = disponivel();
    const ana = await conta(ANA);
    const respostas = await Promise.all([1, 2, 3].map(() => request(app).post(`/pecas/${peca.id}/reservar`).set(ana)));
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409, 409]);
  });

  it("a vendedora não coloca a própria peça na sacola (403)", async () => {
    const peca = disponivel();
    await request(app).post(`/pecas/${peca.id}/reservar`).set(await conta(peca.vendedoraId!)).expect(403);
  });

  it("só quem reservou libera; liberar não desfaz uma venda", async () => {
    const peca = disponivel();
    const ana = await conta(ANA);
    await request(app).post(`/pecas/${peca.id}/reservar`).set(ana).expect(200);
    await request(app).post(`/pecas/${peca.id}/liberar`).set(await conta("conta-bia")).expect(403);
    expect((await request(app).post(`/pecas/${peca.id}/liberar`).set(ana).expect(200)).body.status).toBe("disponivel");

    const { pedido, peca: vendida } = await reservarECriarPedido();
    await request(app).post(`/integracao/pagamentos/${pedido.id}/confirmar`).set("X-API-Key", CHAVE).expect(200);
    expect((await request(app).post(`/pecas/${vendida.id}/liberar`).set(ana).expect(200)).body.status).toBe("vendida");
  });

  it("peça num pedido esperando o Pix não pode ser liberada (senão seria vendida duas vezes)", async () => {
    const { peca } = await reservarECriarPedido();
    await request(app).post(`/pecas/${peca.id}/liberar`).set(await conta(ANA)).expect(409);
    expect(loja.peca(peca.id)!.status).toBe("reservada");
  });

  it("a reserva vencida de outra pessoa não impede uma nova reserva", async () => {
    const peca = disponivel();
    await request(app).post(`/pecas/${peca.id}/reservar`).set(await conta("conta-bia")).expect(200);
    relogio += 16 * 60_000;
    await request(app).post(`/pecas/${peca.id}/reservar`).set(await conta(ANA)).expect(200);
  });
});

describe("pedido: POST /pedidos e GET /pedidos/:id", () => {
  it("sem login: 401", async () => {
    await request(app).post("/pedidos").send({ comprador: COMPRADOR, endereco: ENDERECO, itens: [disponivel().id] }).expect(401);
    await request(app).get("/pedidos/abc123").expect(401);
  });

  it("calcula preço, frete e total no servidor (ignora valores do navegador)", async () => {
    const ana = await conta(ANA);
    const peca = disponivel();
    await request(app).post(`/pecas/${peca.id}/reservar`).set(ana).expect(200);
    const res = await request(app)
      .post("/pedidos")
      .set(ana)
      .send({ comprador: COMPRADOR, endereco: ENDERECO, itens: [peca.id], totalCentavos: 1, status: "pago" })
      .expect(201);
    expect(res.body).toMatchObject({
      status: "aguardando_pagamento",
      compradoraId: ANA,
      subtotalCentavos: peca.precoCentavos,
      freteCentavos: 1990,
      totalCentavos: peca.precoCentavos + 1990,
      comprador: { email: "ana@exemplo.com" },
      endereco: { uf: "DF" },
    });
    expect(res.body.pixCopiaECola).toContain("br.gov.bcb.pix");
    expect((await request(app).get(`/pedidos/${res.body.id}`).set(ana).expect(200)).body.id).toBe(res.body.id);
  });

  it("só a compradora vê o pedido: para outra conta ele não existe (404)", async () => {
    const { pedido } = await reservarECriarPedido();
    await request(app).get(`/pedidos/${pedido.id}`).set(await conta("conta-bia")).expect(404);
  });

  it("recusa peça sem reserva, reservada por outra conta ou já num pedido (409) e dados inválidos (400)", async () => {
    const ana = await conta(ANA);
    const [livre, daBia] = loja.listarPecas().filter((p) => p.status === "disponivel");
    const pedir = (itens: string[]) => request(app).post("/pedidos").set(ana).send({ comprador: COMPRADOR, endereco: ENDERECO, itens });
    await pedir([livre.id]).expect(409);
    await request(app).post(`/pecas/${daBia.id}/reservar`).set(await conta("conta-bia")).expect(200);
    await pedir([daBia.id]).expect(409);

    const { peca: jaNoPedido } = await reservarECriarPedido();
    await pedir([jaNoPedido.id]).expect(409);

    const ruim = await request(app)
      .post("/pedidos")
      .set(ana)
      .send({ comprador: { nome: "", email: "x" }, endereco: { ...ENDERECO, cep: "abc" }, itens: [] })
      .expect(400);
    expect(Object.keys(ruim.body.campos)).toEqual(expect.arrayContaining(["comprador.email", "endereco.cep", "itens"]));
    expect(gestao.criados).toHaveLength(1);
  });

  it("peça sem vendedora cadastrada não pode ser vendida (409)", async () => {
    const ana = await conta(ANA);
    const peca = disponivel();
    await request(app).post(`/pecas/${peca.id}/reservar`).set(ana).expect(200);
    delete loja.peca(peca.id)!.vendedoraId;
    const res = await request(app).post("/pedidos").set(ana).send({ comprador: COMPRADOR, endereco: ENDERECO, itens: [peca.id] }).expect(409);
    expect(res.body.erro).toContain("vendedora");
    expect(gestao.criados).toHaveLength(0);
  });

  it("404 para pedido que não existe; JSON malformado é 400", async () => {
    const ana = await conta(ANA);
    await request(app).get("/pedidos/abc123").set(ana).expect(404);
    await request(app).post("/pedidos").set(ana).set("Content-Type", "application/json").send("{oops").expect(400);
  });

  it("não expõe as rotas genéricas do antigo json-server", async () => {
    const peca = disponivel();
    await request(app).delete(`/pecas/${peca.id}`).expect(404);
    await request(app).patch(`/pecas/${peca.id}`).send({ status: "vendida" }).expect(404);
    await request(app).put(`/pecas/${peca.id}`).send({}).expect(404);
    expect(loja.peca(peca.id)!.status).toBe("disponivel");
  });
});

describe("CompraFacade: a compra chega ao Módulo 05 (issue #31)", () => {
  /** Duas peças de vendedoras diferentes, reservadas pela Ana. */
  async function sacolaComDuasVendedoras() {
    const ana = await conta(ANA);
    const [a, b] = loja.listarPecas().filter((p) => p.status === "disponivel");
    expect(a.vendedoraId).not.toBe(b.vendedoraId);
    for (const p of [a, b]) await request(app).post(`/pecas/${p.id}/reservar`).set(ana).expect(200);
    const pedir = () => request(app).post("/pedidos").set(ana).send({ comprador: COMPRADOR, endereco: ENDERECO, itens: [a.id, b.id] });
    return { a, b, pedir };
  }

  it("cria um pedido por vendedora no Módulo 05, cada um com o seu frete; o Pix cobra o total", async () => {
    const { a, b, pedir } = await sacolaComDuasVendedoras();
    const pedido = (await pedir().expect(201)).body;

    expect(gestao.criados).toHaveLength(2);
    expect(gestao.criados[0]).toMatchObject({
      compradoraId: ANA,
      vendedoraId: a.vendedoraId,
      itens: [{ id: a.id, titulo: a.titulo, precoCentavos: a.precoCentavos, categoria: a.categoria }],
      freteCentavos: 1990,
      endereco: { cep: "70000-000", uf: "DF" },
    });
    expect(gestao.criados[1]).toMatchObject({ vendedoraId: b.vendedoraId, itens: [{ id: b.id }] });
    expect(pedido).toMatchObject({
      freteCentavos: 2 * 1990,
      totalCentavos: a.precoCentavos + b.precoCentavos + 2 * 1990,
      pedidosGestao: [
        { vendedoraId: a.vendedoraId, pedidoId: "gestao-1" },
        { vendedoraId: b.vendedoraId, pedidoId: "gestao-2" },
      ],
    });
  });

  it("se o Módulo 05 falhar no meio, cancela o que já tinha entrado e não cria o pedido (502)", async () => {
    gestao.falharCriacao = 2;
    const { a, pedir } = await sacolaComDuasVendedoras();
    expect((await pedir().expect(502)).body.erro).toContain("tente de novo");
    expect(gestao.expirados).toEqual(["gestao-1"]);
    expect(loja.listarPedidos()).toHaveLength(0);
    // a reserva continua: dá para tentar de novo
    expect(loja.peca(a.id)!.status).toBe("reservada");
    gestao.falharCriacao = 0;
    await pedir().expect(201);
  });

  it("o Pix pago confirma todos os pedidos no Módulo 05, uma vez só", async () => {
    const { pedir } = await sacolaComDuasVendedoras();
    const pedido = (await pedir().expect(201)).body;
    for (let i = 0; i < 2; i++) await request(app).post(`/integracao/pagamentos/${pedido.id}/confirmar`).set("X-API-Key", CHAVE).expect(200);
    expect(gestao.confirmados).toEqual(["gestao-1", "gestao-2"]);
  });

  it("se o Módulo 05 não confirmar, o pedido continua aguardando (502) e o webhook pode repetir", async () => {
    const { pedido, peca } = await reservarECriarPedido();
    gestao.falharConfirmacao = true;
    await request(app).post(`/integracao/pagamentos/${pedido.id}/confirmar`).set("X-API-Key", CHAVE).expect(502);
    expect(loja.pedido(pedido.id)!.status).toBe("aguardando_pagamento");
    expect(loja.peca(peca.id)!.status).toBe("reservada");

    gestao.falharConfirmacao = false;
    expect((await request(app).post(`/integracao/pagamentos/${pedido.id}/confirmar`).set("X-API-Key", CHAVE).expect(200)).body.status).toBe("pago");
    expect(gestao.confirmados).toEqual(["gestao-1"]);
  });

  it("Pix vencido: cancela aqui e no Módulo 05, devolve a peça e recusa o pagamento atrasado (409)", async () => {
    const { pedido, peca } = await reservarECriarPedido();
    relogio += 16 * 60_000;
    expect(await app.compras.expirarVencidos()).toBe(1);
    expect(loja.pedido(pedido.id)!.status).toBe("cancelado");
    expect(gestao.expirados).toEqual(["gestao-1"]);
    expect(loja.peca(peca.id)).toMatchObject({ status: "disponivel", reservadaPor: null });
    expect(await app.compras.expirarVencidos()).toBe(0);

    await request(app).post(`/integracao/pagamentos/${pedido.id}/confirmar`).set("X-API-Key", CHAVE).expect(409);
    expect(gestao.confirmados).toEqual([]);
  });

  it("pagamento que chega depois do prazo, antes da varredura: cancela e recusa (409)", async () => {
    const { pedido } = await reservarECriarPedido();
    relogio += 16 * 60_000;
    await request(app).post(`/integracao/pagamentos/${pedido.id}/confirmar`).set("X-API-Key", CHAVE).expect(409);
    expect(loja.pedido(pedido.id)!.status).toBe("cancelado");
    expect(gestao.expirados).toEqual(["gestao-1"]);
  });

  it("sem a integração configurada, o checkout fica desligado (503)", async () => {
    const semGestao = criarAppCatalogo(loja, { origens: [ORIGEM], apiKeys: [CHAVE], trustProxy: "loopback", reservaMinutos: 15, freteCentavos: 1990, jwtSegredo: SEGREDO });
    const ana = await conta(ANA);
    const peca = disponivel();
    await request(semGestao).post(`/pecas/${peca.id}/reservar`).set(ana).expect(200);
    await request(semGestao).post("/pedidos").set(ana).send({ comprador: COMPRADOR, endereco: ENDERECO, itens: [peca.id] }).expect(503);
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
    const ana = await conta(ANA);
    for (let i = 0; i < 30; i++) await request(app).post(`/pecas/${peca.id}/liberar`).set(ana);
    const bloqueada = await request(app).post(`/pecas/${peca.id}/liberar`).set(ana).expect(429);
    expect(bloqueada.headers["retry-after"]).toBeDefined();
    relogio += 60_000;
    await request(app).post(`/pecas/${peca.id}/liberar`).set(ana).expect(200);
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
    const lucy = await como("ADMIN_MASTER");
    const peca = disponivel();
    await request(app).post(`/admin/pecas/${peca.id}/ocultar`).set(lucy).send({ motivo: "foto imprópria" }).expect(200);
    expect((await request(app).get("/pecas")).body.itens.map((p: { id: string }) => p.id)).not.toContain(peca.id);
    await request(app).get(`/pecas/${peca.id}`).expect(404);
    await request(app).post(`/pecas/${peca.id}/reservar`).set(await conta(ANA)).expect(404);
    const lista = (await request(app).get("/admin/pecas").set(lucy).expect(200)).body.pecas;
    expect(lista.find((p: { id: string }) => p.id === peca.id)).toMatchObject({ oculta: true, motivoOculta: "foto imprópria", irregular: false });

    await request(app).post(`/admin/pecas/${peca.id}/reexibir`).set(lucy).expect(200);
    await request(app).get(`/pecas/${peca.id}`).expect(200);
  });

  it("anúncio em categoria não permitida (ex.: eletrônicos) é marcado irregular e não pode voltar à vitrine", async () => {
    const lucy = await como("ADMIN_MASTER");
    const peca = disponivel();
    peca.categoria = "eletronicos"; // simula um anúncio irregular vindo do Módulo 02
    const lista = (await request(app).get("/admin/pecas").set(lucy).expect(200)).body.pecas;
    expect(lista.find((p: { id: string }) => p.id === peca.id).irregular).toBe(true);

    const oculta = await request(app).post(`/admin/pecas/${peca.id}/ocultar`).set(lucy).expect(200);
    expect(oculta.body.motivoOculta).toBe("fora das categorias permitidas");
    const recusa = await request(app).post(`/admin/pecas/${peca.id}/reexibir`).set(lucy).expect(422);
    expect(recusa.body.erro).toMatch(/categoria não permitida/);
    await request(app).get(`/pecas/${peca.id}`).expect(404);
  });

  it("anúncio inexistente: 404", async () => {
    await request(app).post("/admin/pecas/nao-existe/ocultar").set(await como("ADMIN_MASTER")).expect(404);
  });
});

describe("painel do admin: frete fixo (Req. 014)", () => {
  const como = async (perfil: string) => ({
    Authorization: `Bearer ${await new SignJWT({ nome: "x", perfil }).setProtectedHeader({ alg: "HS256" }).setSubject("u-1").setExpirationTime("15m").sign(SEGREDO)}`,
  });

  it("sem definição, vale o frete padrão do servidor; a rota pública mostra o atual", async () => {
    expect((await request(app).get("/config").expect(200)).body).toEqual({ freteCentavos: 1990, reservaMinutos: 15 });
    expect((await request(app).get("/admin/frete").set(await como("ADMIN_MASTER")).expect(200)).body).toEqual({ freteCentavos: 1990 });
  });

  it("o admin muda o frete: vale para pedidos novos, os antigos guardam o deles", async () => {
    const { pedido: antigo } = await reservarECriarPedido();
    await request(app).put("/admin/frete").set(await como("ADMIN_MASTER")).send({ freteCentavos: 2500 }).expect(200);
    expect((await request(app).get("/config").expect(200)).body.freteCentavos).toBe(2500);

    const { peca, pedido: novo } = await reservarECriarPedido();
    expect(novo).toMatchObject({ freteCentavos: 2500, totalCentavos: peca.precoCentavos + 2500 });
    expect((await request(app).get(`/pedidos/${antigo.id}`).set(await conta(ANA)).expect(200)).body.freteCentavos).toBe(1990);
  });

  it("frete inválido é recusado (negativo, fração, acima de R$ 200 ou texto)", async () => {
    for (const valor of [-1, 10.5, 20_001, "1990"]) {
      await request(app).put("/admin/frete").set(await como("ADMIN_MASTER")).send({ freteCentavos: valor }).expect(400);
    }
    expect((await request(app).get("/config").expect(200)).body.freteCentavos).toBe(1990);
  });

  it("quem não é administradora não muda o frete (403); sem login, 401", async () => {
    for (const perfil of ["USUARIO", "ADMIN"]) {
      await request(app).put("/admin/frete").set(await como(perfil)).send({ freteCentavos: 0 }).expect(403);
      await request(app).get("/admin/frete").set(await como(perfil)).expect(403);
    }
    await request(app).put("/admin/frete").send({ freteCentavos: 0 }).expect(401);
    expect((await request(app).get("/config").expect(200)).body.freteCentavos).toBe(1990);
  });
});
