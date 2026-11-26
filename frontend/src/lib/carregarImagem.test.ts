import { describe, expect, it } from "vitest";
import carregarImagem from "./carregarImagem";

const params = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe("carregarImagem", () => {
  it("Unsplash: pede a largura e a qualidade certas direto na CDN", () => {
    const url = carregarImagem({ src: "https://images.unsplash.com/photo-123?auto=format&fit=crop&w=800&q=80", width: 384, quality: 70 });
    expect(url.startsWith("https://images.unsplash.com/photo-123?")).toBe(true);
    expect(params(url)).toMatchObject({ auto: "format", fit: "crop", w: "384", q: "70" });
  });

  it("Unsplash sem qualidade pedida usa 75", () => {
    expect(params(carregarImagem({ src: "https://images.unsplash.com/photo-123?w=800", width: 640 }))).toMatchObject({ w: "640", q: "75", auto: "format" });
  });

  it("Unsplash com corte retrato mantém a proporção (800x1000 → 256x320) e o ponto de foco", () => {
    const src = "https://images.unsplash.com/photo-1?auto=format&fit=crop&w=800&h=1000&q=80&crop=focalpoint&fp-x=0.4&fp-y=0.4&fp-z=2";
    expect(params(carregarImagem({ src, width: 256 }))).toMatchObject({ w: "256", h: "320", crop: "focalpoint", "fp-x": "0.4", "fp-z": "2" });
  });

  it("fotos dos anúncios e outros endereços vão como estão", () => {
    const supabase = "https://abc.supabase.co/storage/v1/object/public/anuncios-fotos/x.webp";
    expect(carregarImagem({ src: supabase, width: 640 })).toBe(supabase);
    expect(carregarImagem({ src: "/api/fotos/9653f69b.jpg", width: 640 })).toBe("/api/fotos/9653f69b.jpg");
    expect(carregarImagem({ src: "http://images.unsplash.com/photo-1?w=800", width: 640 })).toBe("http://images.unsplash.com/photo-1?w=800");
  });
});
