import { afterEach, describe, expect, it, vi } from "vitest";
import type { Peca } from "@/types/catalogo";
import { filtrarPecas, liberarPeca, normalizar, reservarPeca, statusAtual } from "./catalogo";

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

describe("filtrarPecas", () => {
  const pecas = [
    peca({ id: "a", titulo: "Óculos de sol redondo", precoCentavos: 6990, criadoEm: "2026-11-08T12:00:00.000Z" }),
    peca({ id: "b", titulo: "Bolsa de palha", categoria: "bolsas", precoCentavos: 8990, criadoEm: "2026-11-14T12:00:00.000Z" }),
    peca({ id: "c", titulo: "Jaqueta de couro", categoria: "feminino", tamanho: "M", precoCentavos: 18990, criadoEm: "2026-11-18T12:00:00.000Z" }),
    peca({ id: "d", titulo: "Vestido vendido", status: "vendida" }),
  ];
  const ids = (lista: Peca[]) => lista.map((p) => p.id);

  it("esconde peças vendidas e ordena das mais recentes para as mais antigas", () => {
    expect(ids(filtrarPecas(pecas, {}, agora))).toEqual(["c", "b", "a"]);
  });

  it("busca sem diferenciar maiúsculas e acentos", () => {
    expect(normalizar("ÓCULOS")).toBe("oculos");
    expect(ids(filtrarPecas(pecas, { busca: "oculos" }, agora))).toEqual(["a"]);
    expect(ids(filtrarPecas(pecas, { busca: "JAQUETA" }, agora))).toEqual(["c"]);
  });

  it("combina categoria, tamanho, preço máximo e ordenação", () => {
    expect(ids(filtrarPecas(pecas, { categoria: "bolsas" }, agora))).toEqual(["b"]);
    expect(ids(filtrarPecas(pecas, { tamanho: "M" }, agora))).toEqual(["c"]);
    expect(ids(filtrarPecas(pecas, { precoMaxCentavos: 9000, ordem: "maior-preco" }, agora))).toEqual(["b", "a"]);
    expect(ids(filtrarPecas(pecas, { ordem: "menor-preco" }, agora))).toEqual(["a", "b", "c"]);
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
