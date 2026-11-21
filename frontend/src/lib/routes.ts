import type { CategoriaSlug } from "@/types/catalogo";

/**
 * Rotas do frontend num só lugar. Várias ainda não existem (são dos módulos
 * 01 a 05); enquanto isso, o app/not-found.tsx mostra uma página amigável.
 */
export const ROUTES = {
  home: "/",
  catalogo: "/catalogo",
  anunciar: "/anunciar",
  entrar: "/entrar",
  cadastro: "/cadastro",
  recuperarSenha: "/recuperar-senha",
  conta: "/conta",
  minhasCompras: "/conta/compras",
  minhasVendas: "/conta/vendas",
  meusAnuncios: "/conta/anuncios",
  carteira: "/conta/carteira",
  admin: "/admin",
  carrinho: "/carrinho",
  checkout: "/checkout",
  ajuda: "/ajuda",
  contato: "/ajuda/contato",
  sobre: "/sobre",
  termos: "/termos",
  privacidade: "/privacidade",
  comoFunciona: "/#como-funciona",
} as const;

export interface CatalogoParams {
  busca?: string;
  categoria?: CategoriaSlug;
  ordem?: "recentes";
}

/** Monta a URL da vitrine (Req. 007) com busca e filtros como query string. */
export function catalogoUrl(params: CatalogoParams = {}): string {
  const query = new URLSearchParams();
  if (params.busca?.trim()) query.set("busca", params.busca.trim());
  if (params.categoria) query.set("categoria", params.categoria);
  if (params.ordem) query.set("ordem", params.ordem);
  const qs = query.toString();
  return qs ? `${ROUTES.catalogo}?${qs}` : ROUTES.catalogo;
}

/** Acompanhamento do pedido e cobrança Pix (Req. 011). */
export function pedidoUrl(id: string): string {
  return `/pedido/${encodeURIComponent(id)}`;
}

/** Página de detalhes da peça (Req. 008). */
export function pecaUrl(id: string): string {
  return `/peca/${encodeURIComponent(id)}`;
}
