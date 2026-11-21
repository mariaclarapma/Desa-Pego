import { CATEGORIAS } from "../../comum/categorias.js";
import { dividirValor } from "../../comum/dinheiro.js";
import type { Pedido } from "./banco.js";
import type { StatusPedido } from "./estados.js";

/**
 * Pedidos FICTÍCIOS para o modo demonstração do dashboard (enquanto não há vendas reais).
 * Nunca são gravados no banco: são gerados na hora, sempre iguais (semente fixa), e a
 * resposta da rota vem marcada com `demonstracao: true` para a tela avisar.
 */

/** Gerador pseudoaleatório com semente (mulberry32): mesmos dados a cada chamada. */
function aleatorio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sortear<T>(r: () => number, opcoes: [T, number][]): T {
  const total = opcoes.reduce((s, [, peso]) => s + peso, 0);
  let x = r() * total;
  for (const [valor, peso] of opcoes) {
    x -= peso;
    if (x < 0) return valor;
  }
  return opcoes[opcoes.length - 1][0];
}

const DESTINOS: [{ uf: string; cidades: string[] }, number][] = [
  [{ uf: "SP", cidades: ["São Paulo", "Campinas", "Santos", "Ribeirão Preto"] }, 30],
  [{ uf: "RJ", cidades: ["Rio de Janeiro", "Niterói", "Petrópolis"] }, 14],
  [{ uf: "MG", cidades: ["Belo Horizonte", "Uberlândia", "Juiz de Fora"] }, 12],
  [{ uf: "DF", cidades: ["Brasília", "Taguatinga", "Águas Claras"] }, 10],
  [{ uf: "PR", cidades: ["Curitiba", "Londrina"] }, 7],
  [{ uf: "RS", cidades: ["Porto Alegre", "Caxias do Sul"] }, 6],
  [{ uf: "BA", cidades: ["Salvador", "Feira de Santana"] }, 5],
  [{ uf: "SC", cidades: ["Florianópolis", "Joinville"] }, 5],
  [{ uf: "PE", cidades: ["Recife", "Olinda"] }, 4],
  [{ uf: "GO", cidades: ["Goiânia", "Anápolis"] }, 4],
  [{ uf: "CE", cidades: ["Fortaleza"] }, 3],
];

/** Faixa de preço (centavos) e peso de cada categoria. */
const CATEGORIA_DEMO: Record<string, { peso: number; faixa: [number, number] }> = {
  feminino: { peso: 34, faixa: [3000, 14_000] },
  masculino: { peso: 16, faixa: [3000, 12_000] },
  calcados: { peso: 20, faixa: [4000, 20_000] },
  bolsas: { peso: 18, faixa: [5000, 28_000] },
  acessorios: { peso: 12, faixa: [1500, 8000] },
};

/** Vendedoras fictícias (nomes inventados). */
export const VENDEDORAS_DEMO = [
  "Ana Ribeiro",
  "Bia Carvalho",
  "Carla Mendes",
  "Duda Farias",
  "Elisa Prado",
  "Fernanda Luz",
  "Gabi Souto",
  "Helô Martins",
  "Iara Campos",
  "Joana Reis",
];

const DIA = 24 * 60 * 60 * 1000;
const MESES = 18;

export function pedidosDemonstracao(agora: number): Pedido[] {
  const r = aleatorio(20261121);
  const pedidos: Pedido[] = [];
  const inicio = agora - MESES * 30 * DIA;
  for (let t = inicio, n = 0; t < agora; t += DIA) {
    // a plataforma cresce com o tempo, com mais vendas no fim do ano e nos fins de semana
    const progresso = (t - inicio) / (agora - inicio);
    const mes = new Date(t).getUTCMonth();
    const semana = new Date(t).getUTCDay();
    const ritmo = 0.4 + 2.2 * progresso + (mes === 10 || mes === 11 ? 0.8 : 0) + (semana === 0 || semana === 6 ? 0.5 : 0);
    const doDia = Math.floor(ritmo + r());
    for (let k = 0; k < doDia; k++, n++) {
      const destino = sortear(r, DESTINOS);
      const quantas = sortear(r, [
        [1, 70],
        [2, 22],
        [3, 8],
      ]);
      const itens = Array.from({ length: quantas }, (_, i) => {
        const categoria = sortear(
          r,
          CATEGORIAS.map((c) => [c.slug, CATEGORIA_DEMO[c.slug].peso] as [string, number]),
        );
        const [min, max] = CATEGORIA_DEMO[categoria].faixa;
        // preços terminados em ,90, como num brechó de verdade
        const preco = Math.round((min + r() * (max - min)) / 1000) * 1000 - 10;
        return { id: `demo-${n}-${i}`, titulo: "peça de demonstração", precoCentavos: preco, categoria };
      });
      const subtotal = itens.reduce((s, i) => s + i.precoCentavos, 0);
      const frete = 1990;
      const total = subtotal + frete;
      const comissao = dividirValor(subtotal, 1000).comissaoCentavos;
      const taxa = dividirValor(total, 99).comissaoCentavos;
      const status: StatusPedido = sortear(r, [
        ["ENTREGUE", 70],
        ["ENVIADO", 10],
        ["PAGO", 8],
        ["CANCELADO", 8],
        ["AGUARDANDO_PAGAMENTO", 4],
      ]);
      const quando = new Date(t + Math.floor(r() * DIA)).toISOString();
      pedidos.push({
        id: `demo-${n}`,
        compradoraId: `demo-compradora-${n % 97}`,
        vendedoraId: `demo-${Math.floor(r() * r() * VENDEDORAS_DEMO.length)}`,
        itens,
        endereco: { uf: destino.uf, cidade: destino.cidades[Math.floor(r() * r() * destino.cidades.length)] },
        subtotalCentavos: subtotal,
        freteCentavos: frete,
        totalCentavos: total,
        comissaoPontosBase: 1000,
        comissaoCentavos: comissao,
        taxaPixPontosBase: 99,
        taxaPixCentavos: taxa,
        vendedoraCentavos: total - comissao - taxa,
        status,
        criadoEm: quando,
        atualizadoEm: quando,
      });
    }
  }
  return pedidos;
}

/** Nome fictício de uma vendedora da demonstração ("demo-3" → "Duda Farias"). */
export const nomeVendedoraDemo = (id: string) => VENDEDORAS_DEMO[Number(id.replace("demo-", ""))];
