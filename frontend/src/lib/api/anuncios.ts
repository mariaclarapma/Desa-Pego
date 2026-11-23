/**
 * Anúncios da vendedora (Módulo 02, Issue #004), no catálogo: /api/anuncios/* e /api/fotos/*.
 * As rotas exigem o token de acesso (use com useChamadaAutenticada). Publicar exige chave Pix:
 * sem ela o backend responde 403 (Req. 002).
 */
import type { TaxasPlataforma } from "@desapego/core/pricing";
import type { CategoriaSlug, Condicao } from "@/types/catalogo";
import { chamarComToken, ErroApi } from "./autenticado";
import { api } from "./cliente";

export type StatusPeca = "disponivel" | "reservada" | "vendida";

/** O anúncio como a própria vendedora vê. */
export interface Anuncio {
  id: string;
  titulo: string;
  descricao: string;
  categoria: CategoriaSlug;
  tamanho: string;
  marca: string | null;
  condicao: Condicao;
  precoCentavos: number;
  fotos: { chave: string; url: string }[];
  status: StatusPeca;
  pausada: boolean;
  /** Ocultado pela administração (anúncio irregular). */
  oculta: boolean;
  motivoOculta: string | null;
  /** Num pedido esperando o Pix: não pode ser alterado. */
  emPedido: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosAnuncio {
  titulo: string;
  descricao: string;
  categoria: CategoriaSlug;
  tamanho: string;
  marca: string;
  condicao: Condicao;
  precoCentavos: number;
  /** Chaves das fotos já enviadas, na ordem (a primeira é a capa). */
  fotos: string[];
}

export interface FotoPreparada {
  chave: string;
  urlUpload: string;
  url: string;
}

export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoFoto = (typeof TIPOS_FOTO)[number];

const id = (anuncioId: string) => encodeURIComponent(anuncioId);

export const anuncios = {
  meus: (token: string) => chamarComToken<{ anuncios: Anuncio[] }>(token, "GET", "/anuncios/meus").then((r) => r.anuncios),
  ler: (token: string, anuncioId: string) => chamarComToken<Anuncio>(token, "GET", `/anuncios/${id(anuncioId)}`),
  publicar: (token: string, dados: DadosAnuncio) => chamarComToken<Anuncio>(token, "POST", "/anuncios", dados),
  editar: (token: string, anuncioId: string, dados: DadosAnuncio) => chamarComToken<Anuncio>(token, "PUT", `/anuncios/${id(anuncioId)}`, dados),
  pausar: (token: string, anuncioId: string) => chamarComToken<Anuncio>(token, "POST", `/anuncios/${id(anuncioId)}/pausar`),
  reativar: (token: string, anuncioId: string) => chamarComToken<Anuncio>(token, "POST", `/anuncios/${id(anuncioId)}/reativar`),
  /** DELETE responde 204 (sem corpo), por isso não usa chamarComToken, que lê JSON. */
  async excluir(token: string, anuncioId: string): Promise<void> {
    let resposta: Response;
    try {
      resposta = await fetch(`/api/anuncios/${id(anuncioId)}`, { method: "DELETE", cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    } catch {
      throw new ErroApi(0, "não conseguimos falar com o servidor. verifique sua conexão.");
    }
    if (!resposta.ok) {
      const dados = await resposta.json().catch(() => null);
      throw new ErroApi(resposta.status, dados?.erro ?? `erro ${resposta.status}.`);
    }
  },
  /** URLs pré-assinadas para o navegador subir as fotos direto no armazenamento. */
  prepararFotos: (token: string, arquivos: { tipo: TipoFoto; tamanhoBytes: number }[]) =>
    chamarComToken<{ fotos: FotoPreparada[] }>(token, "POST", "/anuncios/fotos", { arquivos }).then((r) => r.fotos),
};

/** Sobe o arquivo pela URL pré-assinada (não leva o token: a assinatura da URL autoriza). */
export async function subirFoto(urlUpload: string, arquivo: File): Promise<void> {
  let resposta: Response;
  try {
    resposta = await fetch(urlUpload, { method: "PUT", headers: { "Content-Type": arquivo.type }, body: arquivo });
  } catch {
    throw new ErroApi(0, "não deu para enviar a foto. verifique sua conexão.");
  }
  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => null);
    throw new ErroApi(resposta.status, dados?.erro ?? "não deu para enviar a foto.");
  }
}

export interface FaixaSugerida {
  categoria: CategoriaSlug;
  condicao: Condicao;
  minimoCentavos: number;
  maximoCentavos: number;
}

/**
 * Regras da plataforma que o admin define (Req. 005 e 014), lidas do serviço de pedidos:
 * comissão, taxa do Pix e tabela de preço sugerido. Rota pública, sem login.
 */
export const regrasPlataforma = () =>
  api<TaxasPlataforma & { precosSugeridos: FaixaSugerida[] }>("/gestao/config");
