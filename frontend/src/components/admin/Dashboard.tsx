"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AvisoConta } from "@/components/conta/AvisoConta";
import { buttonClasses } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
import { CATEGORIAS } from "@/data/demo/catalogo";
import { admin, type DashboardVendas, type PeriodoDashboard } from "@/lib/api/admin";
import { formatarPreco } from "@/lib/format";
import type { ChamadaAutenticada } from "@/lib/useChamadaAutenticada";

/**
 * Painel de vendas da administração: quanto se vendeu, quanto a plataforma ganhou, para onde
 * vão as peças, o que mais vende e quem mais vende. Os números vêm do servidor (só a
 * administradora master). Sem vendas reais, mostra a DEMONSTRAÇÃO com dados fictícios,
 * sempre com o aviso na tela.
 */

const PERIODOS: [PeriodoDashboard, string][] = [
  ["30d", "últimos 30 dias"],
  ["90d", "últimos 3 meses"],
  ["12m", "últimos 12 meses"],
  ["tudo", "tudo"],
];

const ROTULO = "text-xs font-bold tracking-[0.18em] text-violeta uppercase";
const SUBTITULO = "font-display text-xl font-medium tracking-[-0.01em] text-roxo";
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const compacto = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
/** Eixo: "R$ 0", "R$ 500", "R$ 2 mil" (um estilo só por eixo). */
const eixoReais = (centavos: number) => (centavos >= 100_000 ? compacto.format(centavos / 100) : formatarPreco(centavos).replace(",00", ""));

const nomeCategoria = (slug: string) => (slug === "sem-categoria" ? "sem categoria" : (CATEGORIAS.find((c) => c.slug === slug)?.nome ?? slug));

function rotulosDoPonto(inicio: string, granularidade: DashboardVendas["granularidade"]) {
  const [ano, mes, dia] = inicio.split("-").map(Number);
  if (granularidade === "mes") return { curto: `${MESES[mes - 1]}/${String(ano).slice(2)}`, completo: `${MESES[mes - 1]} de ${ano}` };
  const dm = `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
  return { curto: dm, completo: granularidade === "semana" ? `semana de ${dm}/${ano}` : `${dm}/${ano}` };
}

/** Topo do eixo arredondado (1, 2, 2,5 ou 5 × 10ⁿ) e 4 divisões. */
function escala(maximo: number) {
  if (maximo <= 0) return { topo: 10_000, ticks: [0, 2500, 5000, 7500, 10_000] };
  const bruto = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto)!;
  return { topo: passo * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * passo) };
}

export interface PontoColuna {
  curto: string;
  completo: string;
  valor: number;
  detalhe?: string;
}

/** Largura real do contêiner: o SVG é desenhado nela, para o texto dos eixos não encolher no celular. */
function useLargura(padrao: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(padrao);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(([e]) => setLargura(Math.max(280, Math.round(e.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, largura };
}

/** Colunas de uma série só (sem legenda: o título diz o que é). Tooltip no hover e no foco. */
export function GraficoColunas({ titulo, descricao, pontos }: { titulo: string; descricao: string; pontos: PontoColuna[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const { ref, largura: L } = useLargura(480);
  const A = 220;
  const m = { topo: 12, dir: 8, base: 28, esq: 64 };
  const larguraPlot = L - m.esq - m.dir;
  const alturaPlot = A - m.topo - m.base;
  const { topo, ticks } = escala(Math.max(...pontos.map((p) => p.valor), 0));
  const faixa = larguraPlot / Math.max(pontos.length, 1);
  const barra = Math.min(24, faixa * 0.62);
  const y = (v: number) => m.topo + alturaPlot - (v / topo) * alturaPlot;
  // rótulos do eixo X que cabem sem encostar (~56px cada)
  const cada = Math.max(1, Math.ceil(pontos.length / Math.max(1, Math.floor(larguraPlot / 56))));

  return (
    <figure className="min-w-0">
      <figcaption>
        <h3 className={SUBTITULO}>{titulo}</h3>
        <p className="text-sm text-roxo-soft">{descricao}</p>
      </figcaption>
      <div ref={ref} className="relative mt-3">
        <svg viewBox={`0 0 ${L} ${A}`} width={L} height={A} className="block h-auto w-full overflow-visible" role="group" aria-label={titulo}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.esq} x2={L - m.dir} y1={y(t)} y2={y(t)} stroke="var(--color-grafico-grade)" strokeWidth={1} />
              <text x={m.esq - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={12} fill="var(--color-roxo-soft)">
                {eixoReais(t)}
              </text>
            </g>
          ))}
          {pontos.map((p, i) => {
            const cx = m.esq + faixa * i + faixa / 2;
            const h = Math.max(0, (p.valor / topo) * alturaPlot);
            const base = m.topo + alturaPlot;
            const r = Math.min(4, h, barra / 2);
            const x0 = cx - barra / 2;
            // canto arredondado só na ponta do dado; reto na base
            const d =
              h <= 0
                ? ""
                : `M${x0},${base} V${base - h + r} Q${x0},${base - h} ${x0 + r},${base - h} H${x0 + barra - r} Q${x0 + barra},${base - h} ${x0 + barra},${base - h + r} V${base} Z`;
            return (
              <g key={p.completo}>
                {d ? <path d={d} fill="var(--color-grafico)" opacity={ativo === null || ativo === i ? 1 : 0.45} /> : null}
                {i % cada === 0 ? (
                  <text x={cx} y={A - 8} textAnchor="middle" fontSize={12} fill="var(--color-roxo-soft)">
                    {p.curto}
                  </text>
                ) : null}
                {/* alvo do hover/foco: a faixa inteira, maior que a barra */}
                <rect
                  x={cx - faixa / 2}
                  y={m.topo}
                  width={faixa}
                  height={alturaPlot}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${p.completo}: ${formatarPreco(p.valor)}${p.detalhe ? `, ${p.detalhe}` : ""}`}
                  className="cursor-default outline-none focus-visible:stroke-[var(--color-magenta)] focus-visible:stroke-2"
                  onPointerEnter={() => setAtivo(i)}
                  onPointerLeave={() => setAtivo(null)}
                  onFocus={() => setAtivo(i)}
                  onBlur={() => setAtivo(null)}
                />
              </g>
            );
          })}
        </svg>
        {ativo !== null ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border-2 border-roxo bg-nevoa px-3 py-2 text-sm shadow-[3px_3px_0_0_var(--color-roxo)]"
            style={{ left: `${((m.esq + faixa * ativo + faixa / 2) / L) * 100}%` }}
          >
            <strong className="block text-base text-roxo">{formatarPreco(pontos[ativo].valor)}</strong>
            <span className="block text-roxo-soft">{pontos[ativo].completo}</span>
            {pontos[ativo].detalhe ? <span className="block text-roxo-soft">{pontos[ativo].detalhe}</span> : null}
          </div>
        ) : null}
      </div>
      <TabelaDados
        legenda={titulo}
        colunas={["período", "valor"]}
        linhas={pontos.map((p) => [p.completo, `${formatarPreco(p.valor)}${p.detalhe ? ` (${p.detalhe})` : ""}`])}
      />
    </figure>
  );
}

export interface LinhaBarra {
  rotulo: string;
  valor: number;
  detalhe: string;
}

/** Ranking em barras horizontais (uma cor só), valor na ponta de cada barra. */
export function BarrasHorizontais({ titulo, descricao, linhas, vazio }: { titulo: string; descricao: string; linhas: LinhaBarra[]; vazio: string }) {
  const maximo = Math.max(...linhas.map((l) => l.valor), 1);
  return (
    <figure className="min-w-0">
      <figcaption>
        <h3 className={SUBTITULO}>{titulo}</h3>
        <p className="text-sm text-roxo-soft">{descricao}</p>
      </figcaption>
      {linhas.length === 0 ? (
        <p className="mt-3 text-sm text-roxo-soft">{vazio}</p>
      ) : (
        <ul className="mt-4 space-y-2.5" aria-label={titulo}>
          {linhas.map((l) => (
            <li key={l.rotulo} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
              <span className="truncate font-medium text-roxo" title={l.rotulo}>
                {l.rotulo}
              </span>
              {/* trilho de largura fixa: o comprimento da barra é proporcional ao valor */}
              <span aria-hidden="true" className="block h-4">
                <span className="block h-4 rounded-r-[4px] bg-grafico" style={{ width: `${(l.valor / maximo) * 100}%`, minWidth: l.valor > 0 ? 3 : 0 }} />
              </span>
              <span className="text-right tabular-nums text-roxo">
                {formatarPreco(l.valor)}
                <span className="sr-only">, {l.detalhe}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/** Tabela com os mesmos números do gráfico (para leitor de tela, teclado e impressão). */
function TabelaDados({ legenda, colunas, linhas }: { legenda: string; colunas: string[]; linhas: string[][] }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer font-semibold text-violeta">ver como tabela</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-xl border-2 border-roxo/20">
        <table className="w-full">
          <caption className="sr-only">{legenda}</caption>
          <thead className="bg-lilas-100">
            <tr>
              {colunas.map((c) => (
                <th key={c} scope="col" className="px-3 py-1.5 text-left text-xs font-bold tracking-[0.12em] text-violeta uppercase">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-roxo/10">
            {linhas.map((l) => (
              <tr key={l[0]}>
                {l.map((v, i) => (
                  <td key={i} className="px-3 py-1.5 tabular-nums">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Numero({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio: string }) {
  return (
    <div className="rounded-2xl border-2 border-roxo/20 bg-white/60 p-4">
      <dt className={ROTULO}>{rotulo}</dt>
      <dd className="mt-1 text-2xl font-semibold text-roxo tabular-nums">{valor}</dd>
      <dd className="text-sm text-roxo-soft">{apoio}</dd>
    </div>
  );
}

function Bloco({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border-2 border-roxo/20 bg-white/60 p-4 sm:p-5">{children}</div>;
}

const mensagem = (erro: unknown) => (erro instanceof Error ? erro.message : "algo deu errado. tente de novo.");
const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

export function DashboardVendasPainel({ chamar }: { chamar: ChamadaAutenticada }) {
  const [periodo, setPeriodo] = useState<PeriodoDashboard>("12m");
  /** null = automático: dados reais, ou a demonstração se ainda não houver venda nenhuma. */
  const [escolha, setEscolha] = useState<"real" | "demo" | null>(null);
  const [dados, setDados] = useState<DashboardVendas | null>(null);
  const [semVendasReais, setSemVendasReais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [nomes, setNomes] = useState<Record<string, string>>({});

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    (async () => {
      try {
        let d = await chamar((t) => admin.dashboard(t, periodo, escolha === "demo"));
        const vazio = !d.demonstracao && d.totais.pedidos === 0;
        if (escolha === null && vazio) d = await chamar((t) => admin.dashboard(t, periodo, true));
        if (!ativo) return;
        setSemVendasReais(vazio);
        setDados(d);
        setErro("");
      } catch (e) {
        if (ativo) setErro(mensagem(e));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [chamar, periodo, escolha]);

  // nomes das vendedoras reais (o serviço de pedidos só conhece o id)
  useEffect(() => {
    chamar((t) => admin.usuarias(t)).then(
      (r) => setNomes(Object.fromEntries(r.usuarios.map((u) => [u.id, u.nome]))),
      () => undefined,
    );
  }, [chamar]);

  const colunas = useMemo(() => {
    if (!dados) return { vendas: [], comissao: [] };
    const rot = (inicio: string) => rotulosDoPonto(inicio, dados.granularidade);
    return {
      vendas: dados.serie.map((p) => ({ ...rot(p.inicio), valor: p.vendasCentavos, detalhe: plural(p.pedidos, "pedido", "pedidos") })),
      comissao: dados.serie.map((p) => ({ ...rot(p.inicio), valor: p.comissaoCentavos })),
    };
  }, [dados]);

  const demo = dados?.demonstracao ?? false;
  const unidade = dados?.granularidade === "dia" ? "por dia" : dados?.granularidade === "semana" ? "por semana" : "por mês";

  return (
    <div>
      {/* filtros: uma linha acima de tudo, valem para todos os gráficos */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="periodo-dashboard" className="mb-1.5 block text-sm font-semibold text-roxo">
            período
          </label>
          <select
            id="periodo-dashboard"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as PeriodoDashboard)}
            className="h-11 rounded-2xl border-2 border-roxo bg-white/70 px-4 text-roxo focus:bg-white focus:outline-none"
          >
            {PERIODOS.map(([v, texto]) => (
              <option key={v} value={v}>
                {texto}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className={buttonClasses("nevoa", "md")} aria-pressed={demo} onClick={() => setEscolha(demo ? "real" : "demo")}>
          {demo ? "ver dados reais" : "ver demonstração"}
        </button>
        {demo ? (
          <Sticker tone="rosa" rotate={-3}>
            dados fictícios
          </Sticker>
        ) : null}
      </div>

      <div aria-live="polite" className="mt-4 empty:hidden">
        {demo ? (
          <AvisoConta tipo="sucesso">
            <strong>demonstração:</strong> estes números são <strong>fictícios</strong>, gerados só para mostrar como o painel vai
            ficar. {semVendasReais ? "ainda não há vendas reais neste período." : ""} nada disso aconteceu de verdade.
          </AvisoConta>
        ) : null}
      </div>
      {erro ? (
        <div className="mt-4">
          <AvisoConta tipo="erro">{erro}</AvisoConta>
        </div>
      ) : null}

      {dados ? (
        <div className={`transition-opacity ${carregando ? "opacity-50" : ""}`} aria-busy={carregando}>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Numero rotulo="vendas" valor={formatarPreco(dados.totais.vendasCentavos)} apoio={`${plural(dados.totais.pedidos, "pedido", "pedidos")} · ${plural(dados.totais.pecas, "peça", "peças")}`} />
            <Numero
              rotulo="a plataforma ganhou"
              valor={formatarPreco(dados.totais.comissaoCentavos)}
              apoio={`comissão · taxa do Pix ${formatarPreco(dados.totais.taxaPixCentavos)}`}
            />
            <Numero rotulo="ticket médio" valor={formatarPreco(dados.totais.ticketMedioCentavos)} apoio="por pedido (peças + frete)" />
            <Numero rotulo="ganho por peça" valor={formatarPreco(dados.totais.comissaoPorPecaCentavos)} apoio="comissão média por peça vendida" />
          </dl>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Bloco>
              <GraficoColunas titulo="vendas" descricao={`total pago pelas compradoras, ${unidade}`} pontos={colunas.vendas} />
            </Bloco>
            <Bloco>
              <GraficoColunas titulo="comissão da plataforma" descricao={`o que o desaPego ganhou, ${unidade}`} pontos={colunas.comissao} />
            </Bloco>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Bloco>
              <BarrasHorizontais
                titulo="para onde vão as peças"
                descricao="vendas por estado de entrega"
                vazio="nenhuma entrega neste período."
                linhas={dados.porUf.slice(0, 8).map((u) => ({ rotulo: u.uf, valor: u.vendasCentavos, detalhe: plural(u.pedidos, "pedido", "pedidos") }))}
              />
            </Bloco>
            <Bloco>
              <BarrasHorizontais
                titulo="o que mais vende"
                descricao="vendas por categoria (valor das peças)"
                vazio="nenhuma peça vendida neste período."
                linhas={dados.porCategoria.map((c) => ({ rotulo: nomeCategoria(c.categoria), valor: c.vendasCentavos, detalhe: plural(c.pecas, "peça", "peças") }))}
              />
            </Bloco>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Bloco>
              <h3 className={SUBTITULO}>cidades que mais recebem</h3>
              {dados.cidades.length === 0 ? (
                <p className="mt-3 text-sm text-roxo-soft">nenhuma entrega neste período.</p>
              ) : (
                <ol className="mt-3 divide-y divide-roxo/10 text-sm">
                  {dados.cidades.map((c, i) => (
                    <li key={`${c.cidade}-${c.uf}`} className="flex items-baseline justify-between gap-3 py-1.5">
                      <span>
                        <span className="mr-2 text-roxo-soft tabular-nums">{i + 1}.</span>
                        {c.cidade} <span className="text-roxo-soft">· {c.uf}</span>
                      </span>
                      <span className="tabular-nums">{plural(c.pedidos, "pedido", "pedidos")}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Bloco>
            <Bloco>
              <h3 className={SUBTITULO}>vendedoras que mais vendem</h3>
              {dados.vendedoras.length === 0 ? (
                <p className="mt-3 text-sm text-roxo-soft">nenhuma venda neste período.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">vendedoras que mais vendem</caption>
                    <thead>
                      <tr className="text-left text-xs font-bold tracking-[0.12em] text-violeta uppercase">
                        <th scope="col" className="py-1.5 pr-3">
                          vendedora
                        </th>
                        <th scope="col" className="py-1.5 pr-3 text-right">
                          vendas
                        </th>
                        <th scope="col" className="py-1.5 text-right">
                          recebe
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-roxo/10">
                      {dados.vendedoras.map((v) => (
                        <tr key={v.vendedoraId}>
                          <td className="py-1.5 pr-3">
                            {v.nome ?? nomes[v.vendedoraId] ?? <span className="font-mono">#{v.vendedoraId.slice(0, 8)}</span>}
                            <span className="block text-xs text-roxo-soft">{plural(v.pedidos, "pedido", "pedidos")}</span>
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{formatarPreco(v.vendasCentavos)}</td>
                          <td className="py-1.5 text-right tabular-nums">{formatarPreco(v.recebeCentavos)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Bloco>
          </div>
        </div>
      ) : !erro ? (
        <p role="status" className="mt-6 text-roxo-soft">
          carregando o painel de vendas…
        </p>
      ) : null}
    </div>
  );
}
