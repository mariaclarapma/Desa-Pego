import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessao } from "@/lib/sessao";
import AdminPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const usuaria = { id: "1", nome: "Ana Souza", email: "ana@exemplo.com", perfil: "USUARIO" as const };
const ludy = { id: "9", nome: "Ludy Administração", email: "ludy@desapego.test", perfil: "ADMIN_MASTER" as const };
const sessaoDe = (usuario: typeof usuaria | typeof ludy) => ({ usuario, accessToken: "ey.x.y", expiraEm: "" });

const FAIXAS = [
  { categoria: "bolsas", condicao: "otimo_estado", minimoCentavos: 5000, maximoCentavos: 25000 },
  { categoria: "calcados", condicao: "bom_estado", minimoCentavos: 3000, maximoCentavos: 13500 },
];

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

/** Respostas falsas do backend para cada rota do painel. */
function backendFalso() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/gestao/admin/resumo"))
      return json({
        pedidosPorStatus: { PAGO: 2 }, vendas: { quantidade: 2, totalCentavos: 20000, comissaoCentavos: 2000, taxaPixCentavos: 0 },
        repasses: {},
        comissaoPontosBase: 1000,
        taxaPixPontosBase: 0,
      });
    if (url.startsWith("/api/auth/admin/usuarios") && init?.method === "POST") return json({ usuario: { ...usuaria, bloqueada: true } });
    if (url.startsWith("/api/auth/admin/usuarios"))
      return json({ usuarios: [{ ...ludy, bloqueada: false, criado_em: "" }, { ...usuaria, bloqueada: false, criado_em: "" }] });
    if (url.startsWith("/api/admin/pecas")) return json({ pecas: [] });
    if (url.startsWith("/api/gestao/admin/pedidos")) return json({ pedidos: [] });
    if (url.startsWith("/api/gestao/admin/comissao") && init?.method === "PUT") return json(JSON.parse(String(init.body)));
    if (url.startsWith("/api/gestao/admin/comissao")) return json({ comissaoPontosBase: 1000 });
    if (url.startsWith("/api/gestao/admin/repasses")) return json({ repasses: [] });
    if (url.startsWith("/api/gestao/admin/configuracao")) return json({ comissaoPontosBase: 1000, taxaPixPontosBase: 0, precosSugeridos: FAIXAS });
    if (url.startsWith("/api/gestao/admin/taxa-pix")) return json(JSON.parse(String(init!.body)));
    if (url.startsWith("/api/gestao/admin/precos-sugeridos")) return json({ precosSugeridos: JSON.parse(String(init!.body)).faixas });
    if (url.startsWith("/api/admin/frete") && init?.method === "PUT") return json(JSON.parse(String(init.body)));
    if (url.startsWith("/api/admin/frete")) return json({ freteCentavos: 1990 });
    return json({ erro: "rota não encontrada." }, 404);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockClear();
  useSessao.setState({ sessao: null });
});

describe("painel da administração", () => {
  it("quem não é administradora vê acesso restrito (e nada é pedido ao backend)", () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    useSessao.setState({ sessao: sessaoDe(usuaria) });
    render(<AdminPage />);
    expect(screen.getByRole("heading", { name: /acesso restrito/ })).toBeInTheDocument();
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("sem sessão, manda para o login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 401)));
    render(<AdminPage />);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/entrar"));
  });

  it("a administradora master vê as nove seções e a visão geral", async () => {
    vi.stubGlobal("fetch", backendFalso());
    useSessao.setState({ sessao: sessaoDe(ludy) });
    render(<AdminPage />);
    const nav = screen.getByRole("navigation", { name: "Seções do painel" });
    expect(within(nav).getAllByRole("link")).toHaveLength(9);
    for (const titulo of [/visão geral/, /usuárias/, /anúncios/, /^pedidos$/, /comissão da plataforma/, /taxa do Pix/, /frete fixo/, /preço sugerido/, /repasses/]) {
      expect(screen.getByRole("heading", { level: 2, name: titulo })).toBeInTheDocument();
    }
    expect(await screen.findByText("R$ 200,00")).toBeInTheDocument();
  });

  it("bloqueia uma usuária (a master não tem botão de bloqueio)", async () => {
    const user = userEvent.setup();
    const fetchFalso = backendFalso();
    vi.stubGlobal("fetch", fetchFalso);
    useSessao.setState({ sessao: sessaoDe(ludy) });
    render(<AdminPage />);
    await user.click(await screen.findByRole("button", { name: "bloquear Ana Souza" }));
    expect(screen.queryByRole("button", { name: /bloquear Ludy/ })).not.toBeInTheDocument();
    expect(await screen.findByText("Ana Souza foi bloqueada.")).toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledWith("/api/auth/admin/usuarios/1/bloquear", expect.objectContaining({ method: "POST" }));
  });

  it("altera a comissão (texto vira pontos-base) e valida o valor antes de enviar", async () => {
    const user = userEvent.setup();
    const fetchFalso = backendFalso();
    vi.stubGlobal("fetch", fetchFalso);
    useSessao.setState({ sessao: sessaoDe(ludy) });
    render(<AdminPage />);
    const campo = await screen.findByLabelText("nova comissão (%)");
    await vi.waitFor(() => expect(campo).toHaveValue("10,00"));

    await user.clear(campo);
    await user.type(campo, "80");
    await user.click(screen.getByRole("button", { name: "salvar comissão" }));
    expect(await screen.findByText(/entre 0 e 50/)).toBeInTheDocument();

    await user.clear(campo);
    await user.type(campo, "12,5");
    await user.click(screen.getByRole("button", { name: "salvar comissão" }));
    expect(await screen.findByText(/comissão alterada para 12,50%/)).toBeInTheDocument();
    const put = fetchFalso.mock.calls.find((c) => c[1]?.method === "PUT")!;
    expect(JSON.parse(String(put[1]!.body))).toEqual({ comissaoPontosBase: 1250 });
  });

  it("altera a taxa do Pix (até 10%) e o frete (em reais), validando antes de enviar", async () => {
    const user = userEvent.setup();
    const fetchFalso = backendFalso();
    vi.stubGlobal("fetch", fetchFalso);
    useSessao.setState({ sessao: sessaoDe(ludy) });
    render(<AdminPage />);

    const taxa = await screen.findByLabelText("nova taxa do Pix (%)");
    await vi.waitFor(() => expect(taxa).toHaveValue("0,00"));
    await user.clear(taxa);
    await user.type(taxa, "11");
    await user.click(screen.getByRole("button", { name: "salvar taxa" }));
    expect(await screen.findByText(/entre 0 e 10/)).toBeInTheDocument();
    await user.clear(taxa);
    await user.type(taxa, "0,99");
    await user.click(screen.getByRole("button", { name: "salvar taxa" }));
    expect(await screen.findByText(/taxa do Pix alterada para 0,99%/)).toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledWith("/api/gestao/admin/taxa-pix", expect.objectContaining({ method: "PUT", body: JSON.stringify({ taxaPixPontosBase: 99 }) }));

    const frete = screen.getByLabelText("novo frete (R$)");
    await vi.waitFor(() => expect(frete).toHaveValue("19,90"));
    await user.clear(frete);
    await user.type(frete, "250");
    await user.click(screen.getByRole("button", { name: "salvar frete" }));
    expect(await screen.findByText(/entre R\$ 0,00 e R\$ 200,00/)).toBeInTheDocument();
    await user.clear(frete);
    await user.type(frete, "24,50");
    await user.click(screen.getByRole("button", { name: "salvar frete" }));
    expect(await screen.findByText(/frete alterado para R\$\s24,50/)).toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledWith("/api/admin/frete", expect.objectContaining({ method: "PUT", body: JSON.stringify({ freteCentavos: 2450 }) }));
  });

  it("edita a tabela de preço sugerido e recusa mínimo maior que o máximo", async () => {
    const user = userEvent.setup();
    const fetchFalso = backendFalso();
    vi.stubGlobal("fetch", fetchFalso);
    useSessao.setState({ sessao: sessaoDe(ludy) });
    render(<AdminPage />);

    const minimo = await screen.findByLabelText("mínimo de bolsas, ótimo estado");
    await user.clear(minimo);
    await user.type(minimo, "300");
    await user.click(screen.getByRole("button", { name: "salvar tabela" }));
    expect(await screen.findByText(/confira a faixa de bolsas, ótimo estado/)).toBeInTheDocument();
    expect(minimo).toHaveFocus();

    await user.clear(minimo);
    await user.type(minimo, "60");
    await user.click(screen.getByRole("button", { name: "salvar tabela" }));
    expect(await screen.findByText(/tabela de preço sugerido salva/)).toBeInTheDocument();
    const put = fetchFalso.mock.calls.find((c) => String(c[0]).includes("precos-sugeridos"))!;
    expect(JSON.parse(String(put[1]!.body)).faixas[0]).toEqual({ categoria: "bolsas", condicao: "otimo_estado", minimoCentavos: 6000, maximoCentavos: 25000 });
  });
});
