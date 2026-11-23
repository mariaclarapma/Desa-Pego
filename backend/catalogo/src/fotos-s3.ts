import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { CHAVE_FOTO, conteudoEhDoTipo, FotoInvalida, type ArmazenamentoFotos, type EnvioFoto, type TipoFoto } from "./fotos.js";

const EXPIRACAO_SEGUNDOS = 600;

export class FotoS3Invalida extends FotoInvalida {}

/**
 * Envia para temporarias/ e só copia para anuncios/ depois da conferência.
 * A CDN deve expor apenas anuncios/. Configure expiração de temporarias/ no bucket.
 */
export class ArmazenamentoS3 implements ArmazenamentoFotos {
  constructor(
    private readonly cliente: S3Client,
    private readonly bucket: string,
    private readonly basePublica: URL,
    private readonly agora: () => number = Date.now,
  ) {
    if (basePublica.protocol !== "https:" || basePublica.username || basePublica.password || basePublica.search || basePublica.hash) {
      throw new Error("a base pública das fotos precisa ser uma URL HTTPS sem credenciais, consulta ou fragmento.");
    }
  }

  private chaveObjeto(prefixo: "temporarias" | "anuncios", chave: string) {
    if (!CHAVE_FOTO.test(chave)) throw new FotoS3Invalida();
    return `${prefixo}/${chave}`;
  }

  async gerarUrlUpload(chave: string, tipo: TipoFoto, maxBytes: number): Promise<EnvioFoto> {
    const key = this.chaveObjeto("temporarias", chave);
    const { url, fields } = await createPresignedPost(this.cliente, {
      Bucket: this.bucket,
      Key: key,
      Expires: EXPIRACAO_SEGUNDOS,
      Fields: { "Content-Type": tipo },
      Conditions: [["eq", "$Content-Type", tipo], ["content-length-range", 1, maxBytes]],
    });
    return {
      urlUpload: url,
      metodo: "POST" as const,
      campos: fields,
      expiraEm: new Date(this.agora() + EXPIRACAO_SEGUNDOS * 1000).toISOString(),
    };
  }

  /** A chamada precisa acontecer depois da validação de titularidade na loja. */
  async confirmarEnvio(chave: string, tipo: TipoFoto, maxBytes: number): Promise<void> {
    const temporaria = this.chaveObjeto("temporarias", chave);
    const publicada = this.chaveObjeto("anuncios", chave);
    try {
      const foto = await this.cliente.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: temporaria,
        Range: "bytes=0-11",
      }));
      const total = foto.ContentRange?.match(/^bytes 0-\d+\/(\d+)$/)?.[1];
      const tamanho = Number(total);
      const bytes = foto.Body ? Buffer.from(await foto.Body.transformToByteArray()) : Buffer.alloc(0);
      if (
        !foto.ETag || foto.ContentType !== tipo || !Number.isSafeInteger(tamanho) ||
        tamanho < 1 || tamanho > maxBytes || !conteudoEhDoTipo(bytes, tipo)
      ) {
        throw new FotoS3Invalida();
      }

      // O arquivo conferido precisa ser o mesmo que será copiado, mesmo se houver outro POST nesse intervalo.
      await this.cliente.send(new CopyObjectCommand({
        Bucket: this.bucket,
        Key: publicada,
        CopySource: `${encodeURIComponent(this.bucket)}/${temporaria}`,
        CopySourceIfMatch: foto.ETag,
      }));
    } catch (erro) {
      if (erro instanceof S3ServiceException && [404, 412, 416].includes(erro.$metadata.httpStatusCode ?? 0)) {
        throw new FotoS3Invalida();
      }
      throw erro;
    }
  }

  urlPublica(chave: string) {
    return `${this.basePublica.href.replace(/\/$/, "")}/${this.chaveObjeto("anuncios", chave)}`;
  }

  async remover(chave: string): Promise<void> {
    await this.cliente.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.chaveObjeto("anuncios", chave) }));
  }
}

const BUCKET = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const REGIAO = /^[a-z]{2}(-[a-z]+)+-\d$/;

/**
 * Monta o adaptador S3 a partir das variáveis de ambiente, ou devolve null se S3_BUCKET estiver vazio
 * (aí o catálogo usa o armazenamento local). As credenciais vêm da cadeia padrão da AWS
 * (AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY no Render). Veja docs/FOTOS.md.
 */
export function armazenamentoS3DoAmbiente(env: Record<string, string | undefined>): ArmazenamentoS3 | null {
  const bucket = env.S3_BUCKET?.trim();
  if (!bucket) return null;
  const regiao = env.AWS_REGION?.trim() ?? "";
  // sem pontos no nome: com pontos, o endereço https://<bucket>.s3... não bate com o certificado
  if (!BUCKET.test(bucket)) throw new Error("S3_BUCKET inválido: use só letras minúsculas, números e hífen.");
  if (!REGIAO.test(regiao)) throw new Error("AWS_REGION inválida ou vazia (ex.: us-east-2).");
  const base = new URL(env.S3_URL_PUBLICA?.trim() || `https://${bucket}.s3.${regiao}.amazonaws.com/`);
  return new ArmazenamentoS3(new S3Client({ region: regiao }), bucket, base);
}
