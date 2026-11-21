import { SignJWT } from "jose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { criarAppPedidos } from "./app.js";
import { abrirBancoPedidos, type Pedido } from "./banco.js";
import { montarDashboard } from "./dashboard.js";
import type { StatusPedido } from "./estados.js";

const AGORA = Date.UTC(2026, 10, 21, 15); // 21/11/2026, sábado

let seq = 0;
function pedido(dados: { em: string; status?: StatusPedido; total?: number; comissao?: number; taxa?: number; uf?: string; cidade?: string; vendedora?: string; categorias?: (string | undefined)[] }): Pedido {
  const total = dados.total ?? 10_000;
  const comissao = dados.comissao ?? 1000;
  const taxa = dados.taxa ?? 0;
  const categorias = dados.categorias ?? ["bolsas"];
  return {
    id: `p${++seq}`,
    compradoraId: "c1",
    vendedoraId: dados.vendedora ?? "v1",
    itens: categorias.map((categoria, i) => ({ id: `i${seq}-${i}`, titulo: "peça", precoCentavos: Math.floor(total / categorias.length), categoria })),
    endereco: { uf: dados.uf ?? "DF", cidade: dados.cidade ?? "Brasília" },
    subtotalCentavos: total,
    freteCentavos: 0,
    totalCentavos: total,
    comissaoPontosBase: 1000,
    comissaoCentavos: comissao,
    taxaPixPontosBase: 0,
    taxaPixCentavos: taxa,
    vendedoraCentavos: total - comissao - taxa,
    status: dados.status ?? "ENTREGUE",
    criadoEm: dados.em,
    atualizadoEm: dados.em,
  };
}

describe("dashboard: cálculo", () => {
  it("conta só vendas (pago, enviado, entregue) dentro do período e soma em centavos", () => {
    const d = montarDashboard(
      [
        pedido({ em: "2026-11-20T10:00:00Z", total: 10_000, comissao: 1000, taxa: 99 }),
        pedido({ em: "2026-11-02T10:00:00Z", status: "PAGO", total: 5001, comissao: 500, categorias: ["bolsas", "calcados"] }),
        pedido({ em: "2026-11-19T10:00:00Z", status: "CANCELADO" }),
        pedido({ em: "2026-11-19T10:00:00Z", status: "AGUARDANDO_PAGAMENTO" }),
        pedido({ em: "2026-09-01T10:00:00Z" }), // fora dos 30 dias
      ],
      "30d",
      AGORA,
    );
    expect(d.granularidade).toBe("dia");
    expect(d.totais).toEqual({
      pedidos: 2,
      pecas: 3,
      vendasCentavos: 15_001,
      comissaoCentavos: 1500,
      taxaPixCentavos: 99,
      ticketMedioCentavos: 7501, // 7500,5 arredonda para cima
      comissaoPorPecaCentavos: 500,
    });
    expect(d.serie).toHaveLength(30);
    expect(d.serie.at(-1)).toMatchObject({ inicio: "2026-11-21", pedidos: 0 });
    expect(d.serie.find((p) => p.inicio === "2026-11-20")).toEqual({ inicio: "2026-11-20", pedidos: 1, vendasCentavos: 10_000, comissaoCentavos: 1000 });
    // a soma da série bate com o total
    expect(d.serie.reduce((s, p) => s + p.vendasCentavos, 0)).toBe(d.totais.vendasCentavos);
  });

  it("agrupa por estado, cidade (sem diferenciar maiúsculas), categoria e vendedora, do maior para o menor", () => {
    const d = montarDashboard(
      [
        pedido({ em: "2026-10-01T10:00:00Z", uf: "sp", cidade: "São Paulo", total: 3000, vendedora: "a" }),
        pedido({ em: "2026-10-02T10:00:00Z", uf: "SP", cidade: "são paulo", total: 4000, vendedora: "b", categorias: ["calcados"] }),
        pedido({ em: "2026-10-03T10:00:00Z", uf: "RJ", cidade: "Niterói", total: 9000, vendedora: "b", categorias: [undefined] }),
      ],
      "12m",
      AGORA,
    );
    expect(d.granularidade).toBe("mes");
    expect(d.serie).toHaveLength(12);
    expect(d.serie[0].inicio).toBe("2025-12-01");
    expect(d.porUf).toEqual([
      { uf: "RJ", pedidos: 1, vendasCentavos: 9000 },
      { uf: "SP", pedidos: 2, vendasCentavos: 7000 },
    ]);
    expect(d.cidades[0]).toEqual({ cidade: "São Paulo", uf: "SP", pedidos: 2 });
    expect(d.porCategoria.map((c) => c.categoria)).toEqual(["sem-categoria", "calcados", "bolsas"]);
    expect(d.vendedoras[0]).toMatchObject({ vendedoraId: "b", pedidos: 2, vendasCentavos: 13_000 });
  });

  it("90 dias agrupa por semana (começando na segunda); sem vendas, tudo zero", () => {
    const d = montarDashboard([], "90d", AGORA);
    expect(d.granularidade).toBe("semana");
    for (const p of d.serie) expect(new Date(`${p.inicio}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(d.totais).toMatchObject({ pedidos: 0, vendasCentavos: 0, ticketMedioCentavos: 0, comissaoPorPecaCentavos: 0 });
    expect(d.porUf).toEqual([]);
  });

  it("'tudo' começa no mês da primeira venda e vai no máximo 24 meses para trás", () => {
    expect(montarDashboard([pedido({ em: "2026-08-15T10:00:00Z" })], "tudo", AGORA).serie.map((p) => p.inicio)).toEqual([
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
      "2026-11-01",
    ]);
    expect(montarDashboard([pedido({ em: "2020-01-15T10:00:00Z" })], "tudo", AGORA).serie).toHaveLength(24);
  });
});

describe("dashboard: rota do painel", () => {
  const SEGREDO = new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres");
  const como = async (perfil: string) => ({
    Authorization: `Bearer ${await new SignJWT({ nome: "x", perfil }).setProtectedHeader({ alg: "HS256" }).setSubject("u-1").setExpirationTime("15m").sign(SEGREDO)}`,
  });
  const app = async () =>
    criarAppPedidos(await abrirBancoPedidos(undefined, "pedidos"), { jwtSegredo: SEGREDO, apiKeys: ["k"], origens: [], trustProxy: "loopback" });

  it("só a administradora master vê; período inválido é 400; padrão 12 meses", async () => {
    const a = await app();
    await request(a).get("/admin/dashboard").expect(401);
    for (const perfil of ["USUARIO", "ADMIN"]) await request(a).get("/admin/dashboard").set(await como(perfil)).expect(403);
    await request(a).get("/admin/dashboard?periodo=7anos").set(await como("ADMIN_MASTER")).expect(400);
    const r = await request(a).get("/admin/dashboard").set(await como("ADMIN_MASTER")).expect(200);
    expect(r.body).toMatchObject({ periodo: "12m", granularidade: "mes", totais: { pedidos: 0 } });
  });

  it("pedido com categoria entra no dashboard; categoria fora da moda é recusada", async () => {
    const a = await app();
    const corpo = (categoria: string) => ({
      compradoraId: "c1",
      vendedoraId: "v1",
      itens: [{ id: "x", titulo: "Bolsa", precoCentavos: 5000, categoria }],
      freteCentavos: 0,
      endereco: { uf: "MG", cidade: "Belo Horizonte" },
    });
    await request(a).post("/interno/pedidos").set("X-API-Key", "k").send(corpo("veiculos")).expect(400);
    const p = (await request(a).post("/interno/pedidos").set("X-API-Key", "k").send(corpo("bolsas")).expect(201)).body;
    await request(a).post(`/interno/pedidos/${p.id}/pagamento-confirmado`).set("X-API-Key", "k").expect(200);
    const d = (await request(a).get("/admin/dashboard?periodo=30d").set(await como("ADMIN_MASTER")).expect(200)).body;
    expect(d.porCategoria).toEqual([{ categoria: "bolsas", pecas: 1, vendasCentavos: 5000 }]);
    expect(d.porUf).toEqual([{ uf: "MG", pedidos: 1, vendasCentavos: 5000 }]);
  });

  it("modo demonstração: dados fictícios marcados, sempre iguais, sem gravar nada no banco", async () => {
    const a = await app();
    const lucy = await como("ADMIN_MASTER");
    const d1 = (await request(a).get("/admin/dashboard?periodo=12m&demo=1").set(lucy).expect(200)).body;
    const d2 = (await request(a).get("/admin/dashboard?periodo=12m&demo=1").set(lucy).expect(200)).body;
    expect(d1.demonstracao).toBe(true);
    expect(d1).toEqual(d2);
    expect(d1.totais.pedidos).toBeGreaterThan(100);
    expect(d1.porUf[0].uf).toBe("SP");
    expect(d1.vendedoras[0].nome).toEqual(expect.any(String));
    expect(d1.serie.reduce((s: number, p: { vendasCentavos: number }) => s + p.vendasCentavos, 0)).toBe(d1.totais.vendasCentavos);
    // o real continua vazio
    const real = (await request(a).get("/admin/dashboard?periodo=12m").set(lucy).expect(200)).body;
    expect(real).toMatchObject({ demonstracao: false, totais: { pedidos: 0 } });
    await request(a).get("/admin/dashboard?demo=sim").set(lucy).expect(400);
  });
});
