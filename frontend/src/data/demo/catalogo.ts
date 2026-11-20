/**
 * ⚠️ DADOS DE DEMONSTRAÇÃO — não representam anúncios reais.
 *
 * Servem só para visualizar a Home enquanto a API do catálogo (Módulo 03,
 * Req. 007) não existe. Quando ela estiver pronta, troque `listarAchadinhos()`
 * por uma chamada à API mantendo a mesma assinatura (PecaResumo[]).
 */
import type { Categoria, PecaResumo } from "@/types/catalogo";
import { unsplash } from "./imagens";

export const CATEGORIAS: Categoria[] = [
  {
    slug: "feminino",
    nome: "feminino",
    chamada: "vestidos, saias e tudo que gira",
    fotoUrl: unsplash("1581044777550-4cfa60707c03", 700),
    fotoAlt: "Mulher com blusa rosa de babados e mangas bufantes num campo dourado",
  },
  {
    slug: "masculino",
    nome: "masculino",
    chamada: "básicos com história",
    fotoUrl: unsplash("1516826957135-700dedea698c", 700),
    fotoAlt: "Homem de moletom rosa claro e jeans rasgado encostado numa caçamba",
  },
  {
    slug: "calcados",
    nome: "calçados",
    chamada: "pra pisar em outro rolê",
    fotoUrl: unsplash("1515886657613-9f3515b0c78f", 700),
    fotoAlt: "Mulher de conjunto de moletom amarelo e bota branca numa quadra ao ar livre",
  },
  {
    slug: "bolsas",
    nome: "bolsas",
    chamada: "cabe o mundo (e o batom)",
    fotoUrl: unsplash("1539109136881-3be0616acf4b", 700),
    fotoAlt: "Mulher de casaco azul com bolsa rosa a tiracolo diante de uma catedral",
  },
  {
    slug: "acessorios",
    nome: "acessórios",
    chamada: "o detalhe que faz o look",
    fotoUrl: unsplash("1611591437281-460bfbe1220a", 700),
    fotoAlt: "Pulseira dourada trabalhada sobre fundo rosa",
  },
];

const PECAS_DEMO: PecaResumo[] = [
  {
    id: "demo-jaqueta-couro",
    titulo: "Jaqueta de couro preta",
    marca: "vintage anos 90",
    categoria: "feminino",
    tamanho: "M",
    condicao: "otimo_estado",
    precoCentavos: 18990,
    fotoUrl: unsplash("1551028719-00167b16eac5", 800),
    fotoAlt: "Jaqueta de couro preta com zíperes num cabide sobre lençol branco",
    vendedor: { nomePublico: "Bia", cidade: "Brasília, DF" },
  },
  {
    id: "demo-bolsa-cereja",
    titulo: "Bolsa de mão vermelho-cereja",
    marca: "sem marca",
    categoria: "bolsas",
    tamanho: "único",
    condicao: "nova_com_etiqueta",
    precoCentavos: 14900,
    fotoUrl: unsplash("1584917865442-de89df76afd3", 800),
    fotoAlt: "Bolsa de mão vermelha estruturada com fecho prateado",
    vendedor: { nomePublico: "Lu", cidade: "São Paulo, SP" },
  },
  {
    id: "demo-scarpin-floral",
    titulo: "Scarpin floral bico fino",
    marca: "ateliê local",
    categoria: "calcados",
    tamanho: "36",
    condicao: "otimo_estado",
    precoCentavos: 12990,
    fotoUrl: unsplash("1543163521-1bf539c55dd2", 800),
    fotoAlt: "Par de scarpins com estampa floral azul e vermelha sobre fundo azul claro",
    vendedor: { nomePublico: "Mari", cidade: "Belo Horizonte, MG" },
  },
  {
    id: "demo-bomber-caramelo",
    titulo: "Jaqueta bomber caramelo",
    marca: "sem marca",
    categoria: "masculino",
    tamanho: "G",
    condicao: "bom_estado",
    precoCentavos: 9990,
    fotoUrl: unsplash("1591047139829-d91aecb6caea", 800),
    fotoAlt: "Jaqueta bomber cor caramelo pendurada num cabide",
    vendedor: { nomePublico: "Rafa", cidade: "Recife, PE" },
  },
  {
    id: "demo-bolsa-palha",
    titulo: "Bolsa de palha com alça",
    marca: "feito à mão",
    categoria: "bolsas",
    tamanho: "único",
    condicao: "otimo_estado",
    precoCentavos: 8990,
    fotoUrl: unsplash("1590874103328-eac38a683ce7", 800),
    fotoAlt: "Bolsa de palha trançada com tampa e alça de couro laranja",
    vendedor: { nomePublico: "Helô", cidade: "Salvador, BA" },
  },
  {
    id: "demo-jogger-cetim",
    titulo: "Calça jogger de cetim rosé",
    marca: "sem marca",
    categoria: "feminino",
    tamanho: "P",
    condicao: "nova_com_etiqueta",
    precoCentavos: 7990,
    fotoUrl: unsplash("1594633312681-425c7b97ccd1", 800),
    fotoAlt: "Calça jogger rosé de cetim com bolsos, usada com sandália de salto",
    vendedor: { nomePublico: "Nina", cidade: "Curitiba, PR" },
  },
  {
    id: "demo-poncho-trico",
    titulo: "Poncho de tricô com franjas",
    marca: "feito à mão",
    categoria: "feminino",
    tamanho: "único",
    condicao: "com_marcas_de_uso",
    precoCentavos: 5990,
    fotoUrl: unsplash("1434389677669-e08b4cac3105", 800),
    fotoAlt: "Poncho de tricô cru com franjas pendurado num cabide",
    vendedor: { nomePublico: "Clara", cidade: "Porto Alegre, RS" },
  },
  {
    id: "demo-vestido-floral",
    titulo: "Vestido midi floral vermelho",
    marca: "vintage",
    categoria: "feminino",
    tamanho: "M",
    condicao: "otimo_estado",
    precoCentavos: 11990,
    fotoUrl: unsplash("1572804013309-59a88b7e92f1", 800),
    fotoAlt: "Mulher sorrindo com vestido midi vermelho estampado e cinto sobre fundo amarelo",
    vendedor: { nomePublico: "Livia", cidade: "Rio de Janeiro, RJ" },
  },
  {
    id: "demo-bolsa-rosa",
    titulo: "Bolsa rosa com corrente",
    marca: "sem marca",
    categoria: "bolsas",
    tamanho: "único",
    condicao: "otimo_estado",
    precoCentavos: 9490,
    fotoUrl: unsplash("1566150905458-1bf1fc113f0d", 800),
    fotoAlt: "Bolsa rosa com faixas amarela e branca e alça de corrente",
    vendedor: { nomePublico: "Duda", cidade: "Goiânia, GO" },
  },
  {
    id: "demo-tenis-pastel",
    titulo: "Tênis colorido em tons pastel",
    marca: "sem marca",
    categoria: "calcados",
    tamanho: "37",
    condicao: "bom_estado",
    precoCentavos: 13900,
    fotoUrl: unsplash("1595950653106-6c9ebd614d3a", 800),
    fotoAlt: "Tênis em tons pastel de rosa, lilás e azul",
    vendedor: { nomePublico: "Gabi", cidade: "Florianópolis, SC" },
  },
  {
    id: "demo-oculos-redondo",
    titulo: "Óculos de sol redondo dourado",
    marca: "vintage",
    categoria: "acessorios",
    tamanho: "único",
    condicao: "nova_com_etiqueta",
    precoCentavos: 6990,
    fotoUrl: unsplash("1511499767150-a48a237f0083", 800),
    fotoAlt: "Óculos de sol redondo com armação dourada e lentes escuras",
    vendedor: { nomePublico: "Tati", cidade: "Fortaleza, CE" },
  },
];

/** Peças da vitrine da Home. Mantém a forma de uma chamada assíncrona à API. */
export async function listarAchadinhos(limite = 8): Promise<PecaResumo[]> {
  return PECAS_DEMO.slice(0, limite);
}

const IDS_HERO = ["demo-jaqueta-couro", "demo-bolsa-rosa", "demo-tenis-pastel", "demo-oculos-redondo"];

/** Peças em destaque na colagem do hero (só peças, sem modelos). */
export async function listarDestaquesHero(): Promise<PecaResumo[]> {
  return IDS_HERO.map((id) => PECAS_DEMO.find((p) => p.id === id)).filter((p): p is PecaResumo => Boolean(p));
}

export interface Garimpo {
  numero: string;
  titulo: string;
  legenda: string;
  busca: string;
  fotoUrl: string;
  fotoAlt: string;
}

/** Curadoria editorial ("garimpos da semana"). Cada item abre uma busca na vitrine. */
export const GARIMPOS_DA_SEMANA: Garimpo[] = [
  {
    numero: "01",
    titulo: "vermelho cereja",
    legenda: "a cor que não pede licença",
    busca: "vermelho",
    fotoUrl: unsplash("1595777457583-95e059d581b8", 900),
    fotoAlt: "Mulher girando com vestido longo vermelho num jardim",
  },
  {
    numero: "02",
    titulo: "y2k de volta",
    legenda: "óculos de coração e muita atitude",
    busca: "y2k",
    fotoUrl: unsplash("1529139574466-a303027c1d8b", 700),
    fotoAlt: "Garota loira com óculos em formato de coração e blusa vermelha",
  },
  {
    numero: "03",
    titulo: "pantalona listrada",
    legenda: "cintura alta, perna longa",
    busca: "pantalona",
    fotoUrl: unsplash("1509631179647-0177331693ae", 700),
    fotoAlt: "Mulher com calça pantalona listrada posando diante de parede verde-água",
  },
  {
    numero: "04",
    titulo: "óculos redondinhos",
    legenda: "o acessório que muda o look inteiro",
    busca: "óculos",
    fotoUrl: unsplash("1469334031218-e382a71b716b", 1200),
    fotoAlt: "Garota de óculos redondos e top verde de renda diante de uma parede amarela",
  },
];
