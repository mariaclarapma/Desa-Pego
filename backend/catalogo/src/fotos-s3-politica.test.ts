import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { armazenamentoS3DoAmbiente, ArmazenamentoS3 } from "./fotos-s3.js";

/*
 * Sem simular o @aws-sdk/s3-presigned-post: a política do POST é assinada de verdade pela biblioteca
 * da AWS, com credenciais fictícias (a assinatura é calculada localmente, sem rede).
 */

const chave = "1b40590a-d80d-4b07-8d1a-25bbfa043023.webp";
const limite = 5 * 1024 * 1024;
const cliente = new S3Client({ region: "us-east-2", credentials: { accessKeyId: "AKIAEXEMPLOFICTICIO", secretAccessKey: "segredo-ficticio" } });

describe("POST pré-assinado do S3 (política real)", () => {
  it("assina só temporarias/<chave>, com o tipo exato, de 1 byte a 5 MB e por 10 minutos", async () => {
    const s3 = new ArmazenamentoS3(cliente, "desapego-fotos-teste", new URL("https://desapego-fotos-teste.s3.us-east-2.amazonaws.com/"), () => 0);
    const envio = await s3.gerarUrlUpload(chave, "image/webp", limite);

    expect(envio.metodo).toBe("POST");
    expect(new URL(envio.urlUpload).host).toBe("desapego-fotos-teste.s3.us-east-2.amazonaws.com");
    expect(envio.campos).toMatchObject({ key: `temporarias/${chave}`, "Content-Type": "image/webp", "X-Amz-Algorithm": "AWS4-HMAC-SHA256" });
    expect(envio.campos["X-Amz-Signature"]).toMatch(/^[0-9a-f]{64}$/);
    expect(envio.expiraEm).toBe(new Date(600_000).toISOString());

    const politica = JSON.parse(Buffer.from(envio.campos.Policy, "base64").toString("utf8"));
    expect(politica.conditions).toEqual(
      expect.arrayContaining([
        { bucket: "desapego-fotos-teste" },
        { key: `temporarias/${chave}` },
        ["eq", "$Content-Type", "image/webp"],
        ["content-length-range", 1, limite],
      ]),
    );
    // a política vence em até 10 minutos a partir de agora
    const vence = Date.parse(politica.expiration) - Date.now();
    expect(vence).toBeGreaterThan(0);
    expect(vence).toBeLessThanOrEqual(600_000);
  });

  it("não assina chave fora do padrão (nada de caminho escolhido pelo navegador)", async () => {
    const s3 = new ArmazenamentoS3(cliente, "desapego-fotos-teste", new URL("https://fotos.example.test/"));
    await expect(s3.gerarUrlUpload("../anuncios/qualquer.png", "image/png", limite)).rejects.toThrow();
  });

  it("remover apaga só o objeto publicado da foto", async () => {
    const send = vi.fn().mockResolvedValue({});
    const s3 = new ArmazenamentoS3({ send } as unknown as S3Client, "desapego-fotos-teste", new URL("https://fotos.example.test/"));
    await s3.remover(chave);
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect(send.mock.calls[0][0].input).toEqual({ Bucket: "desapego-fotos-teste", Key: `anuncios/${chave}` });
  });
});

describe("armazenamentoS3DoAmbiente", () => {
  it("sem S3_BUCKET, fica no armazenamento local (null)", () => {
    expect(armazenamentoS3DoAmbiente({})).toBeNull();
    expect(armazenamentoS3DoAmbiente({ S3_BUCKET: "  " })).toBeNull();
  });

  it("usa o endereço do bucket por padrão, ou a URL pública (CDN) se houver", () => {
    expect(armazenamentoS3DoAmbiente({ S3_BUCKET: "desapego-fotos", AWS_REGION: "us-east-2" })!.urlPublica(chave)).toBe(
      `https://desapego-fotos.s3.us-east-2.amazonaws.com/anuncios/${chave}`,
    );
    expect(
      armazenamentoS3DoAmbiente({ S3_BUCKET: "desapego-fotos", AWS_REGION: "us-east-2", S3_URL_PUBLICA: "https://fotos.example.test" })!.urlPublica(chave),
    ).toBe(`https://fotos.example.test/anuncios/${chave}`);
  });

  it("recusa configuração incompleta ou insegura", () => {
    expect(() => armazenamentoS3DoAmbiente({ S3_BUCKET: "desapego-fotos" })).toThrow(/AWS_REGION/);
    expect(() => armazenamentoS3DoAmbiente({ S3_BUCKET: "Bucket.Com.Ponto", AWS_REGION: "us-east-2" })).toThrow(/S3_BUCKET/);
    expect(() => armazenamentoS3DoAmbiente({ S3_BUCKET: "desapego-fotos", AWS_REGION: "us-east-2", S3_URL_PUBLICA: "http://fotos.example.test" })).toThrow(/HTTPS/);
  });
});
