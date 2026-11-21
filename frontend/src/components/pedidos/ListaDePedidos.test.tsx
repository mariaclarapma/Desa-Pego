import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acaoDisponivel, formatarEndereco, type PedidoDaConta } from "@/lib/api/meusPedidos";
import { useSessao } from "@/lib/sessao";
import { ListaDePedidos } from "./ListaDePedidos";

const ENDERECO = { cep: "70000-000", logradouro: "Rua das Flores", numero: "10", bairro: "Asa Sul", cidade: "Brasília", uf: "DF" };

const pedido = (dados: Partial<PedidoDaConta> = {}): PedidoDaConta => ({
  id: "abc123def456",
  compradoraId: "c1",
  vendedoraId: "v1",
  itens: [{ id: "p1", titulo: "Jaqueta de couro", precoCentavos: 10000 }],
  subtotalCentavos: 10000,
  freteCentavos: 1990,
  totalCentavos: 11990,
  comissaoCentavos: 1000,
  vendedoraCentavos: 10990,
  status: "PAGO",
  criadoEm: "2026-11-20T12:00:00.000Z",
  atualizadoEm: "2026-11-20T12:00:00.000Z",
  ...dados,
});

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

beforeEach(() => {
  useSessao.setState({ sessao: { usuario: { id: "c1", nome: "Ana", email: "a@x.com" }, accessToken: "tok", expiraEm: "" } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useSessao.setState({ sessao: null });
});

describe("regras da tela (as mesmas do backend)", () => {
  it("cada papel só vê a ação que pode fazer", () => {
    expect(acaoDisponivel("vendedora", "PAGO")).toBe("enviar");
    expect(acaoDisponivel("compradora", "PAGO")).toBeNull();
    expect(acaoDisponivel("compradora", "ENVIADO")).toBe("confirmar");
    expect(acaoDisponivel("vendedora", "ENVIADO")).toBeNull();
    expect(acaoDisponivel("compradora", "AGUARDANDO_PAGAMENTO")).toBe("cancelar");
    for (const status of ["ENTREGUE", "CANCELADO"] as const) {
      expect(acaoDisponivel("compradora", status)).toBeNull();
      expect(acaoDisponivel("vendedora", status)).toBeNull();
    }
  });

  it("formata o endereço em linhas", () => {
    expect(formatarEndereco(ENDERECO)).toEqual(["Rua das Flores, 10", "Asa Sul", "Brasília, DF", "CEP 70000-000"]);
    expect(formatarEndereco(undefined)).toEqual([]);
  });
});

describe("minhas compras", () => {
  it("lista as compras sem endereço e sem o botão de enviar", async () => {
    const fetchFalso = vi.fn(async () => json({ pedidos: [pedido()] }));
    vi.stubGlobal("fetch", fetchFalso);
    render(<ListaDePedidos papel="compradora" />);

    const cartao = await screen.findByRole("article", { name: "pedido #abc123" });
    expect(within(cartao).getByText("Jaqueta de couro")).toBeInTheDocument();
    expect(within(cartao).getByText("R$ 119,90")).toBeInTheDocument();
    expect(within(cartao).queryByText(/enviar para/)).not.toBeInTheDocument();
    expect(within(cartao).queryByText(/você recebe/)).not.toBeInTheDocument();
    expect(within(cartao).queryByRole("button", { name: /enviado/ })).not.toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledWith("/api/gestao/pedidos/compras", expect.objectContaining({ method: "GET" }));
  });

  it("confirmar recebimento pede confirmação, chama o backend e atualiza o cartão", async () => {
    const user = userEvent.setup();
    const fetchFalso = vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === "POST" ? json(pedido({ status: "ENTREGUE" })) : json({ pedidos: [pedido({ status: "ENVIADO" })] }),
    );
    vi.stubGlobal("fetch", fetchFalso);
    render(<ListaDePedidos papel="compradora" />);

    await user.click(await screen.findByRole("button", { name: "confirmar recebimento do pedido #abc123" }));
    expect(screen.getByText(/não dá para desfazer/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "sim, recebi" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "sim, recebi" }));

    expect(await screen.findByText(/recebimento confirmado/)).toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledWith("/api/gestao/pedidos/abc123def456/confirmar-recebimento", expect.objectContaining({ method: "POST" }));
    expect(screen.getAllByText("recebido").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /confirmar recebimento/ })).not.toBeInTheDocument();
  });

  it("voltar desiste da confirmação e devolve o foco ao botão", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => json({ pedidos: [pedido({ status: "ENVIADO" })] })));
    render(<ListaDePedidos papel="compradora" />);
    await user.click(await screen.findByRole("button", { name: /confirmar recebimento/ }));
    await user.click(screen.getByRole("button", { name: "voltar" }));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: /confirmar recebimento/ })).toHaveFocus());
  });

  it("sem compras: mostra o convite para a vitrine", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ pedidos: [] })));
    render(<ListaDePedidos papel="compradora" />);
    expect(await screen.findByText("nada por aqui ainda")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "garimpar na vitrine" })).toBeInTheDocument();
  });

  it("filtrar por status pede a lista filtrada ao backend", async () => {
    const user = userEvent.setup();
    const fetchFalso = vi.fn(async () => json({ pedidos: [] }));
    vi.stubGlobal("fetch", fetchFalso);
    render(<ListaDePedidos papel="compradora" />);
    await screen.findByText("nada por aqui ainda");
    await user.click(screen.getByRole("button", { name: "enviado" }));
    expect(screen.getByRole("button", { name: "enviado" })).toHaveAttribute("aria-pressed", "true");
    await vi.waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith("/api/gestao/pedidos/compras?status=ENVIADO", expect.objectContaining({ method: "GET" })),
    );
  });
});

describe("minhas vendas", () => {
  it("mostra o endereço de entrega, quanto a vendedora recebe e o botão de enviar", async () => {
    const user = userEvent.setup();
    const fetchFalso = vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === "POST" ? json(pedido({ status: "ENVIADO" })) : json({ pedidos: [pedido({ endereco: ENDERECO })] }),
    );
    vi.stubGlobal("fetch", fetchFalso);
    render(<ListaDePedidos papel="vendedora" />);

    const cartao = await screen.findByRole("article", { name: "pedido #abc123" });
    expect(within(cartao).getByText("Rua das Flores, 10")).toBeInTheDocument();
    expect(within(cartao).getByText("R$ 109,90")).toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledWith("/api/gestao/pedidos/vendas", expect.anything());

    await user.click(within(cartao).getByRole("button", { name: "marcar como enviado do pedido #abc123" }));
    await user.click(screen.getByRole("button", { name: "sim, já enviei" }));
    expect(await screen.findByText(/marcado como enviado/)).toBeInTheDocument();
    // o endereço continua na tela depois de mudar o status
    expect(screen.getByText("Rua das Flores, 10")).toBeInTheDocument();
  });

  it("mostra a recusa do backend (ex.: 409) sem quebrar a tela", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === "POST" ? json({ erro: "não dá para passar de ENVIADO para ENVIADO." }, 409) : json({ pedidos: [pedido({ endereco: ENDERECO })] }),
      ),
    );
    render(<ListaDePedidos papel="vendedora" />);
    await user.click(await screen.findByRole("button", { name: /marcar como enviado/ }));
    await user.click(screen.getByRole("button", { name: "sim, já enviei" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("não dá para passar de ENVIADO para ENVIADO.");
  });
});
