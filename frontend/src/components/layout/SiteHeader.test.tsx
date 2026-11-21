import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessao } from "@/lib/sessao";
import { SiteHeader } from "./SiteHeader";

const lucy = { id: "9", nome: "Lucy Administração", email: "lucy@desapego.test", perfil: "ADMIN_MASTER" as const };

afterEach(() => {
  vi.unstubAllGlobals();
  useSessao.setState({ sessao: null });
});

describe("SiteHeader", () => {
  it("tem o logotipo escrito exatamente como desaPego", () => {
    render(<SiteHeader />);
    const logos = screen.getAllByRole("link", { name: "desaPego, página inicial" });
    expect(logos[0]).toHaveTextContent(/^desaPego$/);
    expect(logos[0]).toHaveAttribute("href", "/");
  });

  it("busca envia GET para a vitrine com o parâmetro busca", () => {
    render(<SiteHeader />);
    const [busca] = screen.getAllByRole("search");
    expect(busca).toHaveAttribute("action", "/catalogo");
    expect(busca).toHaveAttribute("method", "get");
    expect(within(busca).getByLabelText("Buscar peças")).toHaveAttribute("name", "busca");
  });

  it("destaca o botão de anunciar e dá acesso à conta e à sacola", () => {
    render(<SiteHeader />);
    const atalhos = screen.getByRole("navigation", { name: "Atalhos da conta" });
    expect(within(atalhos).getByRole("link", { name: /anunciar/ })).toHaveAttribute("href", "/anunciar");
    expect(within(atalhos).getByRole("link", { name: "Minha conta" })).toHaveAttribute("href", "/conta");
    expect(within(atalhos).getByRole("link", { name: "Sacola de compras" })).toHaveAttribute("href", "/carrinho");
  });

  it("lista as categorias com links filtrados", () => {
    render(<SiteHeader />);
    const [categorias] = screen.getAllByRole("navigation", { name: "Categorias" });
    expect(within(categorias).getByRole("link", { name: "calçados" })).toHaveAttribute(
      "href",
      "/catalogo?categoria=calcados",
    );
  });

  it("abre e fecha o menu mobile", async () => {
    const user = userEvent.setup();
    const { container } = render(<SiteHeader />);
    const menu = container.querySelector("dialog") as HTMLDialogElement;
    expect(menu).toHaveAttribute("aria-label", "Menu");
    expect(menu).not.toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(menu).toHaveAttribute("open");

    await user.click(within(menu).getByRole("button", { name: "Fechar menu" }));
    expect(menu).not.toHaveAttribute("open");
  });

  it("sem sessão: menu oferece entrar e não mostra sair nem o painel", () => {
    render(<SiteHeader />);
    expect(screen.queryByRole("button", { name: /^sair/ })).not.toBeInTheDocument();
    const menu = screen.getByRole("navigation", { name: "Conta e ajuda", hidden: true });
    expect(within(menu).getByRole("link", { name: "entrar ou criar conta", hidden: true })).toHaveAttribute("href", "/entrar");
    expect(within(menu).queryByRole("link", { name: "painel da administração", hidden: true })).not.toBeInTheDocument();
  });

  it("com sessão: sair encerra a sessão no servidor e volta para a tela de entrar", async () => {
    const user = userEvent.setup();
    const fetchFalso = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const assign = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    vi.stubGlobal("location", { ...window.location, assign });
    useSessao.setState({ sessao: { usuario: lucy, accessToken: "tok", expiraEm: "" } });
    render(<SiteHeader />);

    const menu = screen.getByRole("navigation", { name: "Conta e ajuda", hidden: true });
    expect(within(menu).getByText("Lucy Administração")).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "minha conta", hidden: true })).toHaveAttribute("href", "/conta");
    expect(within(menu).getByRole("link", { name: "painel da administração", hidden: true })).toHaveAttribute("href", "/admin");

    const atalhos = screen.getByRole("navigation", { name: "Atalhos da conta" });
    await user.click(within(atalhos).getByRole("button", { name: "sair" }));
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("/entrar"));
    expect(fetchFalso).toHaveBeenCalledWith(expect.stringContaining("/auth/logout"), expect.objectContaining({ method: "POST" }));
    expect(useSessao.getState().sessao).toBeNull();
  });
});
