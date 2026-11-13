import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./SiteHeader";

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
});
