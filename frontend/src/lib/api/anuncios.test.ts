import { afterEach, describe, expect, it, vi } from "vitest";
import { subirFoto } from "./anuncios";

const arquivo = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "foto.png", { type: "image/png" });

afterEach(() => vi.unstubAllGlobals());

describe("subirFoto", () => {
  it("no S3, manda um POST de formulário com os campos assinados antes do arquivo e sem token", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchFalso);

    await subirFoto(
      {
        urlUpload: "https://desapego-fotos.s3.us-east-2.amazonaws.com/",
        metodo: "POST",
        campos: { key: "temporarias/abc.png", "Content-Type": "image/png", Policy: "cG9saXRpY2E=", "X-Amz-Signature": "assinatura" },
      },
      arquivo(),
    );

    const [url, pedido] = fetchFalso.mock.calls[0];
    expect(url).toBe("https://desapego-fotos.s3.us-east-2.amazonaws.com/");
    expect(pedido.method).toBe("POST");
    expect(pedido.headers).toBeUndefined();
    const formulario = pedido.body as FormData;
    expect([...formulario.keys()]).toEqual(["key", "Content-Type", "Policy", "X-Amz-Signature", "file"]);
    expect(formulario.get("key")).toBe("temporarias/abc.png");
    expect((formulario.get("file") as File).name).toBe("foto.png");
  });

  it("no armazenamento local, manda PUT com o arquivo no corpo e o tipo no cabeçalho", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchFalso);
    const foto = arquivo();

    await subirFoto({ urlUpload: "/api/fotos/abc.png?sig=x", metodo: "PUT", campos: {} }, foto);

    expect(fetchFalso).toHaveBeenCalledWith("/api/fotos/abc.png?sig=x", { method: "PUT", headers: { "Content-Type": "image/png" }, body: foto });
  });

  it("explica o erro quando o S3 recusa (resposta em XML)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<Error><Code>EntityTooLarge</Code></Error>", { status: 400 })));
    await expect(subirFoto({ urlUpload: "https://bucket.example.test/", metodo: "POST", campos: {} }, arquivo())).rejects.toThrow(
      "não deu para enviar a foto. confira se é JPG, PNG ou WebP de até 5 MB.",
    );
  });
});
