import { afterEach, describe, expect, it, vi } from "vitest";
import type { Peca } from "@/types/catalogo";
import { liberarPeca, listarPecas, reservarPeca, statusAtual } from "./catalogo";

const base: Peca = {
  id: "p1",
  titulo: "Óculos de sol redondo",
  marca: "vintage",
  categoria: "acessorios",
  tamanho: "único",
  condicao: "otimo_estado",
  precoCentavos: 6990,
  fotoUrl: "https://images.unsplash.com/photo-teste",
  fotoAlt: "Óculos",
  vendedor: { nomePublico: "Tati", cidade: "Fortaleza, CE" },
  descricao: "Lentes sem riscos",
  medidas: {},
  status: "disponivel",
  reservadaAte: null,
  criadoEm: "2026-11-08T12:00:00.000Z",
};

const peca = (dados: Partial<Peca>): Peca => ({ ...base, ...dados });
const agora = new Date("2026-11-19T12:00:00.000Z");

describe("statusAtual", () => {
  it("mantém a reserva enquanto ela não vence", () => {
    expect(statusAtual(peca({ status: "reservada", reservadaAte: "2026-11-19T12:10:00.000Z" }), agora)).toBe("reservada");
  });

  it("libera a peça quando a reserva vence", () => {
    expect(statusAtual(peca({ status: "reservada", reservadaAte: "2026-11-19T11:59:00.000Z" }), agora)).toBe("disponivel");
  });

  it("peça vendida continua vendida", () => {
    expect(statusAtual(peca({ status: "vendida" }), agora)).toBe("vendida");
  });
});

describe("listarPecas (a busca e os filtros acontecem no servidor)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const pagina = { itens: [peca({})], total: 1, pagina: 1, porPagina: 12 };
  const urlPedida = async (filtros: Parameters<typeof listarPecas>[0]) => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify(pagina)));
    vi.stubGlobal("fetch", fetchFalso);
    await listarPecas(filtros);
    return new URL(fetchFalso.mock.calls[0][0], "http://teste");
  };

  it("sem filtros, chama GET /pecas sem query e devolve a página como veio", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(pagina))));
    expect(await listarPecas()).toEqual(pagina);
    expect((await urlPedida({})).href).toBe("http://teste/api/pecas");
  });

  it("manda cada filtro com o nome que a API espera (preços em centavos)", async () => {
    const url = await urlPedida({
      busca: "óculos",
      categoria: "acessorios",
      tamanho: "único",
      condicao: "otimo_estado",
      precoMinCentavos: 5000,
      precoMaxCentavos: 9990,
      ordem: "menor-preco",
      pagina: 2,
      porPagina: 24,
    });
    expect(url.pathname).toBe("/api/pecas");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      busca: "óculos",
      categoria: "acessorios",
      tamanho: "único",
      condicao: "otimo_estado",
      precoMin: "5000",
      precoMax: "9990",
      ordem: "menor-preco",
      pagina: "2",
      porPagina: "24",
    });
  });

  it("não manda filtros vazios", async () => {
    const url = await urlPedida({ busca: "", categoria: undefined, ordem: "recentes" });
    expect(Object.fromEntries(url.searchParams)).toEqual({ ordem: "recentes" });
  });

  it("erro da API (ex.: 400) chega como ApiErro, para a página tratar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: "confira os dados enviados." }), { status: 400 })));
    await expect(listarPecas({ busca: "x" })).rejects.toMatchObject({ status: 400, detalhe: "confira os dados enviados." });
  });
});

describe("reservarPeca e liberarPeca", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pede a reserva ao servidor (POST /pecas/:id/reservar), que decide se ainda está livre", async () => {
    const reservada = peca({ status: "reservada", reservadaAte: new Date(Date.now() + 15 * 60_000).toISOString() });
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify(reservada)));
    vi.stubGlobal("fetch", fetchFalso);

    const resultado = await reservarPeca("p1");
    expect(resultado.status).toBe("reservada");
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/pecas/p1/reservar");
    expect(fetchFalso.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("traduz 409 (outra pessoa reservou) e 404 (peça sumiu) em mensagens para a pessoa", async () => {
    const resposta = (status: number) => new Response(JSON.stringify({ erro: "x" }), { status });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(resposta(409)).mockResolvedValueOnce(resposta(404)).mockResolvedValueOnce(resposta(500)));

    await expect(reservarPeca("p1")).rejects.toThrow(/reservada ou vendida/);
    await expect(reservarPeca("p1")).rejects.toThrow(/não existe mais/);
    await expect(reservarPeca("p1")).rejects.toMatchObject({ status: 500 });
  });

  it("liberarPeca desfaz a reserva no servidor", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify(peca({}))));
    vi.stubGlobal("fetch", fetchFalso);
    await liberarPeca("p1");
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/pecas/p1/liberar");
  });
});
