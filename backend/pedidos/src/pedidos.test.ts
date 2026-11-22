import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarAppPedidos } from "./app.js";
import { abrirBancoPedidos, type BancoPedidos } from "./banco.js";
import { conferirTransicao, STATUS } from "./estados.js";

/**
 * Req. 015: testes de pedidos, carteira e admin. O checkout (Módulo 04) e as contas (Módulo 01)
 * são simulados, como pede a regra do grupo: o pedido entra pela rota interna com API key e
 * as usuárias são tokens JWT assinados com o segredo de teste.
 */
const SEGREDO = new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres");
const CHAVE = "chave-interna-de-teste";

let banco: BancoPedidos;
let app: ReturnType<typeof criarAppPedidos>;
const URL_TESTE = process.env.TEST_DATABASE_URL || undefined;
const SCHEMA = URL_TESTE ? `teste_${randomBytes(6).toString("hex")}` : "pedidos";

beforeAll(async () => {
  banco = await abrirBancoPedidos(URL_TESTE, SCHEMA);
});
beforeEach(async () => {
  await banco.limpar();
  app = criarAppPedidos(banco, { jwtSegredo: SEGREDO, apiKeys: [CHAVE], origens: ["http://localhost:3000"], trustProxy: "loopback" });
});
afterAll(async () => {
  await banco?.apagarSchema();
  await banco?.fechar();
});

const token = (id: string, perfil = "USUARIO") =>
  new SignJWT({ nome: id, perfil }).setProtectedHeader({ alg: "HS256" }).setSubject(id).setIssuedAt().setExpirationTime("15m").sign(SEGREDO);

const COMPRADORA = "compradora-1";
const VENDEDORA = "vendedora-1";
const OUTRA = "intrusa-1";
const ADMIN = "lucy-1";

const como = async (id: string, perfil?: string) => ({ Authorization: `Bearer ${await token(id, perfil)}` });
const interno = { "X-API-Key": CHAVE };
const ENDERECO = { cep: "70000-000", rua: "Rua A, 10", cidade: "Brasília", uf: "DF" };

/** Pedido criado pelo "checkout" (rota interna), com uma peça do preço dado. */
async function criarPedido(precoCentavos = 10_000, freteCentavos = 1990) {
  const res = await request(app)
    .post("/interno/pedidos")
    .set(interno)
    .send({ compradoraId: COMPRADORA, vendedoraId: VENDEDORA, itens: [{ id: "peca-1", titulo: "Jaqueta", precoCentavos }], freteCentavos, endereco: ENDERECO })
    .expect(201);
  return res.body as { id: string; vendedoraCentavos: number; comissaoCentavos: number; totalCentavos: number; comissaoPontosBase: number; taxaPixCentavos: number };
}

const pagar = (id: string) => request(app).post(`/interno/pedidos/${id}/pagamento-confirmado`).set(interno);
const enviar = async (id: string, quem = VENDEDORA, esperado = 200) => request(app).post(`/pedidos/${id}/enviar`).set(await como(quem)).expect(esperado);
const receber = async (id: string, quem = COMPRADORA, esperado = 200) =>
  request(app).post(`/pedidos/${id}/confirmar-recebimento`).set(await como(quem)).expect(esperado);
const carteira = async (quem = VENDEDORA) => (await request(app).get("/carteira").set(await como(quem)).expect(200)).body;

describe("pedidos: transições válidas de status", () => {
  it("AGUARDANDO_PAGAMENTO → PAGO → ENVIADO → ENTREGUE", async () => {
    const p = await criarPedido();
    expect((await pagar(p.id).expect(200)).body.status).toBe("PAGO");
    expect((await enviar(p.id, VENDEDORA, 200)).body.status).toBe("ENVIADO");
    expect((await receber(p.id, COMPRADORA, 200)).body.status).toBe("ENTREGUE");
  });

  it("a compradora cancela antes de pagar; o sistema cancela Pix expirado; o admin cancela pedido pago", async () => {
    const a = await criarPedido();
    await request(app).post(`/pedidos/${a.id}/cancelar`).set(await como(COMPRADORA)).expect(200);
    const b = await criarPedido();
    expect((await request(app).post(`/interno/pedidos/${b.id}/expirar`).set(interno).expect(200)).body.status).toBe("CANCELADO");
    const c = await criarPedido();
    await pagar(c.id).expect(200);
    expect((await request(app).post(`/admin/pedidos/${c.id}/cancelar`).set(await como(ADMIN, "ADMIN_MASTER")).expect(200)).body.status).toBe("CANCELADO");
  });
});

describe("pedidos: transições inválidas (devem falhar)", () => {
  it("não envia antes de pagar e não confirma antes de enviar", async () => {
    const p = await criarPedido();
    await enviar(p.id, VENDEDORA, 409);
    await receber(p.id, COMPRADORA, 409);
    await pagar(p.id).expect(200);
    await receber(p.id, COMPRADORA, 409);
  });

  it("webhook repetido é idempotente: responde 200 e lança na carteira uma vez só", async () => {
    const p = await criarPedido();
    expect((await pagar(p.id).expect(200)).body.status).toBe("PAGO");
    expect((await pagar(p.id).expect(200)).body.status).toBe("PAGO");
    expect((await carteira()).pendenteCentavos).toBe(p.vendedoraCentavos);

    const c = await criarPedido();
    await request(app).post(`/interno/pedidos/${c.id}/expirar`).set(interno).expect(200);
    expect((await request(app).post(`/interno/pedidos/${c.id}/expirar`).set(interno).expect(200)).body.status).toBe("CANCELADO");
    // pago não vira cancelado pelo sistema (só a administração estorna), e cancelado não vira pago
    await request(app).post(`/interno/pedidos/${p.id}/expirar`).set(interno).expect(403);
    await pagar(c.id).expect(409);
  });

  it("pedido entregue ou cancelado não muda mais", async () => {
    const p = await criarPedido();
    await pagar(p.id);
    await enviar(p.id);
    await receber(p.id);
    await enviar(p.id, VENDEDORA, 409);
    await request(app).post(`/admin/pedidos/${p.id}/cancelar`).set(await como(ADMIN, "ADMIN_MASTER")).expect(409);

    const c = await criarPedido();
    await request(app).post(`/pedidos/${c.id}/cancelar`).set(await como(COMPRADORA)).expect(200);
    await pagar(c.id).expect(409);
  });

  it("a compradora não cancela depois de pago (só a administração)", async () => {
    const p = await criarPedido();
    await pagar(p.id);
    await request(app).post(`/pedidos/${p.id}/cancelar`).set(await como(COMPRADORA)).expect(403);
  });

  it("a tabela da máquina de estados só permite as 7 transições previstas", () => {
    const atores = ["compradora", "vendedora", "admin", "sistema"] as const;
    const permitidas: string[] = [];
    for (const de of STATUS) for (const para of STATUS) for (const ator of atores) if (conferirTransicao(de, para, ator).ok) permitidas.push(`${de}>${para}:${ator}`);
    expect(permitidas.sort()).toEqual(
      [
        "AGUARDANDO_PAGAMENTO>PAGO:sistema",
        "AGUARDANDO_PAGAMENTO>CANCELADO:compradora",
        "AGUARDANDO_PAGAMENTO>CANCELADO:admin",
        "AGUARDANDO_PAGAMENTO>CANCELADO:sistema",
        "PAGO>ENVIADO:vendedora",
        "PAGO>CANCELADO:admin",
        "ENVIADO>ENTREGUE:compradora",
      ].sort(),
    );
  });
});

describe("pedidos: quem não é dona do pedido recebe 403", () => {
  it("outra usuária não envia, não confirma, não cancela e não vê o pedido", async () => {
    const p = await criarPedido();
    await pagar(p.id);
    await enviar(p.id, OUTRA, 403);
    await request(app).get(`/pedidos/${p.id}`).set(await como(OUTRA)).expect(403);
    await request(app).post(`/pedidos/${p.id}/cancelar`).set(await como(OUTRA)).expect(403);
    await enviar(p.id);
    await receber(p.id, OUTRA, 403);
  });

  it("cada uma só faz a sua parte: a compradora não envia e a vendedora não confirma o recebimento", async () => {
    const p = await criarPedido();
    await pagar(p.id);
    await enviar(p.id, COMPRADORA, 403);
    await enviar(p.id);
    await receber(p.id, VENDEDORA, 403);
  });

  it("sem login: 401; rota interna sem API key: 401", async () => {
    const p = await criarPedido();
    await request(app).post(`/pedidos/${p.id}/enviar`).expect(401);
    await request(app).post(`/interno/pedidos/${p.id}/pagamento-confirmado`).expect(401);
    await request(app).post(`/interno/pedidos/${p.id}/pagamento-confirmado`).set("X-API-Key", "errada").expect(401);
  });

  it("compras e vendas: cada uma vê os seus; o endereço só aparece para a vendedora", async () => {
    await criarPedido();
    const compras = (await request(app).get("/pedidos/compras").set(await como(COMPRADORA)).expect(200)).body.pedidos;
    const vendas = (await request(app).get("/pedidos/vendas").set(await como(VENDEDORA)).expect(200)).body.pedidos;
    expect(compras).toHaveLength(1);
    expect(compras[0].endereco).toBeUndefined();
    expect(vendas[0].endereco).toEqual(ENDERECO);
    expect((await request(app).get("/pedidos/compras").set(await como(OUTRA)).expect(200)).body.pedidos).toHaveLength(0);
    expect((await request(app).get("/pedidos/vendas?status=PAGO").set(await como(VENDEDORA)).expect(200)).body.pedidos).toHaveLength(0);
    await request(app).get("/pedidos/vendas?status=QUALQUER").set(await como(VENDEDORA)).expect(400);
  });

  it("a vendedora não pode comprar a própria peça", async () => {
    await request(app)
      .post("/interno/pedidos")
      .set(interno)
      .send({ compradoraId: VENDEDORA, vendedoraId: VENDEDORA, itens: [{ id: "p", titulo: "x", precoCentavos: 100 }], freteCentavos: 0, endereco: {} })
      .expect(400);
  });
});

describe("carteira: divisão sem diferença de centavos", () => {
  it.each([
    [1001, 100, 901], // R$ 10,01 a 10%
    [3333, 333, 3000], // R$ 33,33 a 10%
    [18990, 1899, 17091],
  ])("peças de %i centavos: comissão %i + vendedora %i, somando o total exato", async (preco, comissao, vendedoraPecas) => {
    const p = await criarPedido(preco, 1990);
    expect(p.comissaoCentavos).toBe(comissao);
    expect(p.vendedoraCentavos).toBe(vendedoraPecas + 1990); // a vendedora recebe também o frete
    expect(p.comissaoCentavos + p.vendedoraCentavos).toBe(p.totalCentavos);
  });

  it("vários pedidos quebrados: a soma da carteira com a comissão bate com o total vendido", async () => {
    const ids = [];
    for (const preco of [1001, 3333, 999, 1, 12345]) ids.push((await criarPedido(preco, 0)).id);
    for (const id of ids) {
      await pagar(id);
      await enviar(id);
      await receber(id);
    }
    const resumo = (await request(app).get("/admin/resumo").set(await como(ADMIN, "ADMIN_MASTER")).expect(200)).body;
    const { disponivelCentavos } = await carteira();
    expect(disponivelCentavos + resumo.vendas.comissaoCentavos).toBe(resumo.vendas.totalCentavos);
  });
});

describe("carteira: saldo só é liberado depois do recebimento", () => {
  it("pago → pendente; enviado → continua pendente; entregue → disponível", async () => {
    const p = await criarPedido(10_000, 0);
    expect(await carteira()).toMatchObject({ pendenteCentavos: 0, disponivelCentavos: 0 });
    await pagar(p.id);
    expect(await carteira()).toMatchObject({ pendenteCentavos: 9000, disponivelCentavos: 0 });
    await enviar(p.id);
    expect(await carteira()).toMatchObject({ pendenteCentavos: 9000, disponivelCentavos: 0 });
    await receber(p.id);
    const final = await carteira();
    expect(final).toMatchObject({ pendenteCentavos: 0, disponivelCentavos: 9000 });
    const daVendedora = final.extrato.filter((l: { conta: string }) => l.conta === "vendedora");
    expect(daVendedora.map((l: { tipo: string }) => l.tipo).sort()).toEqual(["liberacao", "venda"]);
  });

  it("pedido pago e cancelado estorna o pendente", async () => {
    const p = await criarPedido(10_000, 0);
    await pagar(p.id);
    await request(app).post(`/admin/pedidos/${p.id}/cancelar`).set(await como(ADMIN, "ADMIN_MASTER")).expect(200);
    expect(await carteira()).toMatchObject({ pendenteCentavos: 0, disponivelCentavos: 0 });
  });
});

describe("carteira: repasse", () => {
  async function vendaEntregue(preco = 10_000) {
    const p = await criarPedido(preco, 0);
    await pagar(p.id);
    await enviar(p.id);
    await receber(p.id);
  }
  const pedirSaque = async (valorCentavos: number, esperado: number) =>
    request(app).post("/carteira/repasses").set(await como(VENDEDORA)).send({ valorCentavos }).expect(esperado);

  it("repasse maior que o saldo disponível é recusado (inclusive com dinheiro só pendente)", async () => {
    const p = await criarPedido(10_000, 0);
    await pagar(p.id); // 9000 pendente, 0 disponível
    await pedirSaque(1, 422);
    await enviar(p.id);
    await receber(p.id); // 9000 disponível
    await pedirSaque(9001, 422);
    await pedirSaque(9000, 201);
  });

  it("saques em aberto contam: dois pedidos que juntos passam do saldo, o segundo é recusado", async () => {
    await vendaEntregue(); // 9000 disponível
    await pedirSaque(6000, 201);
    await pedirSaque(3001, 422);
    expect(await carteira()).toMatchObject({ disponivelCentavos: 9000, emSaqueCentavos: 6000, podeSacarCentavos: 3000 });
  });

  it("o admin registra o pagamento do repasse, que debita o disponível uma única vez", async () => {
    await vendaEntregue();
    const repasse = (await pedirSaque(5000, 201)).body;
    const lucy = await como(ADMIN, "ADMIN_MASTER");
    expect((await request(app).get("/admin/repasses?status=SOLICITADO").set(lucy).expect(200)).body.repasses).toHaveLength(1);
    await request(app).post(`/admin/repasses/${repasse.id}/pagar`).set(lucy).expect(200);
    await request(app).post(`/admin/repasses/${repasse.id}/pagar`).set(lucy).expect(409);
    expect(await carteira()).toMatchObject({ disponivelCentavos: 4000, emSaqueCentavos: 0 });
  });

  it("valor inválido (zero, negativo ou com fração de centavo) é 400", async () => {
    await vendaEntregue();
    for (const valor of [0, -100, 10.5]) await pedirSaque(valor, 400);
  });
});

describe("admin: comissão e acesso ao painel", () => {
  it("mudar a comissão não afeta pedidos antigos, só os novos", async () => {
    const lucy = await como(ADMIN, "ADMIN_MASTER");
    const antigo = await criarPedido(10_000, 0);
    expect(antigo).toMatchObject({ comissaoPontosBase: 1000, comissaoCentavos: 1000 });

    await request(app).put("/admin/comissao").set(lucy).send({ comissaoPontosBase: 1500 }).expect(200);
    const novo = await criarPedido(10_000, 0);
    expect(novo).toMatchObject({ comissaoPontosBase: 1500, comissaoCentavos: 1500, vendedoraCentavos: 8500 });

    // o antigo continua com 10%, inclusive quando é pago e entra na carteira depois da mudança
    await pagar(antigo.id);
    const lido = (await request(app).get(`/pedidos/${antigo.id}`).set(await como(VENDEDORA)).expect(200)).body;
    expect(lido).toMatchObject({ comissaoPontosBase: 1000, comissaoCentavos: 1000, vendedoraCentavos: 9000 });
    expect(await carteira()).toMatchObject({ pendenteCentavos: 9000 });
  });

  it("quem não é administradora recebe 403 em todo o painel; sem login, 401", async () => {
    for (const perfil of ["USUARIO", "ADMIN"]) {
      const cabecalho = await como(OUTRA, perfil);
      await request(app).get("/admin/resumo").set(cabecalho).expect(403);
      await request(app).get("/admin/pedidos").set(cabecalho).expect(403);
      await request(app).put("/admin/comissao").set(cabecalho).send({ comissaoPontosBase: 0 }).expect(403);
      await request(app).get("/admin/repasses").set(cabecalho).expect(403);
    }
    await request(app).get("/admin/resumo").expect(401);
    expect((await request(app).get("/admin/comissao").set(await como(ADMIN, "ADMIN_MASTER")).expect(200)).body.comissaoPontosBase).toBe(1000);
  });

  it("token adulterado (assinado com outro segredo) não entra", async () => {
    const falso = await new SignJWT({ perfil: "ADMIN_MASTER" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("invasora")
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("outro-segredo-qualquer-com-32-caracteres!"));
    await request(app).get("/admin/resumo").set("Authorization", `Bearer ${falso}`).expect(401);
  });

  it("comissão inválida é recusada (fração, negativa ou acima de 50%)", async () => {
    const lucy = await como(ADMIN, "ADMIN_MASTER");
    for (const valor of [10.5, -1, 5001, "1000"]) await request(app).put("/admin/comissao").set(lucy).send({ comissaoPontosBase: valor }).expect(400);
  });

  it("visão geral: pedidos por status, vendas e repasses", async () => {
    const a = await criarPedido(10_000, 0);
    await criarPedido(5000, 0);
    await pagar(a.id);
    const resumo = (await request(app).get("/admin/resumo").set(await como(ADMIN, "ADMIN_MASTER")).expect(200)).body;
    expect(resumo.pedidosPorStatus).toEqual({ PAGO: 1, AGUARDANDO_PAGAMENTO: 1 });
    expect(resumo.vendas).toEqual({ quantidade: 1, totalCentavos: 10_000, comissaoCentavos: 1000, taxaPixCentavos: 0 });
    const lista = (await request(app).get("/admin/pedidos?status=PAGO").set(await como(ADMIN, "ADMIN_MASTER")).expect(200)).body.pedidos;
    expect(lista.map((p: { id: string }) => p.id)).toEqual([a.id]);
  });
});

type LancamentoTeste = { conta: string; tipo: string; pedidoId: string | null; pendenteCentavos: number; disponivelCentavos: number };

describe("livro-razão: lançamentos de vendedora, comissão e taxa do Pix", () => {
  const lucy = () => como(ADMIN, "ADMIN_MASTER");

  it("venda paga gera três lançamentos que somam exatamente o total cobrado", async () => {
    await request(app).put("/admin/taxa-pix").set(await lucy()).send({ taxaPixPontosBase: 99 }).expect(200); // 0,99%
    const p = await criarPedido(10_001, 1990); // total 11 991
    expect(p).toMatchObject({ totalCentavos: 11_991, comissaoCentavos: 1000, taxaPixCentavos: 119, taxaPixPontosBase: 99 });
    expect(p.vendedoraCentavos).toBe(11_991 - 1000 - 119);

    await pagar(p.id).expect(200);
    const { extrato, pendenteCentavos } = await carteira();
    const daVenda = (extrato as LancamentoTeste[]).filter((l) => l.pedidoId === p.id && l.tipo === "venda");
    expect(Object.fromEntries(daVenda.map((l) => [l.conta, l.pendenteCentavos + l.disponivelCentavos]))).toEqual({
      vendedora: p.vendedoraCentavos,
      comissao: 1000,
      taxa_pix: 119,
    });
    expect(daVenda.reduce((soma, l) => soma + l.pendenteCentavos + l.disponivelCentavos, 0)).toBe(p.totalCentavos);
    // o saldo da vendedora soma só os lançamentos dela
    expect(pendenteCentavos).toBe(p.vendedoraCentavos);
  });

  it("cancelar um pedido pago estorna as três contas", async () => {
    await request(app).put("/admin/taxa-pix").set(await lucy()).send({ taxaPixPontosBase: 100 }).expect(200);
    const p = await criarPedido(10_000, 0);
    await pagar(p.id);
    await request(app).post(`/admin/pedidos/${p.id}/cancelar`).set(await lucy()).expect(200);
    const extrato = (await carteira()).extrato as LancamentoTeste[];
    for (const conta of ["vendedora", "comissao", "taxa_pix"]) {
      const soma = extrato.filter((l) => l.conta === conta).reduce((t, l) => t + l.pendenteCentavos + l.disponivelCentavos, 0);
      expect(soma, conta).toBe(0);
    }
    expect(extrato).toHaveLength(6); // nada foi apagado: 3 da venda + 3 do estorno
  });

  it("nova taxa do Pix vale só para pedidos novos", async () => {
    const antigo = await criarPedido(10_000, 0);
    await request(app).put("/admin/taxa-pix").set(await lucy()).send({ taxaPixPontosBase: 500 }).expect(200);
    const novo = await criarPedido(10_000, 0);
    expect(novo).toMatchObject({ taxaPixPontosBase: 500, taxaPixCentavos: 500, vendedoraCentavos: 8500 });
    await pagar(antigo.id);
    expect(await carteira()).toMatchObject({ pendenteCentavos: 9000 });
  });

  it("taxa do Pix inválida é recusada (fração, negativa, acima de 10% ou texto)", async () => {
    for (const valor of [9.5, -1, 1001, "99"]) await request(app).put("/admin/taxa-pix").set(await lucy()).send({ taxaPixPontosBase: valor }).expect(400);
  });

  it.skipIf(!URL_TESTE)("no Postgres, o banco recusa alterar ou apagar um lançamento", async () => {
    const p = await criarPedido(10_000, 0);
    await pagar(p.id);
    const { default: pg } = await import("pg");
    const cliente = new pg.Client({ connectionString: URL_TESTE });
    await cliente.connect();
    try {
      await expect(cliente.query(`UPDATE ${SCHEMA}.lancamentos SET pendente_centavos = 1`)).rejects.toThrow(/imutáveis/);
      await expect(cliente.query(`DELETE FROM ${SCHEMA}.lancamentos`)).rejects.toThrow(/imutáveis/);
    } finally {
      await cliente.end();
    }
    expect(await carteira()).toMatchObject({ pendenteCentavos: 9000 });
  });
});

describe("admin: configurações da plataforma", () => {
  const lucy = () => como(ADMIN, "ADMIN_MASTER");
  const faixa = (categoria: string, condicao: string, minimoCentavos: number, maximoCentavos: number) => ({ categoria, condicao, minimoCentavos, maximoCentavos });

  it("sem configuração, vale a tabela inicial: uma faixa por categoria e condição", async () => {
    const config = (await request(app).get("/config").expect(200)).body;
    expect(config).toMatchObject({ comissaoPontosBase: 1000, taxaPixPontosBase: 0 });
    expect(config.precosSugeridos).toHaveLength(20);
    for (const f of config.precosSugeridos) expect(f.minimoCentavos).toBeLessThanOrEqual(f.maximoCentavos);
  });

  it("o admin troca a tabela de preço sugerido e a rota pública mostra a nova", async () => {
    const faixas = [faixa("bolsas", "otimo_estado", 8000, 30_000), faixa("calcados", "bom_estado", 2000, 9000)];
    const r = await request(app).put("/admin/precos-sugeridos").set(await lucy()).send({ faixas }).expect(200);
    expect(r.body.precosSugeridos).toEqual(faixas);
    expect((await request(app).get("/config").expect(200)).body.precosSugeridos).toEqual(faixas);
    expect((await request(app).get("/admin/configuracao").set(await lucy()).expect(200)).body.precosSugeridos).toEqual(faixas);
  });

  it("tabela inválida é recusada", async () => {
    const invalidas = [
      [faixa("bolsas", "otimo_estado", 9000, 8000)], // mínimo maior que o máximo
      [faixa("veiculos", "otimo_estado", 1000, 2000)], // categoria fora da moda
      [faixa("bolsas", "seminova", 1000, 2000)], // condição que não existe
      [faixa("bolsas", "otimo_estado", 0, 2000)], // mínimo zero
      [faixa("bolsas", "otimo_estado", 1000.5, 2000)], // fração de centavo
      [faixa("bolsas", "otimo_estado", 1000, 2000), faixa("bolsas", "otimo_estado", 3000, 4000)], // repetida
      [],
    ];
    for (const faixas of invalidas) await request(app).put("/admin/precos-sugeridos").set(await lucy()).send({ faixas }).expect(400);
    expect((await request(app).get("/config").expect(200)).body.precosSugeridos).toHaveLength(20);
  });

  it("quem não é administradora não altera a configuração (403); sem login, 401", async () => {
    for (const perfil of ["USUARIO", "ADMIN"]) {
      const cabecalho = await como(OUTRA, perfil);
      await request(app).get("/admin/configuracao").set(cabecalho).expect(403);
      await request(app).put("/admin/taxa-pix").set(cabecalho).send({ taxaPixPontosBase: 0 }).expect(403);
      await request(app).put("/admin/precos-sugeridos").set(cabecalho).send({ faixas: [faixa("bolsas", "otimo_estado", 1, 2)] }).expect(403);
    }
    await request(app).put("/admin/taxa-pix").send({ taxaPixPontosBase: 0 }).expect(401);
    expect((await request(app).get("/config").expect(200)).body.taxaPixPontosBase).toBe(0);
  });
});
