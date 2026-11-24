import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, openSync, readSync, closeSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Fotos dos anúncios (Req. 004): o navegador sobe cada foto direto no armazenamento por uma URL
 * pré-assinada, sem passar pela rota do anúncio. Os adaptadores têm a mesma interface:
 * - ArmazenamentoSupabase (fotos-supabase.ts): produção, Supabase Storage (plano gratuito);
 * - ArmazenamentoLocal (aqui): desenvolvimento e testes, numa pasta do servidor. No Render (plano
 *   grátis) essa pasta é apagada a cada deploy, por isso ele não serve para produção.
 */
export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoFoto = (typeof TIPOS_FOTO)[number];
export const FOTOS_MIN = 1;
export const FOTOS_MAX = 5;

/** Como o navegador envia a foto: PUT com o arquivo no corpo, ou POST de formulário com os campos assinados. */
export interface EnvioFoto {
  urlUpload: string;
  metodo: "PUT" | "POST";
  /** Campos assinados que vão no formulário antes do arquivo (só no POST). */
  campos: Record<string, string>;
  expiraEm: string;
}

export interface ArmazenamentoFotos {
  /** URL pré-assinada (com prazo, tipo fixo e limite de tamanho) para o navegador enviar a foto. */
  gerarUrlUpload(chave: string, tipo: TipoFoto, maxBytes: number): Promise<EnvioFoto>;
  /**
   * Confere a foto que chegou (existe, tamanho dentro do limite e primeiros bytes do tipo declarado)
   * e a deixa pronta para aparecer no anúncio. Lança FotoInvalida se algo não confere.
   * Chame só depois de conferir que a foto é da vendedora.
   */
  confirmarEnvio(chave: string, tipo: TipoFoto, maxBytes: number): Promise<void>;
  /** Endereço público da foto já confirmada. */
  urlPublica(chave: string): string;
  /** Apaga a foto publicada. */
  remover(chave: string): Promise<void>;
  /**
   * Apaga só a cópia que chegou no envio, depois de publicada ou quando o envio foi abandonado
   * (no armazenamento local é o mesmo arquivo da foto publicada, então não faz nada).
   */
  descartarEnvio(chave: string): Promise<void>;
}

/** A foto não chegou ao armazenamento ou não respeita o tipo e o tamanho. */
export class FotoInvalida extends Error {
  constructor(mensagem = "a foto não foi enviada ou tem tamanho ou formato inválido.") {
    super(mensagem);
  }
}

const EXTENSAO: Record<TipoFoto, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const CHAVE_FOTO = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
export const novaChaveFoto = (tipo: TipoFoto) => `${randomUUID()}.${EXTENSAO[tipo]}`;
export const tipoAceito = (tipo: unknown): tipo is TipoFoto => typeof tipo === "string" && (TIPOS_FOTO as readonly string[]).includes(tipo);

/** Confere pelos primeiros bytes (assinatura do formato) se o arquivo é mesmo do tipo declarado. */
export function conteudoEhDoTipo(dados: Buffer, tipo: TipoFoto): boolean {
  if (tipo === "image/jpeg") return dados.length > 3 && dados[0] === 0xff && dados[1] === 0xd8 && dados[2] === 0xff;
  if (tipo === "image/png") return dados.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return dados.subarray(0, 4).toString("ascii") === "RIFF" && dados.subarray(8, 12).toString("ascii") === "WEBP";
}

/**
 * Armazenamento numa pasta local, com URL assinada por HMAC e válida por 10 minutos. O arquivo chega
 * pela própria API (PUT /fotos/:chave, ver rotasFotos), que confere tipo, tamanho e primeiros bytes.
 */
export class ArmazenamentoLocal implements ArmazenamentoFotos {
  constructor(
    private pasta: string,
    /** Endereço visto pelo navegador (o site repassa /api/fotos para o catálogo). */
    private prefixoPublico: string,
    private segredo: Uint8Array,
    private agora: () => number = Date.now,
  ) {
    mkdirSync(pasta, { recursive: true });
  }

  private assinar(chave: string, tipo: string, max: number, exp: number) {
    return createHmac("sha256", this.segredo).update(`${chave}|${tipo}|${max}|${exp}`).digest("base64url");
  }

  async gerarUrlUpload(chave: string, tipo: TipoFoto, maxBytes: number): Promise<EnvioFoto> {
    const exp = this.agora() + 10 * 60_000;
    const params = new URLSearchParams({ tipo, max: String(maxBytes), exp: String(exp), sig: this.assinar(chave, tipo, maxBytes, exp) });
    return { urlUpload: `${this.prefixoPublico}/${chave}?${params}`, metodo: "PUT", campos: {}, expiraEm: new Date(exp).toISOString() };
  }

  /** Confere a assinatura e o prazo de um envio. Devolve o tipo e o limite assinados, ou null. */
  validarEnvio(chave: string, q: Record<string, unknown>) {
    const { tipo, max, exp, sig } = q;
    if (![tipo, max, exp, sig].every((v) => typeof v === "string") || !tipoAceito(tipo)) return null;
    const esperado = Buffer.from(this.assinar(chave, tipo, Number(max), Number(exp)));
    const recebido = Buffer.from(sig as string);
    if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
    if (Number(exp) < this.agora()) return null;
    return { tipo, max: Number(max) };
  }

  gravar(chave: string, dados: Buffer) {
    writeFileSync(join(this.pasta, chave), dados);
  }

  /** Caminho do arquivo no disco (o armazenamento local serve a foto pela API). */
  caminho(chave: string) {
    return resolve(this.pasta, chave);
  }

  async confirmarEnvio(chave: string, tipo: TipoFoto, maxBytes: number) {
    if (!this.existe(chave)) throw new FotoInvalida();
    const arquivo = join(this.pasta, chave);
    const tamanho = statSync(arquivo).size;
    const inicio = Buffer.alloc(12);
    const fd = openSync(arquivo, "r");
    try {
      readSync(fd, inicio, 0, 12, 0);
    } finally {
      closeSync(fd);
    }
    if (tamanho < 1 || tamanho > maxBytes || !conteudoEhDoTipo(inicio, tipo)) throw new FotoInvalida();
  }

  urlPublica(chave: string) {
    return `${this.prefixoPublico}/${chave}`;
  }

  existe(chave: string) {
    return CHAVE_FOTO.test(chave) && existsSync(join(this.pasta, chave));
  }

  async remover(chave: string) {
    if (CHAVE_FOTO.test(chave)) rmSync(join(this.pasta, chave), { force: true });
  }

  async descartarEnvio() {}
}
