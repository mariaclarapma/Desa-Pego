import { CHAVE_FOTO, conteudoEhDoTipo, FotoInvalida, TIPOS_FOTO, type ArmazenamentoFotos, type EnvioFoto, type TipoFoto } from "./fotos.js";

/**
 * Fotos no Supabase Storage (plano gratuito: 1 GB de arquivos e 5 GB de tráfego por mês), o mesmo
 * projeto do PostgreSQL das contas. Dois buckets:
 * - `anuncios-envios` (privado): o navegador envia a foto para lá com uma URL de envio assinada
 *   (PUT, só aquele caminho, sem sobrescrever). O bucket só aceita JPG, PNG e WebP de até 5 MB.
 * - `anuncios-fotos` (público): só recebe a foto depois que a API conferiu tamanho, tipo e
 *   primeiros bytes. É dele que a vitrine e o `next/image` leem.
 * A chave secreta do projeto fica só no servidor; o navegador nunca a recebe.
 */
export const BUCKET_ENVIOS = "anuncios-envios";
export const BUCKET_FOTOS = "anuncios-fotos";
/** A URL de envio assinada do Supabase vale 2 horas (prazo fixo do serviço). */
const PRAZO_ENVIO_MS = 2 * 60 * 60_000;

export class ArmazenamentoSupabase implements ArmazenamentoFotos {
  private base: string;

  constructor(
    url: URL,
    private chaveSecreta: string,
    private buscar: typeof fetch = fetch,
    private agora: () => number = Date.now,
  ) {
    if (url.protocol !== "https:" && !/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) throw new Error("SUPABASE_URL precisa ser HTTPS.");
    this.base = `${url.origin}/storage/v1`;
  }

  private chave(chave: string) {
    if (!CHAVE_FOTO.test(chave)) throw new FotoInvalida();
    return chave;
  }

  private chamar(metodo: string, caminho: string, extra: { corpo?: unknown; cabecalhos?: Record<string, string> } = {}) {
    return this.buscar(`${this.base}${caminho}`, {
      method: metodo,
      headers: {
        apikey: this.chaveSecreta,
        Authorization: `Bearer ${this.chaveSecreta}`,
        ...(extra.corpo === undefined ? {} : { "Content-Type": "application/json" }),
        ...extra.cabecalhos,
      },
      body: extra.corpo === undefined ? undefined : JSON.stringify(extra.corpo),
      signal: AbortSignal.timeout(10_000),
    });
  }

  private async falhou(resposta: Response, acao: string): Promise<never> {
    const texto = await resposta.text().catch(() => "");
    throw new Error(`[supabase storage] ${acao}: ${resposta.status} ${texto.slice(0, 200)}`);
  }

  async gerarUrlUpload(chave: string, tipo: TipoFoto): Promise<EnvioFoto> {
    if (!(TIPOS_FOTO as readonly string[]).includes(tipo)) throw new FotoInvalida();
    const caminho = `${BUCKET_ENVIOS}/${this.chave(chave)}`;
    // sem x-upsert: o envio não sobrescreve um arquivo que já está lá
    const resposta = await this.chamar("POST", `/object/upload/sign/${caminho}`);
    if (!resposta.ok) await this.falhou(resposta, "assinar envio");
    const { url } = (await resposta.json()) as { url?: string };
    // só aceita a URL do caminho pedido (nada de endereço vindo de fora)
    if (typeof url !== "string" || !url.startsWith(`/object/upload/sign/${caminho}?token=`)) throw new Error("[supabase storage] URL de envio inesperada.");
    return { urlUpload: `${this.base}${url}`, metodo: "PUT", campos: {}, expiraEm: new Date(this.agora() + PRAZO_ENVIO_MS).toISOString() };
  }

  /**
   * Lê os 12 primeiros bytes do envio e confere tamanho total, tipo gravado e assinatura do formato.
   * Só então copia para o bucket público. O envio não pode ser sobrescrito (a URL assinada não
   * permite), então o arquivo copiado é o mesmo que foi conferido.
   */
  async confirmarEnvio(chave: string, tipo: TipoFoto, maxBytes: number) {
    const k = this.chave(chave);
    const leitura = await this.chamar("GET", `/object/authenticated/${BUCKET_ENVIOS}/${k}`, { cabecalhos: { Range: "bytes=0-11" } });
    // o Storage responde 400 ou 404 quando o arquivo não existe
    if (leitura.status === 400 || leitura.status === 404) throw new FotoInvalida();
    if (!leitura.ok) await this.falhou(leitura, "ler envio");
    const corpo = Buffer.from(await leitura.arrayBuffer());
    const total = leitura.status === 206 ? Number(/\/(\d+)$/.exec(leitura.headers.get("content-range") ?? "")?.[1]) : corpo.length;
    const tipoGravado = (leitura.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!Number.isFinite(total) || total < 1 || total > maxBytes || tipoGravado !== tipo || !conteudoEhDoTipo(corpo.subarray(0, 12), tipo)) {
      throw new FotoInvalida();
    }
    // x-upsert: se uma tentativa anterior já copiou, copiar de novo não falha
    const copia = await this.chamar("POST", "/object/copy", {
      corpo: { bucketId: BUCKET_ENVIOS, sourceKey: k, destinationBucket: BUCKET_FOTOS, destinationKey: k },
      cabecalhos: { "x-upsert": "true" },
    });
    if (copia.status === 400 || copia.status === 404) throw new FotoInvalida();
    if (!copia.ok) await this.falhou(copia, "publicar foto");
  }

  /**
   * Só para a migração (cli-catalogo.ts): grava direto no bucket público um arquivo já conferido
   * (tipo, tamanho e primeiros bytes) que veio do armazenamento antigo. Pode repetir sem erro.
   */
  async publicarArquivo(chave: string, tipo: TipoFoto, dados: Buffer) {
    const resposta = await this.buscar(`${this.base}/object/${BUCKET_FOTOS}/${this.chave(chave)}`, {
      method: "POST",
      headers: { apikey: this.chaveSecreta, Authorization: `Bearer ${this.chaveSecreta}`, "Content-Type": tipo, "x-upsert": "true" },
      body: new Uint8Array(dados),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resposta.ok) await this.falhou(resposta, "migrar foto");
  }

  urlPublica(chave: string) {
    return `${this.base}/object/public/${BUCKET_FOTOS}/${this.chave(chave)}`;
  }

  private async apagar(bucket: string, chave: string) {
    const resposta = await this.chamar("DELETE", `/object/${bucket}`, { corpo: { prefixes: [this.chave(chave)] } });
    if (!resposta.ok) await this.falhou(resposta, "apagar");
  }

  remover(chave: string) {
    return this.apagar(BUCKET_FOTOS, chave);
  }

  descartarEnvio(chave: string) {
    return this.apagar(BUCKET_ENVIOS, chave);
  }
}

/**
 * Liga o Supabase Storage quando `SUPABASE_URL` e `SUPABASE_SECRET_KEY` estão definidos; sem eles,
 * devolve null (fica o armazenamento local). Uma das duas sem a outra é erro de configuração.
 */
export function armazenamentoSupabaseDoAmbiente(env: Record<string, string | undefined>): ArmazenamentoSupabase | null {
  const url = env.SUPABASE_URL?.trim();
  const chave = env.SUPABASE_SECRET_KEY?.trim();
  if (!url && !chave) return null;
  if (!url || !chave) throw new Error("defina SUPABASE_URL e SUPABASE_SECRET_KEY juntos (ou nenhum dos dois).");
  let endereco: URL;
  try {
    endereco = new URL(url);
  } catch {
    throw new Error("SUPABASE_URL inválida.");
  }
  return new ArmazenamentoSupabase(endereco, chave);
}
