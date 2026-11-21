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

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

/** Respostas falsas do backend para cada rota do painel. */
function backendFalso() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/gestao/admin/resumo"))
      return json({ pedidosPorStatus: { PAGO: 2 }, vendas: { quantidade: 2, totalCentavos: 20000, comissaoCentavos: 2000 }, repasses: {}, comissaoPontosBase: 1000 });
    if (url.startsWith("/api/auth/admin/usuarios") && init?.method === "POST") return json({ usuario: { ...usuaria, bloqueada: true } });
    if (url.startsWith("/api/auth/admin/usuarios"))
      return json({ usuarios: [{ ...ludy, bloqueada: false, criado_em: "" }, { ...usuaria, bloqueada: false, criado_em: "" }] });
    if (url.startsWith("/api/admin/pecas")) return json({ pecas: [] });
    if (url.startsWith("/api/gestao/admin/pedidos")) return json({ pedidos: [] });
    if (url.startsWith("/api/gestao/admin/comissao") && init?.method === "PUT") return json(JSON.parse(String(init.body)));
    if (url.startsWith("/api/gestao/admin/comissao")) return json({ comissaoPontosBase: 1000 });
    if (url.startsWith("/api/gestao/admin/repasses")) return json({ repasses: [] });
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

  it("a administradora master vê as seis seções e a visão geral", async () => {
    vi.stubGlobal("fetch", backendFalso());
    useSessao.setState({ sessao: sessaoDe(ludy) });
    render(<AdminPage />);
    const nav = screen.getByRole("navigation", { name: "Seções do painel" });
    expect(within(nav).getAllByRole("link")).toHaveLength(6);
    for (const titulo of [/visão geral/, /usuárias/, /anúncios/, /^pedidos$/, /comissão da plataforma/, /repasses/]) {
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
});
