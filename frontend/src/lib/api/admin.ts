/**
 * Painel da administração (Módulo 05). Três serviços atrás da mesma origem:
 * - usuárias: serviço de contas (/api/auth/admin/*)
 * - anúncios: catálogo (/api/admin/*)
 * - resumo, pedidos, comissão e repasses: pedidos (/api/gestao/admin/*)
 * Todas as rotas exigem o token da administradora master; quem não é recebe 403 do backend.
 */
import type { CategoriaSlug, Condicao } from "@/types/catalogo";
import { chamarComToken, ErroApi } from "./autenticado";

/** Mesmo erro das outras rotas privadas (status HTTP + mensagem do backend). */
export { ErroApi as AdminErro };

const chamar = chamarComToken;

export type StatusPedido = "AGUARDANDO_PAGAMENTO" | "PAGO" | "ENVIADO" | "ENTREGUE" | "CANCELADO";

export const TEXTO_STATUS: Record<StatusPedido, string> = {
  AGUARDANDO_PAGAMENTO: "aguardando pagamento",
  PAGO: "pago",
  ENVIADO: "enviado",
  ENTREGUE: "recebido",
  CANCELADO: "cancelado",
};

export interface Resumo {
  pedidosPorStatus: Partial<Record<StatusPedido, number>>;
  vendas: { quantidade: number; totalCentavos: number; comissaoCentavos: number; taxaPixCentavos: number };
  repasses: Partial<Record<"SOLICITADO" | "PAGO", { quantidade: number; totalCentavos: number }>>;
  comissaoPontosBase: number;
  taxaPixPontosBase: number;
}

export interface UsuariaAdmin {
  id: string;
  nome: string;
  email: string;
  perfil: "USUARIO" | "ADMIN" | "ADMIN_MASTER";
  bloqueada: boolean;
  criado_em: string;
}

export interface AnuncioAdmin {
  id: string;
  titulo: string;
  categoria: string;
  precoCentavos: number;
  status: string;
  oculta: boolean;
  motivoOculta?: string | null;
  irregular: boolean;
}

export interface PedidoAdmin {
  id: string;
  compradoraId: string;
  vendedoraId: string;
  totalCentavos: number;
  comissaoPontosBase: number;
  comissaoCentavos: number;
  vendedoraCentavos: number;
  status: StatusPedido;
  criadoEm: string;
}

export interface RepasseAdmin {
  id: string;
  vendedoraId: string;
  valorCentavos: number;
  status: "SOLICITADO" | "PAGO";
  criadoEm: string;
  pagoEm: string | null;
}

/** Faixa de preço sugerido para uma categoria e condição (em centavos). */
export interface FaixaPreco {
  categoria: CategoriaSlug;
  condicao: Condicao;
  minimoCentavos: number;
  maximoCentavos: number;
}

export interface ConfiguracaoPlataforma {
  comissaoPontosBase: number;
  taxaPixPontosBase: number;
  precosSugeridos: FaixaPreco[];
}

export type PeriodoDashboard = "30d" | "90d" | "12m" | "tudo";

/** Dashboard de vendas (`GET /gestao/admin/dashboard`). Tudo em centavos. */
export interface DashboardVendas {
  /** true = números FICTÍCIOS do modo demonstração. */
  demonstracao: boolean;
  periodo: PeriodoDashboard;
  granularidade: "dia" | "semana" | "mes";
  totais: {
    pedidos: number;
    pecas: number;
    vendasCentavos: number;
    comissaoCentavos: number;
    taxaPixCentavos: number;
    ticketMedioCentavos: number;
    comissaoPorPecaCentavos: number;
  };
  serie: { inicio: string; pedidos: number; vendasCentavos: number; comissaoCentavos: number }[];
  porUf: { uf: string; pedidos: number; vendasCentavos: number }[];
  cidades: { cidade: string; uf: string; pedidos: number }[];
  porCategoria: { categoria: string; pecas: number; vendasCentavos: number }[];
  vendedoras: { vendedoraId: string; nome?: string; pedidos: number; vendasCentavos: number; recebeCentavos: number }[];
}

export const admin = {
  dashboard: (t: string, periodo: PeriodoDashboard, demonstracao: boolean) =>
    chamar<DashboardVendas>(t, "GET", `/gestao/admin/dashboard?periodo=${periodo}&demo=${demonstracao ? 1 : 0}`),

  resumo: (t: string) => chamar<Resumo>(t, "GET", "/gestao/admin/resumo"),

  usuarias: (t: string, busca = "") =>
    chamar<{ usuarios: UsuariaAdmin[] }>(t, "GET", `/auth/admin/usuarios${busca ? `?busca=${encodeURIComponent(busca)}` : ""}`),
  bloquear: (t: string, id: string, bloquear: boolean) =>
    chamar<{ usuario: UsuariaAdmin }>(t, "POST", `/auth/admin/usuarios/${encodeURIComponent(id)}/${bloquear ? "bloquear" : "desbloquear"}`),

  anuncios: (t: string) => chamar<{ pecas: AnuncioAdmin[] }>(t, "GET", "/admin/pecas"),
  ocultar: (t: string, id: string, ocultar: boolean) =>
    chamar<AnuncioAdmin>(t, "POST", `/admin/pecas/${encodeURIComponent(id)}/${ocultar ? "ocultar" : "reexibir"}`, ocultar ? {} : undefined),

  pedidos: (t: string, status?: StatusPedido) =>
    chamar<{ pedidos: PedidoAdmin[] }>(t, "GET", `/gestao/admin/pedidos${status ? `?status=${status}` : ""}`),

  comissao: (t: string) => chamar<{ comissaoPontosBase: number }>(t, "GET", "/gestao/admin/comissao"),
  definirComissao: (t: string, comissaoPontosBase: number) =>
    chamar<{ comissaoPontosBase: number }>(t, "PUT", "/gestao/admin/comissao", { comissaoPontosBase }),

  configuracao: (t: string) => chamar<ConfiguracaoPlataforma>(t, "GET", "/gestao/admin/configuracao"),
  definirTaxaPix: (t: string, taxaPixPontosBase: number) =>
    chamar<{ taxaPixPontosBase: number }>(t, "PUT", "/gestao/admin/taxa-pix", { taxaPixPontosBase }),
  definirPrecosSugeridos: (t: string, faixas: FaixaPreco[]) =>
    chamar<{ precosSugeridos: FaixaPreco[] }>(t, "PUT", "/gestao/admin/precos-sugeridos", { faixas }),

  /** O frete é cobrado no checkout, então fica no catálogo. */
  frete: (t: string) => chamar<{ freteCentavos: number }>(t, "GET", "/admin/frete"),
  definirFrete: (t: string, freteCentavos: number) => chamar<{ freteCentavos: number }>(t, "PUT", "/admin/frete", { freteCentavos }),

  repasses: (t: string, status?: "SOLICITADO" | "PAGO") =>
    chamar<{ repasses: RepasseAdmin[] }>(t, "GET", `/gestao/admin/repasses${status ? `?status=${status}` : ""}`),
  pagarRepasse: (t: string, id: string) => chamar<RepasseAdmin>(t, "POST", `/gestao/admin/repasses/${encodeURIComponent(id)}/pagar`),
};

/** "12,5" (texto do campo) → 1250 pontos-base. Só aceita até 2 casas decimais. */
export function percentualParaPontosBase(texto: string): number | null {
  const limpo = texto.trim().replace("%", "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(limpo)) return null;
  const [inteiro, fracao = ""] = limpo.split(".");
  return Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"));
}

/** 1250 → "12,50%" */
export const pontosBaseParaTexto = (pb: number) => `${Math.floor(pb / 100)},${String(pb % 100).padStart(2, "0")}%`;
