"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AvisoConta } from "@/components/conta/AvisoConta";
import { buttonClasses } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  admin,
  percentualParaPontosBase,
  pontosBaseParaTexto,
  TEXTO_STATUS,
  type AnuncioAdmin,
  type FaixaPreco,
  type PedidoAdmin,
  type RepasseAdmin,
  type Resumo,
  type StatusPedido,
  type UsuariaAdmin,
} from "@/lib/api/admin";
import { reaisParaCentavos } from "@/lib/api/carteira";
import { CATEGORIAS } from "@/data/demo/catalogo";
import { CONDICAO_LABEL, formatarPreco } from "@/lib/format";
import { useChamadaAutenticada, type ChamadaAutenticada } from "@/lib/useChamadaAutenticada";

const CARTAO = "rounded-[1.5rem] border-2 border-roxo bg-nevoa p-5 shadow-[6px_6px_0_0_var(--color-roxo)] sm:p-7";
const TITULO = "font-display text-2xl font-medium tracking-[-0.02em] text-roxo";
const CAMPO =
  "h-11 w-full rounded-2xl border-2 border-roxo bg-white/70 px-4 text-roxo focus:bg-white focus:shadow-[3px_3px_0_0_var(--color-rosa)] focus:outline-none";
const ROTULO = "mb-1.5 block text-sm font-semibold text-roxo";
const TH = "px-3 py-2 text-left text-xs font-bold tracking-[0.12em] text-violeta uppercase";
const TD = "px-3 py-2 align-top";
const STATUS_PEDIDO = Object.keys(TEXTO_STATUS) as StatusPedido[];

const SECOES = [
  ["visao-geral", "visão geral"],
  ["usuarias", "usuárias"],
  ["anuncios", "anúncios"],
  ["pedidos", "pedidos"],
  ["comissao", "comissão"],
  ["taxa-pix", "taxa do Pix"],
  ["frete", "frete"],
  ["precos", "preço sugerido"],
  ["repasses", "repasses"],
] as const;

/** Centavos → texto do campo em reais ("19,90"). */
const centavosParaTexto = (c: number) => (c / 100).toFixed(2).replace(".", ",");

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** Seção do painel: título, aviso de sucesso/erro (lidos pelo leitor de tela) e conteúdo. */
function Secao({ id, titulo, aviso, erro, children }: { id: string; titulo: string; aviso?: string; erro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`titulo-${id}`} className={`mt-10 scroll-mt-24 ${CARTAO}`}>
      <h2 id={`titulo-${id}`} className={TITULO}>
        {titulo}
      </h2>
      <div aria-live="polite" className="empty:hidden mt-4">
        {aviso ? <AvisoConta tipo="sucesso">{aviso}</AvisoConta> : null}
      </div>
      {erro ? (
        <div className="mt-4">
          <AvisoConta tipo="erro">{erro}</AvisoConta>
        </div>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Tabela que rola na horizontal no celular; o contêiner recebe foco para rolar pelo teclado. */
function Tabela({ legenda, colunas, children }: { legenda: string; colunas: string[]; children: ReactNode }) {
  return (
    <div role="region" aria-label={legenda} tabIndex={0} className="overflow-x-auto rounded-2xl border-2 border-roxo/20 focus-visible:outline-2">
      <table className="w-full min-w-[36rem] text-sm">
        <caption className="sr-only">{legenda}</caption>
        <thead className="bg-lilas-100">
          <tr>
            {colunas.map((c) => (
              <th key={c} scope="col" className={TH}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-roxo/10">{children}</tbody>
      </table>
    </div>
  );
}

const mensagem = (erro: unknown) => (erro instanceof Error ? erro.message : "algo deu errado. tente de novo.");

export function Painel() {
  const chamar = useChamadaAutenticada();

  return (
    <section className="bg-dots">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        <SectionHeading eyebrow="administração">
          painel do <span className="text-violeta italic">desaPego</span>
        </SectionHeading>

        <nav aria-label="Seções do painel" className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {SECOES.map(([id, nome]) => (
              <li key={id}>
                <a href={`#${id}`} className={buttonClasses("nevoa", "sm")}>
                  {nome}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <VisaoGeral chamar={chamar} />
        <Usuarias chamar={chamar} />
        <Anuncios chamar={chamar} />
        <Pedidos chamar={chamar} />
        <Comissao chamar={chamar} />
        <TaxaPix chamar={chamar} />
        <Frete chamar={chamar} />
        <PrecosSugeridos chamar={chamar} />
        <Repasses chamar={chamar} />
      </div>
    </section>
  );
}

type Chamar = ChamadaAutenticada;

function VisaoGeral({ chamar }: { chamar: Chamar }) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    chamar(admin.resumo).then(setResumo, (e) => setErro(mensagem(e)));
  }, [chamar]);

  return (
    <Secao id="visao-geral" titulo="visão geral" erro={erro}>
      {resumo ? (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-bold tracking-[0.18em] text-violeta uppercase">vendas</dt>
            <dd className="mt-1 text-2xl font-semibold">{formatarPreco(resumo.vendas.totalCentavos)}</dd>
            <dd className="text-sm text-roxo-soft">{resumo.vendas.quantidade} pedido(s) pago(s)</dd>
          </div>
          <div>
            <dt className="text-xs font-bold tracking-[0.18em] text-violeta uppercase">comissão da plataforma</dt>
            <dd className="mt-1 text-2xl font-semibold">{formatarPreco(resumo.vendas.comissaoCentavos)}</dd>
            <dd className="text-sm text-roxo-soft">percentual atual: {pontosBaseParaTexto(resumo.comissaoPontosBase)}</dd>
            <dd className="text-sm text-roxo-soft">
              taxa do Pix: {formatarPreco(resumo.vendas.taxaPixCentavos)} ({pontosBaseParaTexto(resumo.taxaPixPontosBase)})
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold tracking-[0.18em] text-violeta uppercase">repasses</dt>
            <dd className="mt-1 text-2xl font-semibold">{formatarPreco(resumo.repasses.PAGO?.totalCentavos ?? 0)}</dd>
            <dd className="text-sm text-roxo-soft">{resumo.repasses.SOLICITADO?.quantidade ?? 0} solicitação(ões) em aberto</dd>
          </div>
          <div>
            <dt className="text-xs font-bold tracking-[0.18em] text-violeta uppercase">pedidos por status</dt>
            <dd className="mt-1">
              <ul className="space-y-0.5 text-sm">
                {STATUS_PEDIDO.map((s) => (
                  <li key={s} className="flex justify-between gap-3">
                    <span>{TEXTO_STATUS[s]}</span>
                    <span className="font-semibold">{resumo.pedidosPorStatus[s] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      ) : !erro ? (
        <p className="text-roxo-soft">carregando…</p>
      ) : null}
    </Secao>
  );
}

function Usuarias({ chamar }: { chamar: Chamar }) {
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<UsuariaAdmin[]>([]);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(
    (termo = "") => chamar((t) => admin.usuarias(t, termo)).then((r) => setLista(r.usuarios), (e) => setErro(mensagem(e))),
    [chamar],
  );
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternar(u: UsuariaAdmin) {
    setAviso("");
    setErro("");
    try {
      await chamar((t) => admin.bloquear(t, u.id, !u.bloqueada));
      setAviso(`${u.nome} foi ${u.bloqueada ? "desbloqueada" : "bloqueada"}.`);
      await carregar(busca);
    } catch (e) {
      setErro(mensagem(e));
    }
  }

  return (
    <Secao id="usuarias" titulo="usuárias" aviso={aviso} erro={erro}>
      <form
        role="search"
        className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          carregar(busca);
        }}
      >
        <div className="flex-1">
          <label htmlFor="busca-usuarias" className={ROTULO}>
            buscar por nome ou e-mail
          </label>
          <input id="busca-usuarias" type="search" className={CAMPO} value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <button type="submit" className={buttonClasses("violeta", "md")}>
          buscar
        </button>
      </form>
      <Tabela legenda="contas cadastradas" colunas={["nome", "e-mail", "perfil", "situação", "ação"]}>
        {lista.map((u) => (
          <tr key={u.id}>
            <td className={TD}>{u.nome}</td>
            <td className={`${TD} break-all`}>{u.email}</td>
            <td className={TD}>{u.perfil === "ADMIN_MASTER" ? "administradora master" : "usuária"}</td>
            <td className={TD}>{u.bloqueada ? "bloqueada" : "ativa"}</td>
            <td className={TD}>
              {u.perfil === "ADMIN_MASTER" ? (
                <span className="text-roxo-soft">—</span>
              ) : (
                <button
                  type="button"
                  onClick={() => alternar(u)}
                  aria-label={`${u.bloqueada ? "desbloquear" : "bloquear"} ${u.nome}`}
                  className={buttonClasses(u.bloqueada ? "nevoa" : "perigoSuave", "sm")}
                >
                  {u.bloqueada ? "desbloquear" : "bloquear"}
                </button>
              )}
            </td>
          </tr>
        ))}
      </Tabela>
    </Secao>
  );
}

function Anuncios({ chamar }: { chamar: Chamar }) {
  const [lista, setLista] = useState<AnuncioAdmin[]>([]);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const carregar = useCallback(() => chamar(admin.anuncios).then((r) => setLista(r.pecas), (e) => setErro(mensagem(e))), [chamar]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternar(a: AnuncioAdmin) {
    setAviso("");
    setErro("");
    try {
      await chamar((t) => admin.ocultar(t, a.id, !a.oculta));
      setAviso(`“${a.titulo}” ${a.oculta ? "voltou para a vitrine" : "foi ocultado"}.`);
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  }

  return (
    <Secao id="anuncios" titulo="anúncios" aviso={aviso} erro={erro}>
      <p className="mb-4 text-sm text-roxo-soft">
        o desaPego aceita só roupas, calçados, bolsas e acessórios. anúncios fora dessas categorias aparecem como irregulares e
        não podem voltar para a vitrine.
      </p>
      <Tabela legenda="anúncios" colunas={["título", "categoria", "preço", "situação", "ação"]}>
        {lista.map((a) => (
          <tr key={a.id} className={a.irregular ? "bg-rosa-100" : undefined}>
            <td className={TD}>{a.titulo}</td>
            <td className={TD}>
              {a.categoria}
              {a.irregular ? <strong className="ml-2 text-magenta">irregular</strong> : null}
            </td>
            <td className={TD}>{formatarPreco(a.precoCentavos)}</td>
            <td className={TD}>{a.oculta ? `oculto${a.motivoOculta ? ` (${a.motivoOculta})` : ""}` : a.status}</td>
            <td className={TD}>
              <button
                type="button"
                onClick={() => alternar(a)}
                aria-label={`${a.oculta ? "reexibir" : "ocultar"} ${a.titulo}`}
                className={buttonClasses(a.oculta ? "nevoa" : "perigoSuave", "sm")}
              >
                {a.oculta ? "reexibir" : "ocultar"}
              </button>
            </td>
          </tr>
        ))}
      </Tabela>
    </Secao>
  );
}

function FiltroStatus<T extends string>({ id, valor, opcoes, mudar }: { id: string; valor: T | ""; opcoes: [T, string][]; mudar: (v: T | "") => void }) {
  return (
    <div className="mb-5 max-w-xs">
      <label htmlFor={id} className={ROTULO}>
        filtrar por status
      </label>
      <select id={id} className={CAMPO} value={valor} onChange={(e) => mudar(e.target.value as T | "")}>
        <option value="">todos</option>
        {opcoes.map(([v, texto]) => (
          <option key={v} value={v}>
            {texto}
          </option>
        ))}
      </select>
    </div>
  );
}

function Pedidos({ chamar }: { chamar: Chamar }) {
  const [status, setStatus] = useState<StatusPedido | "">("");
  const [lista, setLista] = useState<PedidoAdmin[]>([]);
  const [erro, setErro] = useState("");
  useEffect(() => {
    chamar((t) => admin.pedidos(t, status || undefined)).then((r) => setLista(r.pedidos), (e) => setErro(mensagem(e)));
  }, [chamar, status]);

  return (
    <Secao id="pedidos" titulo="pedidos" erro={erro}>
      <FiltroStatus id="filtro-pedidos" valor={status} opcoes={STATUS_PEDIDO.map((s) => [s, TEXTO_STATUS[s]])} mudar={setStatus} />
      {lista.length === 0 ? (
        <p className="text-roxo-soft">nenhum pedido{status ? ` com status “${TEXTO_STATUS[status]}”` : ""}.</p>
      ) : (
        <Tabela legenda="pedidos" colunas={["pedido", "status", "total", "comissão", "vendedora recebe", "data"]}>
          {lista.map((p) => (
            <tr key={p.id}>
              <td className={`${TD} font-mono`}>#{p.id.slice(0, 8)}</td>
              <td className={TD}>{TEXTO_STATUS[p.status]}</td>
              <td className={TD}>{formatarPreco(p.totalCentavos)}</td>
              <td className={TD}>
                {formatarPreco(p.comissaoCentavos)} <span className="text-roxo-soft">({pontosBaseParaTexto(p.comissaoPontosBase)})</span>
              </td>
              <td className={TD}>{formatarPreco(p.vendedoraCentavos)}</td>
              <td className={TD}>{data(p.criadoEm)}</td>
            </tr>
          ))}
        </Tabela>
      )}
    </Secao>
  );
}

function Comissao({ chamar }: { chamar: Chamar }) {
  const [atual, setAtual] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => {
    chamar(admin.comissao).then(
      (r) => {
        setAtual(r.comissaoPontosBase);
        setTexto(pontosBaseParaTexto(r.comissaoPontosBase).replace("%", ""));
      },
      (e) => setErro(mensagem(e)),
    );
  }, [chamar]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setAviso("");
    setErro("");
    const pb = percentualParaPontosBase(texto);
    if (pb === null || pb > 5000) {
      setErro("informe um percentual entre 0 e 50, com até duas casas decimais (ex.: 12,5).");
      return document.getElementById("campo-comissao")?.focus();
    }
    try {
      const r = await chamar((t) => admin.definirComissao(t, pb));
      setAtual(r.comissaoPontosBase);
      setAviso(`comissão alterada para ${pontosBaseParaTexto(r.comissaoPontosBase)}. vale só para os pedidos novos.`);
    } catch (falha) {
      setErro(mensagem(falha));
    }
  }

  return (
    <Secao id="comissao" titulo="comissão da plataforma" aviso={aviso} erro={erro}>
      <p className="mb-4 text-sm text-roxo-soft">
        percentual atual: <strong className="text-roxo">{atual === null ? "…" : pontosBaseParaTexto(atual)}</strong>. a mudança vale
        só para pedidos novos: cada pedido guarda a comissão do momento da compra.
      </p>
      <form onSubmit={salvar} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="max-w-xs flex-1">
          <label htmlFor="campo-comissao" className={ROTULO}>
            nova comissão (%)
          </label>
          <input
            id="campo-comissao"
            inputMode="decimal"
            className={CAMPO}
            value={texto}
            aria-describedby="dica-comissao"
            onChange={(e) => setTexto(e.target.value)}
          />
          <p id="dica-comissao" className="mt-1 text-xs text-roxo-soft">
            de 0 a 50, com até duas casas decimais.
          </p>
        </div>
        <button type="submit" className={buttonClasses("violeta", "md")}>
          salvar comissão
        </button>
      </form>
    </Secao>
  );
}

/** Formulário de um valor só (taxa ou frete): campo, dica e botão salvar. */
function FormValor({
  id,
  rotulo,
  dica,
  botao,
  texto,
  mudar,
  salvar,
}: {
  id: string;
  rotulo: string;
  dica: string;
  botao: string;
  texto: string;
  mudar: (v: string) => void;
  salvar: (e: FormEvent) => void;
}) {
  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="max-w-xs flex-1">
        <label htmlFor={id} className={ROTULO}>
          {rotulo}
        </label>
        <input id={id} inputMode="decimal" className={CAMPO} value={texto} aria-describedby={`dica-${id}`} onChange={(e) => mudar(e.target.value)} />
        <p id={`dica-${id}`} className="mt-1 text-xs text-roxo-soft">
          {dica}
        </p>
      </div>
      <button type="submit" className={buttonClasses("violeta", "md")}>
        {botao}
      </button>
    </form>
  );
}

function TaxaPix({ chamar }: { chamar: Chamar }) {
  const [atual, setAtual] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => {
    chamar(admin.configuracao).then(
      (r) => {
        setAtual(r.taxaPixPontosBase);
        setTexto(pontosBaseParaTexto(r.taxaPixPontosBase).replace("%", ""));
      },
      (e) => setErro(mensagem(e)),
    );
  }, [chamar]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setAviso("");
    setErro("");
    const pb = percentualParaPontosBase(texto);
    if (pb === null || pb > 1000) {
      setErro("informe um percentual entre 0 e 10, com até duas casas decimais (ex.: 0,99).");
      return document.getElementById("campo-taxa-pix")?.focus();
    }
    try {
      const r = await chamar((t) => admin.definirTaxaPix(t, pb));
      setAtual(r.taxaPixPontosBase);
      setAviso(`taxa do Pix alterada para ${pontosBaseParaTexto(r.taxaPixPontosBase)}. vale só para os pedidos novos.`);
    } catch (falha) {
      setErro(mensagem(falha));
    }
  }

  return (
    <Secao id="taxa-pix" titulo="taxa do Pix" aviso={aviso} erro={erro}>
      <p className="mb-4 text-sm text-roxo-soft">
        percentual atual: <strong className="text-roxo">{atual === null ? "…" : pontosBaseParaTexto(atual)}</strong>, cobrado sobre o
        total pago (peças + frete) e descontado da parte da vendedora. como a comissão, vale só para pedidos novos.
      </p>
      <FormValor
        id="campo-taxa-pix"
        rotulo="nova taxa do Pix (%)"
        dica="de 0 a 10, com até duas casas decimais."
        botao="salvar taxa"
        texto={texto}
        mudar={setTexto}
        salvar={salvar}
      />
    </Secao>
  );
}

function Frete({ chamar }: { chamar: Chamar }) {
  const [atual, setAtual] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => {
    chamar(admin.frete).then(
      (r) => {
        setAtual(r.freteCentavos);
        setTexto(centavosParaTexto(r.freteCentavos));
      },
      (e) => setErro(mensagem(e)),
    );
  }, [chamar]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setAviso("");
    setErro("");
    const centavos = reaisParaCentavos(texto);
    if (centavos === null || centavos > 20_000) {
      setErro("informe um valor entre R$ 0,00 e R$ 200,00 (ex.: 19,90).");
      return document.getElementById("campo-frete")?.focus();
    }
    try {
      const r = await chamar((t) => admin.definirFrete(t, centavos));
      setAtual(r.freteCentavos);
      setAviso(`frete alterado para ${formatarPreco(r.freteCentavos)}. vale para os pedidos novos.`);
    } catch (falha) {
      setErro(mensagem(falha));
    }
  }

  return (
    <Secao id="frete" titulo="frete fixo" aviso={aviso} erro={erro}>
      <p className="mb-4 text-sm text-roxo-soft">
        frete atual: <strong className="text-roxo">{atual === null ? "…" : formatarPreco(atual)}</strong>. é cobrado em cada pedido e
        vai para a vendedora, que faz o envio. pedidos já feitos guardam o frete deles.
      </p>
      <FormValor id="campo-frete" rotulo="novo frete (R$)" dica="de 0 a 200 reais." botao="salvar frete" texto={texto} mudar={setTexto} salvar={salvar} />
    </Secao>
  );
}

type LinhaPreco = { categoria: FaixaPreco["categoria"]; condicao: FaixaPreco["condicao"]; minimo: string; maximo: string };

const nomeCategoria = (slug: string) => CATEGORIAS.find((c) => c.slug === slug)?.nome ?? slug;

function PrecosSugeridos({ chamar }: { chamar: Chamar }) {
  const [linhas, setLinhas] = useState<LinhaPreco[]>([]);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const paraLinhas = (faixas: FaixaPreco[]) =>
    faixas.map((f) => ({ categoria: f.categoria, condicao: f.condicao, minimo: centavosParaTexto(f.minimoCentavos), maximo: centavosParaTexto(f.maximoCentavos) }));

  useEffect(() => {
    chamar(admin.configuracao).then((r) => setLinhas(paraLinhas(r.precosSugeridos)), (e) => setErro(mensagem(e)));
  }, [chamar]);

  const mudar = (i: number, campo: "minimo" | "maximo", valor: string) =>
    setLinhas((atuais) => atuais.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setAviso("");
    setErro("");
    const faixas: FaixaPreco[] = [];
    for (const [i, l] of linhas.entries()) {
      const minimoCentavos = reaisParaCentavos(l.minimo);
      const maximoCentavos = reaisParaCentavos(l.maximo);
      const nome = `${nomeCategoria(l.categoria)}, ${CONDICAO_LABEL[l.condicao]}`;
      if (!minimoCentavos || maximoCentavos === null || maximoCentavos < minimoCentavos) {
        setErro(`confira a faixa de ${nome}: o mínimo precisa ser maior que zero e o máximo não pode ser menor que ele.`);
        return document.getElementById(`preco-${i}-minimo`)?.focus();
      }
      faixas.push({ categoria: l.categoria, condicao: l.condicao, minimoCentavos, maximoCentavos });
    }
    try {
      const r = await chamar((t) => admin.definirPrecosSugeridos(t, faixas));
      setLinhas(paraLinhas(r.precosSugeridos));
      setAviso("tabela de preço sugerido salva. o simulador do anúncio já usa a nova tabela.");
    } catch (falha) {
      setErro(mensagem(falha));
    }
  }

  return (
    <Secao id="precos" titulo="tabela de preço sugerido" aviso={aviso} erro={erro}>
      <p className="mb-4 text-sm text-roxo-soft">
        a faixa que o anúncio sugere para cada categoria e condição, em reais. ajuste os valores e salve a tabela inteira.
      </p>
      <form onSubmit={salvar} noValidate>
        <Tabela legenda="faixas de preço sugerido" colunas={["categoria", "condição", "mínimo (R$)", "máximo (R$)"]}>
          {linhas.map((l, i) => {
            const nome = `${nomeCategoria(l.categoria)}, ${CONDICAO_LABEL[l.condicao]}`;
            return (
              <tr key={`${l.categoria}-${l.condicao}`}>
                <td className={TD}>{nomeCategoria(l.categoria)}</td>
                <td className={TD}>{CONDICAO_LABEL[l.condicao]}</td>
                <td className={TD}>
                  <input
                    id={`preco-${i}-minimo`}
                    aria-label={`mínimo de ${nome}`}
                    inputMode="decimal"
                    className={`${CAMPO} h-9 max-w-[8rem]`}
                    value={l.minimo}
                    onChange={(e) => mudar(i, "minimo", e.target.value)}
                  />
                </td>
                <td className={TD}>
                  <input
                    aria-label={`máximo de ${nome}`}
                    inputMode="decimal"
                    className={`${CAMPO} h-9 max-w-[8rem]`}
                    value={l.maximo}
                    onChange={(e) => mudar(i, "maximo", e.target.value)}
                  />
                </td>
              </tr>
            );
          })}
        </Tabela>
        <button type="submit" className={`mt-5 ${buttonClasses("violeta", "md")}`}>
          salvar tabela
        </button>
      </form>
    </Secao>
  );
}

function Repasses({ chamar }: { chamar: Chamar }) {
  const [status, setStatus] = useState<"SOLICITADO" | "PAGO" | "">("SOLICITADO");
  const [lista, setLista] = useState<RepasseAdmin[]>([]);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const carregar = useCallback(
    () => chamar((t) => admin.repasses(t, status || undefined)).then((r) => setLista(r.repasses), (e) => setErro(mensagem(e))),
    [chamar, status],
  );
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function pagar(r: RepasseAdmin) {
    setAviso("");
    setErro("");
    try {
      await chamar((t) => admin.pagarRepasse(t, r.id));
      setAviso(`repasse de ${formatarPreco(r.valorCentavos)} registrado como pago.`);
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  }

  return (
    <Secao id="repasses" titulo="repasses (saques das vendedoras)" aviso={aviso} erro={erro}>
      <p className="mb-4 text-sm text-roxo-soft">
        faça o Pix para a vendedora e depois registre aqui. o valor sai do saldo disponível dela e nunca pode ser maior que ele.
      </p>
      <FiltroStatus
        id="filtro-repasses"
        valor={status}
        opcoes={[
          ["SOLICITADO", "solicitados"],
          ["PAGO", "pagos"],
        ]}
        mudar={setStatus}
      />
      {lista.length === 0 ? (
        <p className="text-roxo-soft">nenhum repasse aqui.</p>
      ) : (
        <Tabela legenda="solicitações de repasse" colunas={["vendedora", "valor", "status", "solicitado em", "ação"]}>
          {lista.map((r) => (
            <tr key={r.id}>
              <td className={`${TD} font-mono`}>{r.vendedoraId.slice(0, 8)}</td>
              <td className={TD}>{formatarPreco(r.valorCentavos)}</td>
              <td className={TD}>{r.status === "PAGO" ? `pago em ${data(r.pagoEm!)}` : "solicitado"}</td>
              <td className={TD}>{data(r.criadoEm)}</td>
              <td className={TD}>
                {r.status === "SOLICITADO" ? (
                  <button
                    type="button"
                    onClick={() => pagar(r)}
                    aria-label={`registrar pagamento de ${formatarPreco(r.valorCentavos)}`}
                    className={buttonClasses("violeta", "sm")}
                  >
                    registrar pagamento
                  </button>
                ) : (
                  <span className="text-roxo-soft">—</span>
                )}
              </td>
            </tr>
          ))}
        </Tabela>
      )}
    </Secao>
  );
}
