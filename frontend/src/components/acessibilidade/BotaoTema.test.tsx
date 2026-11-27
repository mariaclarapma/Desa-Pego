import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PADRAO } from "@/lib/preferencias";
import { usePreferencias } from "@/lib/usePreferencias";
import { AplicarPreferencias } from "./AplicarPreferencias";
import { BotaoTema } from "./BotaoTema";

function sistema(escuro: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: escuro, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

/** Mesma ordem do layout: o cabeçalho (com o botão) vem antes de AplicarPreferencias. */
const montar = () =>
  render(
    <>
      <BotaoTema />
      <AplicarPreferencias />
    </>,
  );

const tema = () => document.documentElement.dataset.tema;

beforeEach(() => {
  sistema(false);
  usePreferencias.setState(PADRAO);
  document.documentElement.removeAttribute("data-tema");
});

describe("BotaoTema", () => {
  it("alterna a cada clique, sem ficar preso no mesmo tema", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: "Ativar modo escuro" }));
    expect(tema()).toBe("escuro");
    await user.click(screen.getByRole("button", { name: "Ativar modo claro" }));
    expect(tema()).toBe("claro");
    await user.click(screen.getByRole("button", { name: "Ativar modo escuro" }));
    expect(tema()).toBe("escuro");
  });

  it("com o sistema escuro, o primeiro clique leva para o claro", async () => {
    sistema(true);
    const user = userEvent.setup();
    montar();

    expect(tema()).toBe("escuro");
    await user.click(screen.getByRole("button", { name: "Ativar modo claro" }));
    expect(tema()).toBe("claro");
    expect(screen.getByRole("button", { name: "Ativar modo escuro" })).toBeInTheDocument();
  });

  it("com alto contraste, fica desativado e explica por quê", () => {
    usePreferencias.setState({ ...PADRAO, altoContraste: true });
    montar();
    expect(screen.getByRole("button", { name: /bloqueado pelo alto contraste/ })).toBeDisabled();
  });
});
