import { describe, expect, it, vi } from "vitest";
import { aplicarPreferencias, PADRAO, temaAplicado } from "./preferencias";
import { dividirEmFrases } from "./leitor";

describe("temaAplicado", () => {
  it("segue o sistema operacional quando a escolha é 'sistema'", () => {
    expect(temaAplicado(PADRAO, true)).toBe("escuro");
    expect(temaAplicado(PADRAO, false)).toBe("claro");
  });

  it("respeita a escolha manual de claro ou escuro", () => {
    expect(temaAplicado({ ...PADRAO, tema: "claro" }, true)).toBe("claro");
    expect(temaAplicado({ ...PADRAO, tema: "escuro" }, false)).toBe("escuro");
  });

  it("alto contraste vence qualquer tema", () => {
    expect(temaAplicado({ ...PADRAO, tema: "escuro", altoContraste: true }, false)).toBe("alto-contraste");
  });
});

describe("aplicarPreferencias", () => {
  it("grava o tema e a escala da fonte no <html>", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const html = document.createElement("html");
    aplicarPreferencias({ tema: "escuro", altoContraste: false, escalaFonte: 1.3 }, html);
    expect(html.dataset.tema).toBe("escuro");
    expect(html.style.getPropertyValue("--escala-fonte")).toBe("1.3");
    vi.unstubAllGlobals();
  });
});

describe("dividirEmFrases (leitor de voz)", () => {
  it("separa por frase e quebra frases longas demais", () => {
    expect(dividirEmFrases("Olá!   Tudo bem? Peça única.")).toEqual(["Olá!", "Tudo bem?", "Peça única."]);
    expect(dividirEmFrases("a".repeat(450), 200).map((p) => p.length)).toEqual([200, 200, 50]);
    expect(dividirEmFrases("   ")).toEqual([]);
  });
});
