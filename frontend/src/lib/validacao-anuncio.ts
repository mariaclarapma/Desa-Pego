import { validarPreco } from "@desapego/core/pricing";
import { CONDICAO_LABEL } from "./format";
import { reaisParaCentavos } from "./preco";

/** Mesmas regras de backend/catalogo/src/anuncios.ts (o backend valida de novo; aqui é só retorno rápido). */
export const CATEGORIAS_ANUNCIO = ["feminino", "masculino", "calcados", "bolsas", "acessorios"] as const;
export const FOTOS_MIN = 1;
export const FOTOS_MAX = 5;
export const FOTO_MAX_MB = 5;

/** Campos do formulário como a pessoa digita (preço em reais, como texto). */
export interface FormAnuncio {
  titulo: string;
  descricao: string;
  categoria: string;
  tamanho: string;
  marca: string;
  condicao: string;
  preco: string;
}

export type ErrosAnuncio = Partial<Record<keyof FormAnuncio | "fotos", string>>;

/** `fotosProntas` = já enviadas; `fotosPendentes` = ainda subindo ou com falha. */
export function validarAnuncio(f: FormAnuncio, fotosProntas: number, fotosPendentes = 0): ErrosAnuncio {
  const erros: ErrosAnuncio = {};
  if (!f.titulo.trim()) erros.titulo = "informe o título.";
  else if (f.titulo.trim().length > 100) erros.titulo = "o título pode ter no máximo 100 caracteres.";
  if (!f.descricao.trim()) erros.descricao = "conte um pouco sobre a peça.";
  else if (f.descricao.trim().length > 2000) erros.descricao = "a descrição pode ter no máximo 2000 caracteres.";
  if (!(CATEGORIAS_ANUNCIO as readonly string[]).includes(f.categoria)) erros.categoria = "escolha uma categoria.";
  if (!f.tamanho.trim()) erros.tamanho = "informe o tamanho.";
  if (f.marca.trim().length > 60) erros.marca = "a marca pode ter no máximo 60 caracteres.";
  if (!(f.condicao in CONDICAO_LABEL)) erros.condicao = "escolha a condição da peça.";

  const centavos = reaisParaCentavos(f.preco);
  if (!f.preco.trim()) erros.preco = "informe o preço.";
  else if (centavos === null) erros.preco = "use só números, com até 2 casas depois da vírgula. ex.: 89,90";
  else {
    const erro = validarPreco(centavos);
    if (erro) erros.preco = erro;
  }

  if (fotosPendentes > 0) erros.fotos = "espere as fotos terminarem de subir ou remova as que falharam.";
  else if (fotosProntas < FOTOS_MIN) erros.fotos = `envie pelo menos ${FOTOS_MIN} foto.`;
  else if (fotosProntas > FOTOS_MAX) erros.fotos = `envie no máximo ${FOTOS_MAX} fotos.`;
  return erros;
}
