import type { Pedido } from "./banco.js";

/**
 * Dashboard de vendas do painel do admin. Conta só pedidos pagos, enviados ou entregues
 * (cancelados e aguardando pagamento não são venda). Tudo em centavos inteiros.
 */
export const PERIODOS = ["30d", "90d", "12m", "tudo"] as const;
export type Periodo = (typeof PERIODOS)[number];
export type Granularidade = "dia" | "semana" | "mes";

export interface PontoSerie {
  /** Início do intervalo (AAAA-MM-DD). */
  inicio: string;
  pedidos: number;
  vendasCentavos: number;
  comissaoCentavos: number;
}

export interface Dashboard {
  /** true = números FICTÍCIOS do modo demonstração (nada disso aconteceu). */
  demonstracao: boolean;
  periodo: Periodo;
  granularidade: Granularidade;
  totais: {
    pedidos: number;
    pecas: number;
    vendasCentavos: number;
    comissaoCentavos: number;
    taxaPixCentavos: number;
    ticketMedioCentavos: number;
    comissaoPorPecaCentavos: number;
  };
  serie: PontoSerie[];
  porUf: { uf: string; pedidos: number; vendasCentavos: number }[];
  cidades: { cidade: string; uf: string; pedidos: number }[];
  porCategoria: { categoria: string; pecas: number; vendasCentavos: number }[];
  /** `nome` só vem na demonstração; com dados reais o painel busca o nome pela lista de usuárias. */
  vendedoras: { vendedoraId: string; nome?: string; pedidos: number; vendasCentavos: number; recebeCentavos: number }[];
}

const VENDA = new Set(["PAGO", "ENVIADO", "ENTREGUE"]);
const DIA = 24 * 60 * 60 * 1000;
/** No período "tudo", a série mostra no máximo os últimos 24 meses. */
const MESES_MAXIMOS = 24;

const dataIso = (d: Date) => d.toISOString().slice(0, 10);
const inicioDoDia = (t: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
/** Segunda-feira da semana (UTC). */
const inicioDaSemana = (t: number) => {
  const dia = inicioDoDia(t);
  return dia - ((new Date(dia).getUTCDay() + 6) % 7) * DIA;
};
const inicioDoMes = (t: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};
const proximoMes = (t: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
};

/** Divisão inteira arredondada (meio centavo sobe), sem float acumulado. */
const media = (total: number, n: number) => (n === 0 ? 0 : Math.round(total / n));

/** Agrupa e soma, devolvendo do maior para o menor pelo critério dado. */
function ranking<T extends Record<string, unknown>>(itens: Map<string, T>, ordem: (t: T) => number) {
  return [...itens.values()].sort((a, b) => ordem(b) - ordem(a));
}

export function montarDashboard(pedidos: Pedido[], periodo: Periodo, agora: number): Dashboard {
  const fim = inicioDoDia(agora) + DIA;
  const granularidade: Granularidade = periodo === "30d" ? "dia" : periodo === "90d" ? "semana" : "mes";

  let desde: number;
  if (periodo === "30d") desde = fim - 30 * DIA;
  else if (periodo === "90d") desde = inicioDaSemana(fim - 90 * DIA);
  else if (periodo === "12m") desde = Date.UTC(new Date(agora).getUTCFullYear(), new Date(agora).getUTCMonth() - 11, 1);
  else {
    const primeira = Math.min(...pedidos.map((p) => new Date(p.criadoEm).getTime()), agora);
    const limite = Date.UTC(new Date(agora).getUTCFullYear(), new Date(agora).getUTCMonth() - (MESES_MAXIMOS - 1), 1);
    desde = Math.max(inicioDoMes(primeira), limite);
  }

  const vendas = pedidos.filter((p) => {
    const t = new Date(p.criadoEm).getTime();
    return VENDA.has(p.status) && t >= desde && t < fim;
  });

  // série com todos os intervalos, inclusive os sem venda (zero), para o eixo não pular datas
  const chave = granularidade === "dia" ? inicioDoDia : granularidade === "semana" ? inicioDaSemana : inicioDoMes;
  const passo = (t: number) => (granularidade === "dia" ? t + DIA : granularidade === "semana" ? t + 7 * DIA : proximoMes(t));
  const serie = new Map<number, PontoSerie>();
  for (let t = chave(desde); t < fim; t = passo(t)) {
    serie.set(t, { inicio: dataIso(new Date(t)), pedidos: 0, vendasCentavos: 0, comissaoCentavos: 0 });
  }

  const porUf = new Map<string, { uf: string; pedidos: number; vendasCentavos: number }>();
  const cidades = new Map<string, { cidade: string; uf: string; pedidos: number }>();
  const categorias = new Map<string, { categoria: string; pecas: number; vendasCentavos: number }>();
  const vendedoras = new Map<string, { vendedoraId: string; pedidos: number; vendasCentavos: number; recebeCentavos: number }>();
  const totais = { pedidos: 0, pecas: 0, vendasCentavos: 0, comissaoCentavos: 0, taxaPixCentavos: 0 };

  for (const p of vendas) {
    totais.pedidos += 1;
    totais.pecas += p.itens.length;
    totais.vendasCentavos += p.totalCentavos;
    totais.comissaoCentavos += p.comissaoCentavos;
    totais.taxaPixCentavos += p.taxaPixCentavos;

    const ponto = serie.get(chave(new Date(p.criadoEm).getTime()));
    if (ponto) {
      ponto.pedidos += 1;
      ponto.vendasCentavos += p.totalCentavos;
      ponto.comissaoCentavos += p.comissaoCentavos;
    }

    const uf = (p.endereco.uf ?? "").trim().toUpperCase() || "—";
    const linhaUf = porUf.get(uf) ?? { uf, pedidos: 0, vendasCentavos: 0 };
    linhaUf.pedidos += 1;
    linhaUf.vendasCentavos += p.totalCentavos;
    porUf.set(uf, linhaUf);

    const cidade = (p.endereco.cidade ?? "").trim();
    if (cidade) {
      const k = `${cidade.toLowerCase()}/${uf}`;
      const linha = cidades.get(k) ?? { cidade, uf, pedidos: 0 };
      linha.pedidos += 1;
      cidades.set(k, linha);
    }

    for (const item of p.itens) {
      const categoria = item.categoria ?? "sem-categoria";
      const linha = categorias.get(categoria) ?? { categoria, pecas: 0, vendasCentavos: 0 };
      linha.pecas += 1;
      linha.vendasCentavos += item.precoCentavos;
      categorias.set(categoria, linha);
    }

    const v = vendedoras.get(p.vendedoraId) ?? { vendedoraId: p.vendedoraId, pedidos: 0, vendasCentavos: 0, recebeCentavos: 0 };
    v.pedidos += 1;
    v.vendasCentavos += p.totalCentavos;
    v.recebeCentavos += p.vendedoraCentavos;
    vendedoras.set(p.vendedoraId, v);
  }

  return {
    demonstracao: false,
    periodo,
    granularidade,
    totais: {
      ...totais,
      ticketMedioCentavos: media(totais.vendasCentavos, totais.pedidos),
      comissaoPorPecaCentavos: media(totais.comissaoCentavos, totais.pecas),
    },
    serie: [...serie.values()],
    porUf: ranking(porUf, (l) => l.vendasCentavos),
    cidades: ranking(cidades, (l) => l.pedidos).slice(0, 10),
    porCategoria: ranking(categorias, (l) => l.vendasCentavos),
    vendedoras: ranking(vendedoras, (l) => l.vendasCentavos).slice(0, 5),
  };
}
