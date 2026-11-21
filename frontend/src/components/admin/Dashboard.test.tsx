import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardVendas } from "@/lib/api/admin";
import { useSessao } from "@/lib/sessao";
import { DashboardVendasPainel } from "./Dashboard";

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

const base = (dados: Partial<DashboardVendas> = {}): DashboardVendas => ({
  demonstracao: false,
  periodo: "12m",
  granularidade: "mes",
  totais: { pedidos: 0, pecas: 0, vendasCentavos: 0, comissaoCentavos: 0, taxaPixCentavos: 0, ticketMedioCentavos: 0, comissaoPorPecaCentavos: 0 },
  serie: [],
  porUf: [],
  cidades: [],
  porCategoria: [],
  vendedoras: [],
  ...dados,
});

const COM_VENDAS = base({
  totais: { pedidos: 3, pecas: 4, vendasCentavos: 45_000, comissaoCentavos: 4000, taxaPixCentavos: 450, ticketMedioCentavos: 15_000, comissaoPorPecaCentavos: 1000 },
  serie: [
    { inicio: "2026-10-01", pedidos: 1, vendasCentavos: 15_000, comissaoCentavos: 1500 },
    { inicio: "2026-11-01", pedidos: 2, vendasCentavos: 30_000, comissaoCentavos: 2500 },
  ],
  porUf: [
    { uf: "SP", pedidos: 2, vendasCentavos: 30_000 },
    { uf: "DF", pedidos: 1, vendasCentavos: 15_000 },
  ],
  cidades: [{ cidade: "São Paulo", uf: "SP", pedidos: 2 }],
  porCategoria: [
    { categoria: "bolsas", pecas: 2, vendasCentavos: 25_000 },
    { categoria: "sem-categoria", pecas: 2, vendasCentavos: 16_000 },
  ],
  vendedoras: [{ vendedoraId: "v-real-1", pedidos: 3, vendasCentavos: 45_000, recebeCentavos: 40_550 }],
});

function backend(real: DashboardVendas) {
  return vi.fn(async (url: string) => {
    if (url.startsWith("/api/gestao/admin/dashboard"))
      return json(url.includes("demo=1") ? { ...COM_VENDAS, demonstracao: true, vendedoras: [{ ...COM_VENDAS.vendedoras[0], nome: "Ana Ribeiro" }] } : real);
    if (url.startsWith("/api/auth/admin/usuarios"))
      return json({ usuarios: [{ id: "v-real-1", nome: "Bia Vendedora", email: "b@x.com", perfil: "USUARIO", bloqueada: false, criado_em: "" }] });
    return json({ erro: "rota não encontrada." }, 404);
  });
}

const chamar = (<T,>(op: (t: string) => Promise<T>) => op("tok")) as Parameters<typeof DashboardVendasPainel>[0]["chamar"];

beforeEach(() => useSessao.setState({ sessao: null }));
afterEach(() => vi.unstubAllGlobals());

describe("painel de vendas", () => {
  it("sem vendas reais, mostra a demonstração com aviso de dados fictícios", async () => {
    const fetchFalso = backend(base());
    vi.stubGlobal("fetch", fetchFalso);
    render(<DashboardVendasPainel chamar={chamar} />);

    expect(await screen.findByText("dados fictícios")).toBeInTheDocument();
    expect(screen.getByText(/ainda não há vendas reais/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ver dados reais" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Ana Ribeiro")).toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledWith("/api/gestao/admin/dashboard?periodo=12m&demo=0", expect.anything());
    expect(fetchFalso).toHaveBeenCalledWith("/api/gestao/admin/dashboard?periodo=12m&demo=1", expect.anything());
  });

  it("com vendas reais: números, gráficos, ranking, nomes das vendedoras e sem aviso", async () => {
    vi.stubGlobal("fetch", backend(COM_VENDAS));
    render(<DashboardVendasPainel chamar={chamar} />);

    await screen.findByText("Bia Vendedora");
    const numeros = within(screen.getByText("3 pedidos · 4 peças").parentElement!);
    expect(numeros.getByText("R$ 450,00")).toBeInTheDocument();
    expect(numeros.getByText("3 pedidos · 4 peças")).toBeInTheDocument();
    expect(screen.queryByText("dados fictícios")).not.toBeInTheDocument();
    const ticket = screen.getByText("ticket médio").parentElement!;
    expect(within(ticket).getByText("R$ 150,00")).toBeInTheDocument();

    const estados = screen.getByRole("list", { name: "para onde vão as peças" });
    expect(within(estados).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("SP"),
      expect.stringContaining("DF"),
    ]);
    const categorias = screen.getByRole("list", { name: "o que mais vende" });
    expect(within(categorias).getByText("bolsas")).toBeInTheDocument();
    expect(within(categorias).getByText("sem categoria")).toBeInTheDocument();
    expect(await screen.findByText("Bia Vendedora")).toBeInTheDocument();
    expect(screen.getByText(/São Paulo/)).toBeInTheDocument();
  });

  it("tooltip no hover e no foco de cada coluna, e a mesma informação na tabela", async () => {
    vi.stubGlobal("fetch", backend(COM_VENDAS));
    render(<DashboardVendasPainel chamar={chamar} />);

    const coluna = await screen.findByRole("img", { name: /^nov de 2026: R\$\s300,00, 2 pedidos$/ });
    fireEvent.pointerEnter(coluna);
    expect(screen.getByRole("tooltip")).toHaveTextContent(/R\$\s300,00nov de 2026/);
    fireEvent.pointerLeave(coluna);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(screen.getByRole("img", { name: /^out de 2026: R\$\s150,00, 1 pedido$/ }));
    expect(screen.getByRole("tooltip")).toHaveTextContent(/R\$\s150,00/);

    const [tabela] = screen.getAllByRole("table", { name: "vendas" });
    expect(within(tabela).getByText("nov de 2026")).toBeInTheDocument();
  });

  it("trocar o período e alternar para a demonstração busca de novo no servidor", async () => {
    const user = userEvent.setup();
    const fetchFalso = backend(COM_VENDAS);
    vi.stubGlobal("fetch", fetchFalso);
    render(<DashboardVendasPainel chamar={chamar} />);
    await screen.findByText("ticket médio");

    await user.selectOptions(screen.getByLabelText("período"), "30d");
    await vi.waitFor(() => expect(fetchFalso).toHaveBeenCalledWith("/api/gestao/admin/dashboard?periodo=30d&demo=0", expect.anything()));

    await user.click(screen.getByRole("button", { name: "ver demonstração" }));
    expect(await screen.findByText("dados fictícios")).toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledWith("/api/gestao/admin/dashboard?periodo=30d&demo=1", expect.anything());
  });

  it("erro do servidor aparece na tela", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ erro: "acesso restrito à administração." }, 403)));
    render(<DashboardVendasPainel chamar={chamar} />);
    expect(await screen.findByText("acesso restrito à administração.")).toBeInTheDocument();
  });
});
