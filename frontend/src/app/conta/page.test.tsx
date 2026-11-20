import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessao } from "@/lib/sessao";
import ContaPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const sessao = { usuario: { id: "1", nome: "Ana Souza", email: "ana@exemplo.com" }, accessToken: "ey.x.y", expiraEm: "" };

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockClear();
  useSessao.setState({ sessao: null });
});

describe("página da conta", () => {
  it("recupera a sessão pelo cookie e mostra os dados", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify(sessao), { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    render(<ContaPage />);

    expect(await screen.findByText("ana@exemplo.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /olá, Ana/ })).toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledWith("/api/auth/refresh", expect.objectContaining({ method: "POST" }));
  });

  it("sem sessão válida, manda para o login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    render(<ContaPage />);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/entrar"));
  });

  it("sair encerra a sessão no backend e volta para o login", async () => {
    const user = userEvent.setup();
    useSessao.setState({ sessao });
    const fetchFalso = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchFalso);
    render(<ContaPage />);

    await user.click(screen.getByRole("button", { name: "sair da conta" }));
    expect(fetchFalso).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
    expect(useSessao.getState().sessao).toBeNull();
    expect(replace).toHaveBeenCalledWith("/entrar");
  });
});
