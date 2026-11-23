import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Fotos dos anúncios (Req. 004): o navegador sobe cada foto direto no armazenamento por uma URL
 * pré-assinada, sem passar pela rota do anúncio. A arquitetura prevê o Amazon S3; o grupo ainda não
 * escolheu entre S3 e Supabase Storage. Por isso o armazenamento fica atrás desta interface, e por
 * enquanto só existe a versão local (pasta no servidor), para desenvolvimento e testes.
 *
 * ATENÇÃO: no Render (plano grátis) o disco é apagado a cada deploy. Em produção é preciso um
 * adaptador de S3 ou Supabase Storage com a mesma interface.
 */
export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoFoto = (typeof TIPOS_FOTO)[number];
export const FOTOS_MIN = 1;
export const FOTOS_MAX = 5;

export interface ArmazenamentoFotos {
  /** URL (assinada, com prazo) para o navegador enviar a foto com PUT. */
  gerarUrlUpload(chave: string, tipo: TipoFoto, maxBytes: number): { urlUpload: string; expiraEm: string };
  /** Confere a assinatura e o prazo de um envio. Devolve o tipo e o limite assinados, ou null. */
  validarEnvio(chave: string, parametros: Record<string, unknown>): { tipo: TipoFoto; max: number } | null;
  gravar(chave: string, dados: Buffer): void;
  /** Caminho do arquivo no disco (só o armazenamento local serve o arquivo pela API). */
  caminho(chave: string): string;
  urlPublica(chave: string): string;
  existe(chave: string): boolean;
  remover(chave: string): void;
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

/** Armazenamento numa pasta local, com URL assinada por HMAC e válida por 10 minutos. */
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

  gerarUrlUpload(chave: string, tipo: TipoFoto, maxBytes: number) {
    const exp = this.agora() + 10 * 60_000;
    const params = new URLSearchParams({ tipo, max: String(maxBytes), exp: String(exp), sig: this.assinar(chave, tipo, maxBytes, exp) });
    return { urlUpload: `${this.prefixoPublico}/${chave}?${params}`, expiraEm: new Date(exp).toISOString() };
  }

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

  caminho(chave: string) {
    return resolve(this.pasta, chave);
  }

  urlPublica(chave: string) {
    return `${this.prefixoPublico}/${chave}`;
  }

  existe(chave: string) {
    return CHAVE_FOTO.test(chave) && existsSync(join(this.pasta, chave));
  }

  remover(chave: string) {
    if (CHAVE_FOTO.test(chave)) rmSync(join(this.pasta, chave), { force: true });
  }
}
