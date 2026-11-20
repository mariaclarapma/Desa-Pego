import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencias } from "@/lib/usePreferencias";
import { PADRAO } from "@/lib/preferencias";
import { AplicarPreferencias } from "./AplicarPreferencias";
import { BarraAcessibilidade } from "./BarraAcessibilidade";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  usePreferencias.setState(PADRAO);
  document.documentElement.removeAttribute("data-tema");
});

function montar() {
  return render(
    <>
      <BarraAcessibilidade />
      <AplicarPreferencias />
    </>,
  );
}

describe("BarraAcessibilidade", () => {
  it("mostra os três botões com nomes acessíveis", () => {
    montar();
    expect(screen.getByRole("navigation", { name: "Acessibilidade" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Libras/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /voz alta/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Opções visuais/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("abre o painel visual e fecha com Esc, devolvendo o foco", async () => {
    const user = userEvent.setup();
    montar();
    const botao = screen.getByRole("button", { name: /Opções visuais/ });

    await user.click(botao);
    expect(screen.getByRole("dialog", { name: "opções visuais" })).toBeInTheDocument();
    expect(botao).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it("aplica modo escuro, alto contraste e tamanho da fonte no <html>", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Opções visuais/ }));

    await user.click(screen.getByRole("button", { name: "escuro" }));
    expect(document.documentElement.dataset.tema).toBe("escuro");

    const contraste = screen.getByRole("switch", { name: "alto contraste" });
    await user.click(contraste);
    expect(contraste).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.dataset.tema).toBe("alto-contraste");

    await user.click(screen.getByRole("button", { name: "Aumentar fonte" }));
    expect(screen.getByText("115%")).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--escala-fonte")).toBe("1.15");

    await user.click(screen.getByRole("button", { name: "restaurar o padrão" }));
    expect(document.documentElement.dataset.tema).toBe("claro");
  });

  it("lê a página em voz alta e permite parar", async () => {
    const user = userEvent.setup();
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel, getVoices: () => [] });
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
    render(
      <>
        <main id="conteudo">Peça única. Pague com Pix.</main>
        <BarraAcessibilidade />
      </>,
    );

    const ler = await screen.findByRole("button", { name: /Ler a página/ });
    await user.click(ler);
    expect(speak).toHaveBeenCalledTimes(2);
    const parar = screen.getByRole("button", { name: /Parar a leitura/ });
    expect(parar).toHaveAttribute("aria-pressed", "true");

    await user.click(parar);
    expect(cancel).toHaveBeenCalled();
  });
});
