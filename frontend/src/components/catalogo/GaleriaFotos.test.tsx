import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { FotoPeca } from "@/types/catalogo";
import { GaleriaFotos } from "./GaleriaFotos";

const fotos: FotoPeca[] = [
  { url: "https://images.unsplash.com/photo-frente", alt: "Jaqueta de couro preta no cabide" },
  { url: "https://images.unsplash.com/photo-ziper", alt: "Detalhe dos zíperes prateados" },
  { url: "/api/fotos/anuncio-gola.jpg", alt: "Detalhe da gola" },
];

describe("GaleriaFotos (Req. 008)", () => {
  it("começa pela primeira foto e mostra uma miniatura por foto", () => {
    render(<GaleriaFotos fotos={fotos} />);

    expect(screen.getByRole("img", { name: "Jaqueta de couro preta no cabide" })).toBeInTheDocument();
    const miniaturas = screen.getAllByRole("button", { name: /^ver foto/ });
    expect(miniaturas).toHaveLength(3);
    expect(miniaturas[0]).toHaveAttribute("aria-pressed", "true");
    expect(miniaturas[0]).toHaveAccessibleName("ver foto 1 de 3: Jaqueta de couro preta no cabide");
  });

  it("clicar numa miniatura troca a foto grande", async () => {
    const user = userEvent.setup();
    render(<GaleriaFotos fotos={fotos} />);

    await user.click(screen.getByRole("button", { name: /ver foto 2 de 3/ }));

    expect(screen.getByRole("img", { name: "Detalhe dos zíperes prateados" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Jaqueta de couro preta no cabide" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ver foto 2 de 3/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("foto 2 de 3: Detalhe dos zíperes prateados")).toBeInTheDocument();
  });

  it("as setas do teclado passam de uma foto para a outra, dando a volta", async () => {
    const user = userEvent.setup();
    render(<GaleriaFotos fotos={fotos} />);

    await user.tab();
    expect(screen.getByRole("button", { name: /ver foto 1 de 3/ })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: /ver foto 3 de 3/ })).toHaveFocus();
    expect(screen.getByRole("img", { name: "Detalhe da gola" })).toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /ver foto 1 de 3/ })).toHaveFocus();
  });

  it("com uma foto só, não mostra miniaturas", () => {
    render(<GaleriaFotos fotos={fotos.slice(0, 1)} />);

    expect(screen.getByRole("img", { name: "Jaqueta de couro preta no cabide" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("peça indisponível: foto em tons de cinza e o adesivo aparece", () => {
    render(<GaleriaFotos fotos={fotos} indisponivel adesivo={<span>vendida</span>} />);

    expect(screen.getByRole("img", { name: "Jaqueta de couro preta no cabide" })).toHaveClass("grayscale");
    expect(screen.getByText("vendida")).toBeInTheDocument();
  });
});
