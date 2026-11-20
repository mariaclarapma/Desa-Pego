import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { PecaResumo } from "@/types/catalogo";
import { ProductCard } from "./ProductCard";

const peca: PecaResumo = {
  id: "teste-1",
  titulo: "Saia midi de linho",
  marca: "vintage",
  categoria: "feminino",
  tamanho: "P",
  condicao: "bom_estado",
  precoCentavos: 6450,
  fotoUrl: "https://images.unsplash.com/photo-teste",
  fotoAlt: "Saia midi de linho cor de vinho",
  vendedor: { nomePublico: "Ana", cidade: "Brasília, DF" },
};

describe("ProductCard", () => {
  it("mostra foto, nome, preço, tamanho e condição", () => {
    render(<ProductCard peca={peca} />);

    expect(screen.getByRole("img", { name: "Saia midi de linho cor de vinho" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Saia midi de linho" })).toBeInTheDocument();
    expect(screen.getByText(/R\$\s64,50/)).toBeInTheDocument();
    expect(screen.getByText("bom estado")).toBeInTheDocument();
    expect(screen.getByText(/Tamanho/).parentElement).toHaveTextContent("P");
    expect(screen.getByText("Brasília, DF · por Ana")).toBeInTheDocument();
  });

  it("leva para a página de detalhes da peça", () => {
    render(<ProductCard peca={peca} />);
    expect(screen.getByRole("link", { name: "Saia midi de linho" })).toHaveAttribute("href", "/peca/teste-1");
  });

  it("alterna o favorito com aria-pressed", async () => {
    const user = userEvent.setup();
    render(<ProductCard peca={peca} />);

    const favorito = screen.getByRole("button", { name: "Favoritar Saia midi de linho" });
    expect(favorito).toHaveAttribute("aria-pressed", "false");

    await user.click(favorito);
    expect(favorito).toHaveAttribute("aria-pressed", "true");

    await user.click(favorito);
    expect(favorito).toHaveAttribute("aria-pressed", "false");
  });
});
