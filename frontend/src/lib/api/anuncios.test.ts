import { afterEach, describe, expect, it, vi } from "vitest";
import { subirFoto } from "./anuncios";

const arquivo = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "foto.png", { type: "image/png" });

afterEach(() => vi.unstubAllGlobals());

describe("subirFoto", () => {
  it("manda PUT para a URL assinada, com o arquivo no corpo, o tipo no cabeçalho e sem token", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ Key: "x" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const foto = arquivo();
    const url = "https://projeto.supabase.co/storage/v1/object/upload/sign/anuncios-envios/abc.png?token=t";

    await subirFoto(url, foto);

    expect(fetchFalso).toHaveBeenCalledWith(url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: foto });
  });

  it("mostra a mensagem da API local quando ela recusa", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: "link de envio inválido ou vencido." }), { status: 403 })));
    await expect(subirFoto("/api/fotos/abc.png?sig=x", arquivo())).rejects.toThrow("link de envio inválido ou vencido.");
  });

  it("explica em português quando o Supabase recusa (tipo ou tamanho)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ statusCode: "413", message: "Payload too large" }), { status: 413 })));
    await expect(subirFoto("https://projeto.supabase.co/x", arquivo())).rejects.toThrow("não deu para enviar a foto. confira se é JPG, PNG ou WebP de até 5 MB.");
  });
});
