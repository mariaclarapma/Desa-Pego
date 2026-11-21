"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AvisoConta } from "@/components/conta/AvisoConta";
import { buttonClasses } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  carteira as api,
  descricaoDoLancamento,
  reaisParaCentavos,
  valorDoLancamento,
  type Carteira,
  type Repasse,
} from "@/lib/api/carteira";
import { formatarPreco } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { useChamadaAutenticada } from "@/lib/useChamadaAutenticada";
import { useSessaoObrigatoria } from "@/lib/useSessaoObrigatoria";

const CARTAO = "rounded-[1.5rem] border-2 border-roxo bg-nevoa p-5 shadow-[6px_6px_0_0_var(--color-roxo)] sm:p-7";
const TITULO = "font-display text-2xl font-medium tracking-[-0.02em] text-roxo";
const ROTULO = "text-xs font-bold tracking-[0.18em] text-violeta uppercase";
const CAMPO =
  "h-11 w-full rounded-2xl border-2 border-roxo bg-white/70 px-4 text-roxo focus:bg-white focus:shadow-[3px_3px_0_0_var(--color-rosa)] focus:outline-none";

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const mensagem = (erro: unknown) => (erro instanceof Error ? erro.message : "algo deu errado. tente de novo.");
/** Valor com sinal, para o extrato: "+ R$ 90,00" / "− R$ 10,00". */
const comSinal = (centavos: number) => `${centavos < 0 ? "−" : "+"} ${formatarPreco(Math.abs(centavos))}`;

/**
 * Carteira da vendedora (Req. 014). Rota privada: sem sessão vai para o login.
 * Saldo, extrato e saques vêm do backend; o limite do saque também é conferido lá.
 */
export function PaginaCarteira() {
  const sessao = useSessaoObrigatoria();

  if (!sessao) {
    return (
      <p role="status" className="min-h-[60vh] px-4 py-24 text-center text-roxo-soft">
        carregando sua carteira…
      </p>
    );
  }

  return (
    <section className="bg-dots">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
        <SectionHeading eyebrow="minha conta">
          minha <span className="text-violeta italic">carteira</span>
        </SectionHeading>
        <p className="mt-4 text-lg text-roxo-soft">
          o dinheiro de cada venda fica pendente até a compradora confirmar que recebeu. depois disso, fica disponível para você
          pedir o repasse via Pix.
        </p>
        <nav aria-label="atalhos da conta" className="mt-8">
          <ul className="flex flex-wrap gap-3">
            <li>
              <Link href={ROUTES.minhasVendas} className={buttonClasses("nevoa", "md")}>
                minhas vendas
              </Link>
            </li>
            <li>
              <Link href={ROUTES.conta} className={buttonClasses("fantasma", "md")}>
                voltar pra minha conta
              </Link>
            </li>
          </ul>
        </nav>
        <ConteudoCarteira />
      </div>
    </section>
  );
}

export function ConteudoCarteira() {
  const chamar = useChamadaAutenticada();
  const [dados, setDados] = useState<Carteira | null>(null);
  const [repasses, setRepasses] = useState<Repasse[]>([]);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([chamar(api.ler), chamar(api.repasses)]);
      setDados(c);
      setRepasses(r.repasses);
      setErro("");
    } catch (e) {
      setErro(mensagem(e));
    }
  }, [chamar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!dados) {
    return erro ? (
      <div className="mt-10">
        <AvisoConta tipo="erro">{erro}</AvisoConta>
      </div>
    ) : (
      <p role="status" className="mt-10 text-roxo-soft">
        carregando saldo…
      </p>
    );
  }

  return (
    <>
      <section aria-labelledby="titulo-saldo" className={`mt-10 ${CARTAO}`}>
        <h2 id="titulo-saldo" className={TITULO}>
          saldo
        </h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <dt className={ROTULO}>pendente</dt>
            <dd className="mt-1 text-2xl font-semibold">{formatarPreco(dados.pendenteCentavos)}</dd>
            <dd className="text-sm text-roxo-soft">vendas pagas, aguardando a entrega</dd>
          </div>
          <div>
            <dt className={ROTULO}>disponível</dt>
            <dd className="mt-1 text-2xl font-semibold">{formatarPreco(dados.disponivelCentavos)}</dd>
            <dd className="text-sm text-roxo-soft">entregas confirmadas</dd>
          </div>
          <div>
            <dt className={ROTULO}>pode sacar</dt>
            <dd className="mt-1 text-2xl font-semibold">{formatarPreco(dados.podeSacarCentavos)}</dd>
            <dd className="text-sm text-roxo-soft">
              {dados.emSaqueCentavos > 0 ? `${formatarPreco(dados.emSaqueCentavos)} já em saque` : "nenhum saque em aberto"}
            </dd>
          </div>
        </dl>
      </section>

      <PedirRepasse podeSacarCentavos={dados.podeSacarCentavos} aoPedir={carregar} />

      <section aria-labelledby="titulo-repasses" className={`mt-10 ${CARTAO}`}>
        <h2 id="titulo-repasses" className={TITULO}>
          meus saques
        </h2>
        {repasses.length === 0 ? (
          <p className="mt-4 text-roxo-soft">você ainda não pediu nenhum saque.</p>
        ) : (
          <ul className="mt-5 divide-y divide-roxo/10">
            {repasses.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <span className="font-semibold">{formatarPreco(r.valorCentavos)}</span>
                <span className="text-sm text-roxo-soft">
                  {r.status === "PAGO" && r.pagoEm ? `pago em ${data(r.pagoEm)}` : `pedido em ${data(r.criadoEm)}, aguardando o Pix`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-extrato" className={`mt-10 ${CARTAO}`}>
        <h2 id="titulo-extrato" className={TITULO}>
          extrato
        </h2>
        <p className="mt-2 text-sm text-roxo-soft">
          cada linha é um lançamento: nada é apagado nem alterado. em cada venda, a comissão e a taxa do Pix aparecem separadas do
          que fica para você.
        </p>
        {dados.extrato.length === 0 ? (
          <p className="mt-4 text-roxo-soft">nenhuma movimentação ainda. quando uma venda for paga, ela aparece aqui.</p>
        ) : (
          <ul aria-label="lançamentos" className="mt-5 divide-y divide-roxo/10">
            {dados.extrato.map((l) => {
              const valor = valorDoLancamento(l);
              return (
                <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <span>
                    <span className="block">{descricaoDoLancamento(l)}</span>
                    <time dateTime={l.criadoEm} className="text-sm text-roxo-soft">
                      {data(l.criadoEm)}
                    </time>
                  </span>
                  <span className={`font-semibold tabular-nums ${valor < 0 ? "text-magenta" : ""}`}>{comSinal(valor)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function PedirRepasse({ podeSacarCentavos, aoPedir }: { podeSacarCentavos: number; aoPedir: () => Promise<void> }) {
  const chamar = useChamadaAutenticada();
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function pedir(e: FormEvent) {
    e.preventDefault();
    setAviso("");
    setErro("");
    const valor = reaisParaCentavos(texto);
    // a tela avisa antes, mas quem barra de verdade é o backend (422)
    if (valor === null || valor <= 0) {
      setErro("informe um valor maior que zero, com até duas casas decimais (ex.: 50,00).");
      return document.getElementById("campo-saque")?.focus();
    }
    if (valor > podeSacarCentavos) {
      setErro(`o valor passa do que você pode sacar (${formatarPreco(podeSacarCentavos)}).`);
      return document.getElementById("campo-saque")?.focus();
    }
    setEnviando(true);
    try {
      await chamar((t) => api.pedirRepasse(t, valor));
      setTexto("");
      setAviso(`saque de ${formatarPreco(valor)} pedido. a administração faz o Pix para a sua chave cadastrada.`);
      await aoPedir();
    } catch (falha) {
      setErro(mensagem(falha));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-saque" className={`mt-10 ${CARTAO}`}>
      <h2 id="titulo-saque" className={TITULO}>
        pedir repasse
      </h2>
      <div aria-live="polite" className="empty:hidden mt-4">
        {aviso ? <AvisoConta tipo="sucesso">{aviso}</AvisoConta> : null}
      </div>
      {erro ? (
        <div className="mt-4">
          <AvisoConta tipo="erro">{erro}</AvisoConta>
        </div>
      ) : null}
      <form onSubmit={pedir} noValidate className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="max-w-xs flex-1">
          <label htmlFor="campo-saque" className="mb-1.5 block text-sm font-semibold text-roxo">
            valor do saque (R$)
          </label>
          <input
            id="campo-saque"
            inputMode="decimal"
            className={CAMPO}
            value={texto}
            aria-describedby="dica-saque"
            onChange={(e) => setTexto(e.target.value)}
          />
          <p id="dica-saque" className="mt-1 text-xs text-roxo-soft">
            até {formatarPreco(podeSacarCentavos)}.
          </p>
        </div>
        <button type="submit" disabled={enviando || podeSacarCentavos <= 0} className={buttonClasses("violeta", "md")}>
          {enviando ? "pedindo…" : "pedir saque"}
        </button>
      </form>
    </section>
  );
}
