import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

async function renderHome() {
  render(await HomePage());
}

describe("Home", () => {
  it("renderiza todas as seções na ordem", async () => {
    await renderHome();
    const titulos = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("seu próximo achadinho está aqui.");
    expect(titulos).toEqual([
      "garimpa do seu jeito",
      "achadinhos pra chamar de seus",
      "tem peça parada no armário? vira dinheiro.",
      "moda que circula, gente que se encontra",
      "garimpos da semana",
    ]);
  });

  it("hero leva a explorar peças e a anunciar", async () => {
    await renderHome();
    expect(screen.getByRole("link", { name: "explorar peças" })).toHaveAttribute("href", "/catalogo");
    expect(screen.getByRole("link", { name: "anunciar minhas peças" })).toHaveAttribute("href", "/anunciar");
  });

  it("hero mostra só peças, cada uma levando para a sua página com o preço", async () => {
    await renderHome();
    const hero = screen.getByRole("region", { name: /^seu próximo achadinho está aqui/ });
    const pecas = within(hero).getAllByRole("link", { name: /R\$/ });
    expect(pecas).toHaveLength(4);
    expect(pecas[0]).toHaveAttribute("href", "/peca/demo-jaqueta-couro");
    expect(pecas[0]).toHaveAccessibleName(/Jaqueta de couro preta, R\$\s189,90/);
  });

  it("mostra as cinco categorias", async () => {
    await renderHome();
    const secao = screen.getByRole("region", { name: "garimpa do seu jeito" });
    expect(within(secao).getAllByRole("listitem")).toHaveLength(5);
  });

  it("vitrine mostra 8 peças com preço", async () => {
    await renderHome();
    const vitrine = screen.getByRole("region", { name: "achadinhos pra chamar de seus" });
    expect(within(vitrine).getAllByRole("article")).toHaveLength(8);
    expect(within(vitrine).getAllByText(/^Preço:/)).toHaveLength(8);
  });

  it("explica o passo a passo para vender e chama para desapegar", async () => {
    await renderHome();
    const secao = screen.getByRole("region", { name: /tem peça parada/ });
    const passos = within(secao).getAllByRole("listitem");
    expect(passos.map((p) => within(p).getByRole("heading").textContent)).toEqual([
      "Passo 1: fotografa sua peça",
      "Passo 2: cadastra o anúncio",
      "Passo 3: recebe quando vender",
    ]);
    expect(within(secao).getByRole("link", { name: "quero desapegar" })).toHaveAttribute("href", "/anunciar");
  });

  it("todas as imagens têm texto alternativo definido", async () => {
    await renderHome();
    for (const img of document.querySelectorAll("img")) {
      expect(img).toHaveAttribute("alt");
    }
  });
});
