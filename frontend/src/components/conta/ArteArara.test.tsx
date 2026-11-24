import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArteArara } from "./ArteArara";

let quadros: FrameRequestCallback[] = [];

function preferirMenosMovimento(reduzir: boolean) {
  vi.stubGlobal("matchMedia", (consulta: string) => ({ matches: reduzir && consulta.includes("reduce"), media: consulta }));
}

/** Passa o cursor da esquerda para a direita pela arara (o SVG tem 600 px, como o viewBox). */
function passarCursor(area: HTMLElement) {
  area.dispatchEvent(new MouseEvent("pointerenter"));
  for (let i = 0; i < 8; i++) {
    const evento = new MouseEvent("pointermove", { bubbles: true, clientX: 150 + i * 30 });
    Object.defineProperty(evento, "movementX", { value: 30 });
    area.dispatchEvent(evento);
  }
}

/** Roda os quadros de animação pendentes, avançando o relógio 16 ms por quadro. */
function rodarQuadros(vezes: number) {
  let tempo = 1000;
  for (let i = 0; i < vezes && quadros.length; i++) {
    const pendentes = quadros;
    quadros = [];
    tempo += 16;
    pendentes.forEach((cb) => cb(tempo));
  }
}

function montar() {
  const { container } = render(<ArteArara />);
  const area = container.querySelector<HTMLElement>(".arte-arara")!;
  const svg = area.querySelector("svg")!;
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 520, right: 600, bottom: 520, x: 0, y: 0, toJSON: () => ({}) });
  const pecas = [...svg.querySelectorAll<SVGGElement>(":scope > g")].filter((g) => g.style.transformOrigin);
  return { area, pecas };
}

beforeEach(() => {
  quadros = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    quadros.push(cb);
    return quadros.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.spyOn(performance, "now").mockReturnValue(1000);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ArteArara", () => {
  it("é decorativa: fica fora da leitura de tela", () => {
    const { container } = render(<ArteArara />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    container.querySelectorAll(".arte-arara > div").forEach((el) => expect(el).toHaveAttribute("aria-hidden", "true"));
  });

  it("balança as roupas com o cursor, cada uma de um jeito, e volta ao repouso", () => {
    preferirMenosMovimento(false);
    const { area, pecas } = montar();
    expect(pecas).toHaveLength(7);

    passarCursor(area);
    rodarQuadros(10);
    const angulos = pecas.map((g) => Number(g.style.transform.match(/-?[\d.]+/)?.[0] ?? 0));
    expect(angulos.some((a) => a !== 0)).toBe(true);
    expect(new Set(angulos.map((a) => a.toFixed(2))).size).toBeGreaterThan(3);
    angulos.forEach((a) => expect(Math.abs(a)).toBeLessThanOrEqual(7));

    rodarQuadros(2000);
    expect(quadros).toHaveLength(0);
    pecas.forEach((g) => expect(g.style.transform).toBe(""));
  });

  it("não mexe nada com prefers-reduced-motion", () => {
    preferirMenosMovimento(true);
    const { area, pecas } = montar();

    passarCursor(area);
    rodarQuadros(10);
    expect(quadros).toHaveLength(0);
    pecas.forEach((g) => expect(g.style.transform).toBe(""));
  });
});
