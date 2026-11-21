import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Peca } from "@/types/catalogo";
import CatalogoPage from "./page";

const peca = (id: string): Peca => ({
  id,
  titulo: `Peça ${id}`,
  marca: "sem marca",
  categoria: "bolsas",
  tamanho: "único",
  condicao: "otimo_estado",
  precoCentavos: 8990,
  fotoUrl: "https://images.unsplash.com/photo-teste",
  fotoAlt: "foto",
  vendedor: { nomePublico: "Tati", cidade: "Fortaleza, CE" },
  descricao: "",
  medidas: {},
  status: "disponivel",
  reservadaAte: null,
  criadoEm: "2026-11-14T12:00:00.000Z",
});

/** Simula o GET /pecas devolvendo `resposta` e guarda a URL que a página pediu. */
function apiFalsa(resposta: Response | { itens: Peca[]; total: number; pagina: number; porPagina: number }) {
  const fetchFalso = vi.fn().mockResolvedValue(resposta instanceof Response ? resposta : new Response(JSON.stringify(resposta)));
  vi.stubGlobal("fetch", fetchFalso);
  return () => new URL(fetchFalso.mock.calls[0][0], "http://teste");
}

const abrir = async (busca: Record<string, string>) => render(await CatalogoPage({ searchParams: Promise.resolve(busca) }));

afterEach(() => vi.unstubAllGlobals());

describe("vitrine /catalogo", () => {
  it("manda os filtros da URL para a API (reais viram centavos) e mostra o total de todas as páginas", async () => {
    const urlPedida = apiFalsa({ itens: [peca("a"), peca("b")], total: 30, pagina: 2, porPagina: 12 });
    await abrir({ busca: "bolsa", categoria: "bolsas", precoMin: "50", precoMax: "95,90", pagina: "2" });

    expect(Object.fromEntries(urlPedida().searchParams)).toEqual({ busca: "bolsa", categoria: "bolsas", precoMin: "5000", precoMax: "9590", pagina: "2" });
    expect(screen.getByText(/30 peças encontradas/)).toHaveTextContent("página 2 de 3");
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("paginação: anterior e próxima mantêm os filtros e só mudam a página", async () => {
    apiFalsa({ itens: [peca("a")], total: 30, pagina: 2, porPagina: 12 });
    await abrir({ busca: "bolsa", precoMax: "95", pagina: "2" });

    const nav = screen.getByRole("navigation", { name: "Paginação" });
    expect(within(nav).getByRole("link", { name: /anterior/ })).toHaveAttribute("href", "/catalogo?busca=bolsa&precoMax=95");
    expect(within(nav).getByRole("link", { name: /próxima/ })).toHaveAttribute("href", "/catalogo?busca=bolsa&precoMax=95&pagina=3");
    expect(nav).toHaveTextContent("página 2 de 3");
  });

  it("na primeira página não há 'anterior'; na última não há 'próxima'; com uma página só, não há paginação", async () => {
    apiFalsa({ itens: [peca("a")], total: 30, pagina: 1, porPagina: 12 });
    const primeira = await abrir({});
    expect(within(screen.getByRole("navigation", { name: "Paginação" })).queryByRole("link", { name: /anterior/ })).toBeNull();
    primeira.unmount();

    apiFalsa({ itens: [peca("a")], total: 30, pagina: 3, porPagina: 12 });
    const ultima = await abrir({ pagina: "3" });
    expect(within(screen.getByRole("navigation", { name: "Paginação" })).queryByRole("link", { name: /próxima/ })).toBeNull();
    ultima.unmount();

    apiFalsa({ itens: [peca("a")], total: 1, pagina: 1, porPagina: 12 });
    await abrir({});
    expect(screen.queryByRole("navigation", { name: "Paginação" })).toBeNull();
  });

  it("corrige a URL antes de chamar a API: faixa de preço invertida, tamanho e página inválidos", async () => {
    const urlPedida = apiFalsa({ itens: [], total: 0, pagina: 1, porPagina: 12 });
    await abrir({ precoMin: "200", precoMax: "100", tamanho: "XXXL", pagina: "-3", ordem: "aleatoria" });
    expect(Object.fromEntries(urlPedida().searchParams)).toEqual({ precoMin: "10000", precoMax: "20000" });
  });

  it("página além do fim mostra aviso com link para a primeira", async () => {
    apiFalsa({ itens: [], total: 11, pagina: 9, porPagina: 12 });
    await abrir({ categoria: "bolsas", pagina: "9" });
    expect(screen.getByText(/essa página não tem peças/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "voltar para a primeira" })).toHaveAttribute("href", "/catalogo?categoria=bolsas");
  });

  it("se a API falhar, mostra o aviso de API indisponível", async () => {
    apiFalsa(new Response(JSON.stringify({ erro: "x" }), { status: 500 }));
    await abrir({});
    expect(screen.getByRole("heading", { name: "não conseguimos falar com a API" })).toBeInTheDocument();
  });
});
