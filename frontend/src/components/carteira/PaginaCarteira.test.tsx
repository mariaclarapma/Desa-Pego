import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { descricaoDoLancamento, reaisParaCentavos, valorDoLancamento, type Lancamento } from "@/lib/api/carteira";
import { useSessao } from "@/lib/sessao";
import { PaginaCarteira } from "./PaginaCarteira";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

let seq = 0;
const lancamento = (dados: Partial<Lancamento>): Lancamento => ({
  id: `l${++seq}`,
  vendedoraId: "v1",
  pedidoId: "abc123def",
  repasseId: null,
  conta: "vendedora",
  tipo: "venda",
  pendenteCentavos: 0,
  disponivelCentavos: 0,
  criadoEm: "2026-11-20T12:00:00.000Z",
  ...dados,
});

const EXTRATO = [
  lancamento({ tipo: "liberacao", pendenteCentavos: -8881, disponivelCentavos: 8881 }),
  lancamento({ pendenteCentavos: 8881 }),
  lancamento({ conta: "comissao", disponivelCentavos: 1000 }),
  lancamento({ conta: "taxa_pix", disponivelCentavos: 119 }),
];

function backendFalso(podeSacarCentavos = 8881) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/gestao/carteira/repasses" && init?.method === "POST") {
      const { valorCentavos } = JSON.parse(String(init.body));
      if (valorCentavos > podeSacarCentavos) return json({ erro: "o valor do repasse é maior que o saldo disponível." }, 422);
      return json({ id: "r2", vendedoraId: "v1", valorCentavos, status: "SOLICITADO", criadoEm: "2026-11-21T10:00:00.000Z", pagoEm: null }, 201);
    }
    if (url === "/api/gestao/carteira/repasses")
      return json({
        repasses: [{ id: "r1", vendedoraId: "v1", valorCentavos: 2000, status: "PAGO", criadoEm: "2026-11-19T10:00:00.000Z", pagoEm: "2026-11-19T15:00:00.000Z" }],
      });
    if (url === "/api/gestao/carteira") return json({ pendenteCentavos: 0, disponivelCentavos: 8881, emSaqueCentavos: 0, podeSacarCentavos, extrato: EXTRATO });
    return json({ erro: "rota não encontrada." }, 404);
  });
}

beforeEach(() => {
  useSessao.setState({ sessao: { usuario: { id: "v1", nome: "Bia", email: "b@x.com" }, accessToken: "tok", expiraEm: "" } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockClear();
  useSessao.setState({ sessao: null });
});

describe("regras da carteira na tela", () => {
  it("converte o valor digitado em reais para centavos inteiros", () => {
    expect(reaisParaCentavos("50")).toBe(5000);
    expect(reaisParaCentavos("12,5")).toBe(1250);
    expect(reaisParaCentavos("R$ 1.234,56")).toBe(123_456);
    expect(reaisParaCentavos("12.50")).toBe(1250);
    for (const invalido of ["", "abc", "1,234", "-5", "12,"]) expect(reaisParaCentavos(invalido)).toBeNull();
  });

  it("comissão e taxa aparecem como desconto no extrato", () => {
    expect(valorDoLancamento(lancamento({ pendenteCentavos: 900 }))).toBe(900);
    expect(valorDoLancamento(lancamento({ conta: "comissao", disponivelCentavos: 100 }))).toBe(-100);
    expect(valorDoLancamento(lancamento({ conta: "taxa_pix", tipo: "estorno", disponivelCentavos: -10 }))).toBe(10);
  });

  it("descreve cada tipo de lançamento", () => {
    expect(descricaoDoLancamento(lancamento({}))).toMatch(/venda paga do pedido #abc123/);
    expect(descricaoDoLancamento(lancamento({ tipo: "liberacao" }))).toMatch(/entrega confirmada/);
    expect(descricaoDoLancamento(lancamento({ tipo: "estorno" }))).toMatch(/pedido cancelado/);
    expect(descricaoDoLancamento(lancamento({ tipo: "repasse", pedidoId: null }))).toBe("repasse via Pix para você");
    expect(descricaoDoLancamento(lancamento({ conta: "comissao" }))).toMatch(/^comissão da plataforma/);
    expect(descricaoDoLancamento(lancamento({ conta: "comissao", tipo: "estorno" }))).toMatch(/^devolução da comissão/);
    expect(descricaoDoLancamento(lancamento({ conta: "taxa_pix" }))).toMatch(/^taxa do Pix/);
    expect(descricaoDoLancamento(lancamento({ conta: "taxa_pix", tipo: "estorno" }))).toMatch(/^devolução da taxa do Pix/);
  });
});

describe("minha carteira", () => {
  it("sem sessão, manda para o login", async () => {
    useSessao.setState({ sessao: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 401)));
    render(<PaginaCarteira />);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/entrar"));
  });

  it("mostra saldo, saques e o extrato com comissão e taxa separadas", async () => {
    vi.stubGlobal("fetch", backendFalso());
    render(<PaginaCarteira />);
    const saldo = await screen.findByRole("region", { name: "saldo" });
    expect(within(saldo).getAllByText("R$ 88,81")).toHaveLength(2); // disponível e pode sacar
    expect(screen.getByText(/pago em/)).toBeInTheDocument();

    const extrato = screen.getByRole("list", { name: "lançamentos" });
    expect(within(extrato).getAllByRole("listitem")).toHaveLength(4);
    expect(within(extrato).getByText(/comissão da plataforma/)).toBeInTheDocument();
    expect(within(extrato).getByText("− R$ 10,00")).toBeInTheDocument();
    expect(within(extrato).getByText("− R$ 1,19")).toBeInTheDocument();
  });

  it("pede saque dentro do limite e recusa valor acima dele antes de enviar", async () => {
    const user = userEvent.setup();
    const fetchFalso = backendFalso();
    vi.stubGlobal("fetch", fetchFalso);
    render(<PaginaCarteira />);
    const campo = await screen.findByLabelText("valor do saque (R$)");

    await user.type(campo, "100");
    await user.click(screen.getByRole("button", { name: "pedir saque" }));
    expect(await screen.findByText(/passa do que você pode sacar/)).toBeInTheDocument();
    expect(campo).toHaveFocus();
    expect(fetchFalso).not.toHaveBeenCalledWith("/api/gestao/carteira/repasses", expect.objectContaining({ method: "POST" }));

    await user.clear(campo);
    await user.type(campo, "0");
    await user.click(screen.getByRole("button", { name: "pedir saque" }));
    expect(await screen.findByText(/maior que zero/)).toBeInTheDocument();

    await user.clear(campo);
    await user.type(campo, "50,00");
    await user.click(screen.getByRole("button", { name: "pedir saque" }));
    expect(await screen.findByText(/saque de R\$\s50,00 pedido/)).toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledWith(
      "/api/gestao/carteira/repasses",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ valorCentavos: 5000 }) }),
    );
  });

  it("mostra a recusa do backend (o limite de verdade é conferido no servidor)", async () => {
    const user = userEvent.setup();
    const normal = backendFalso();
    // a tela acha que pode sacar R$ 88,81, mas o servidor recusa
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) =>
        init?.method === "POST" ? json({ erro: "o valor do repasse é maior que o saldo disponível." }, 422) : normal(url, init),
      ),
    );
    render(<PaginaCarteira />);
    await user.type(await screen.findByLabelText("valor do saque (R$)"), "80");
    await user.click(screen.getByRole("button", { name: "pedir saque" }));
    expect(await screen.findByText("o valor do repasse é maior que o saldo disponível.")).toBeInTheDocument();
  });

  it("carteira vazia e erro de conexão", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/repasses")
          ? json({ repasses: [] })
          : json({ pendenteCentavos: 0, disponivelCentavos: 0, emSaqueCentavos: 0, podeSacarCentavos: 0, extrato: [] }),
      ),
    );
    const { unmount } = render(<PaginaCarteira />);
    expect(await screen.findByText(/nenhuma movimentação ainda/)).toBeInTheDocument();
    expect(screen.getByText(/ainda não pediu nenhum saque/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pedir saque" })).toBeDisabled();
    unmount();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<PaginaCarteira />);
    expect(await screen.findByText(/não conseguimos falar com o servidor/)).toBeInTheDocument();
  });
});
