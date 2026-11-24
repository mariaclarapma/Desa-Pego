import { CopyObjectCommand, GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArmazenamentoS3, FotoS3Invalida } from "./fotos-s3.js";

vi.mock("@aws-sdk/s3-presigned-post", () => ({ createPresignedPost: vi.fn() }));

const chave = "1b40590a-d80d-4b07-8d1a-25bbfa043023.png";
const limite = 5 * 1024 * 1024;
const send = vi.fn();
const cliente = { send } as unknown as S3Client;
const armazenamento = new ArmazenamentoS3(cliente, "bucket-teste", new URL("https://fotos.example.test/"), () => 0);
const png = [137, 80, 78, 71, 13, 10, 26, 10];

beforeEach(() => vi.resetAllMocks());

function objeto(bytes: number[], tamanho = 100) {
  return {
    ContentRange: `bytes 0-11/${tamanho}`,
    ContentType: "image/png",
    ETag: '"versao-conferida"',
    Body: { transformToByteArray: async () => Uint8Array.from(bytes) },
  };
}

describe("ArmazenamentoS3", () => {
  it("assina POST de até 5 MB com o tipo fixo e sem acesso ao caminho publicado", async () => {
    vi.mocked(createPresignedPost).mockResolvedValue({
      url: "https://upload.example.test",
      fields: { key: `temporarias/${chave}` },
    });

    const envio = await armazenamento.gerarUrlUpload(chave, "image/png", limite);
    expect(createPresignedPost).toHaveBeenCalledWith(cliente, expect.objectContaining({
      Key: `temporarias/${chave}`,
      Expires: 600,
      Conditions: [["eq", "$Content-Type", "image/png"], ["content-length-range", 1, limite]],
    }));
    expect(envio.metodo).toBe("POST");
    expect(armazenamento.urlPublica(chave)).toBe(`https://fotos.example.test/anuncios/${chave}`);
  });

  it("confere a assinatura da imagem e copia só a versão conferida", async () => {
    send.mockResolvedValueOnce(objeto(png)).mockResolvedValueOnce({});
    await armazenamento.confirmarEnvio(chave, "image/png", limite);
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect(send.mock.calls[0][0].input.Range).toBe("bytes=0-11");
    expect(send.mock.calls[1][0]).toBeInstanceOf(CopyObjectCommand);
    expect(send.mock.calls[1][0].input).toMatchObject({
      Key: `anuncios/${chave}`,
      CopySourceIfMatch: '"versao-conferida"',
    });
  });

  it.each([objeto([37, 80, 68, 70]), objeto(png, limite + 1)])(
    "recusa arquivo fora das regras antes de copiar",
    async (foto) => {
      send.mockResolvedValueOnce(foto);
      await expect(armazenamento.confirmarEnvio(chave, "image/png", limite)).rejects.toBeInstanceOf(FotoS3Invalida);
      expect(send).toHaveBeenCalledTimes(1);
    },
  );
});
