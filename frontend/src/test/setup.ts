import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement, type ImgHTMLAttributes } from "react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// next/image vira um <img> simples nos testes (sem otimizador).
vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const imgProps = { ...props };
    delete imgProps.fill;
    delete imgProps.priority;
    return createElement("img", imgProps);
  },
}));

// jsdom ainda não implementa <dialog>.showModal()/close().
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}

// No Node 25+ o localStorage global do Node pode esconder o do jsdom: garante um em memória.
if (typeof globalThis.localStorage?.setItem !== "function") {
  const dados = new Map<string, string>();
  const armazenamento: Storage = {
    get length() {
      return dados.size;
    },
    clear: () => dados.clear(),
    getItem: (k) => dados.get(k) ?? null,
    key: (i) => [...dados.keys()][i] ?? null,
    removeItem: (k) => void dados.delete(k),
    setItem: (k, v) => void dados.set(k, String(v)),
  };
  Object.defineProperty(globalThis, "localStorage", { value: armazenamento, configurable: true });
  Object.defineProperty(window, "localStorage", { value: armazenamento, configurable: true });
}
