"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvisoConta } from "@/components/conta/AvisoConta";
import { buttonClasses, ButtonLink } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
import {
  acaoDisponivel,
  formatarEndereco,
  meusPedidos,
  STATUS_PEDIDO,
  TEXTO_STATUS,
  type Papel,
  type PedidoDaConta,
  type StatusPedido,
} from "@/lib/api/meusPedidos";
import { formatarPreco } from "@/lib/format";
import { catalogoUrl } from "@/lib/routes";
import { useChamadaAutenticada } from "@/lib/useChamadaAutenticada";

const CARTAO = "rounded-[1.5rem] border-2 border-roxo bg-nevoa p-5 shadow-[6px_6px_0_0_var(--color-roxo)] sm:p-7";
const ROTULO = "text-xs font-bold tracking-[0.18em] text-violeta uppercase";

const TOM: Record<StatusPedido, "lilas" | "pervinca" | "rosa" | "violeta" | "nevoa"> = {
  AGUARDANDO_PAGAMENTO: "lilas",
  PAGO: "pervinca",
  ENVIADO: "rosa",
  ENTREGUE: "violeta",
  CANCELADO: "nevoa",
};

const ETAPAS: StatusPedido[] = ["AGUARDANDO_PAGAMENTO", "PAGO", "ENVIADO", "ENTREGUE"];

const ACOES = {
  enviar: {
    botao: "marcar como enviado",
    pergunta: "já postou a peça? a compradora vai ver o pedido como enviado.",
    confirmar: "sim, já enviei",
    feito: "pedido marcado como enviado.",
    variante: "violeta" as const,
  },
  confirmar: {
    botao: "confirmar recebimento",
    pergunta: "a peça chegou certinha? ao confirmar, o valor é liberado para quem vendeu. não dá para desfazer.",
    confirmar: "sim, recebi",
    feito: "recebimento confirmado. obrigado por garimpar no desaPego!",
    variante: "violeta" as const,
  },
  cancelar: {
    botao: "cancelar pedido",
    pergunta: "cancelar este pedido? as peças voltam para a vitrine.",
    confirmar: "sim, cancelar",
    feito: "pedido cancelado.",
    variante: "perigoSuave" as const,
  },
};

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const codigo = (id: string) => `#${id.slice(0, 6)}`;

/** Linha do tempo do pedido: as 4 etapas, com a atual marcada (ou o aviso de cancelado). */
function LinhaDoTempo({ status }: { status: StatusPedido }) {
  if (status === "CANCELADO") {
    return <p className="text-sm text-roxo-soft">este pedido foi cancelado.</p>;
  }
  const atual = ETAPAS.indexOf(status);
  return (
    <ol aria-label="andamento do pedido" className="grid grid-cols-4 gap-1.5">
      {ETAPAS.map((etapa, i) => {
        const feita = i <= atual;
        return (
          <li key={etapa} aria-current={i === atual ? "step" : undefined} className="flex flex-col gap-1.5">
            <span aria-hidden="true" className={`h-2 rounded-full border-2 border-roxo ${feita ? "bg-violeta" : "bg-white/70"}`} />
            <span className={`text-[0.7rem] leading-tight sm:text-xs ${i === atual ? "font-bold text-roxo" : "text-roxo-soft"}`}>
              {TEXTO_STATUS[etapa]}
              <span className="sr-only">{i < atual ? " (concluído)" : i === atual ? " (etapa atual)" : " (próxima etapa)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CartaoPedido({ pedido, papel, aoMudar }: { pedido: PedidoDaConta; papel: Papel; aoMudar: (p: PedidoDaConta, aviso: string) => void }) {
  const chamar = useChamadaAutenticada();
  const acao = acaoDisponivel(papel, pedido.status);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const botaoRef = useRef<HTMLButtonElement>(null);
  const confirmarRef = useRef<HTMLButtonElement>(null);
  const titulo = `pedido ${codigo(pedido.id)}`;
  const endereco = formatarEndereco(pedido.endereco);

  useEffect(() => {
    if (confirmando) confirmarRef.current?.focus();
  }, [confirmando]);

  async function executar() {
    if (!acao) return;
    setEnviando(true);
    setErro("");
    try {
      const op = { enviar: meusPedidos.enviar, confirmar: meusPedidos.confirmarRecebimento, cancelar: meusPedidos.cancelar }[acao];
      const atualizado = await chamar((t) => op(t, pedido.id));
      setConfirmando(false);
      aoMudar({ ...pedido, ...atualizado, endereco: pedido.endereco }, `${titulo}: ${ACOES[acao].feito}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "algo deu errado. tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  function desistir() {
    setConfirmando(false);
    requestAnimationFrame(() => botaoRef.current?.focus());
  }

  return (
    <article aria-labelledby={`titulo-${pedido.id}`} className={CARTAO}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`titulo-${pedido.id}`} className="font-display text-2xl font-medium tracking-[-0.02em] text-roxo">
            {titulo}
          </h2>
          <p className="text-sm text-roxo-soft">
            feito em <time dateTime={pedido.criadoEm}>{data(pedido.criadoEm)}</time>
          </p>
        </div>
        <Sticker tone={TOM[pedido.status]} rotate={-3}>
          {TEXTO_STATUS[pedido.status]}
        </Sticker>
      </header>

      <div className="mt-5">
        <LinhaDoTempo status={pedido.status} />
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className={ROTULO}>peças</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {pedido.itens.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span>{item.titulo}</span>
                <span className="shrink-0 font-medium">{formatarPreco(item.precoCentavos)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t-2 border-roxo/15 pt-3 text-sm">
            <div className="flex justify-between">
              <dt>frete</dt>
              <dd>{formatarPreco(pedido.freteCentavos)}</dd>
            </div>
            <div className="flex justify-between text-base font-bold">
              <dt>total</dt>
              <dd>{formatarPreco(pedido.totalCentavos)}</dd>
            </div>
            {papel === "vendedora" ? (
              <>
                <div className="flex justify-between text-roxo-soft">
                  <dt>comissão do desaPego</dt>
                  <dd>− {formatarPreco(pedido.comissaoCentavos)}</dd>
                </div>
                <div className="flex justify-between font-bold text-violeta">
                  <dt>você recebe</dt>
                  <dd>{formatarPreco(pedido.vendedoraCentavos)}</dd>
                </div>
              </>
            ) : null}
          </dl>
        </div>

        {papel === "vendedora" && endereco.length ? (
          <div>
            <h3 className={ROTULO}>enviar para</h3>
            <address className="mt-2 rounded-2xl border-2 border-dashed border-roxo/30 bg-white/60 p-4 text-sm not-italic">
              {endereco.map((linha) => (
                <span key={linha} className="block">
                  {linha}
                </span>
              ))}
            </address>
          </div>
        ) : null}
      </div>

      {erro ? (
        <div className="mt-5">
          <AvisoConta tipo="erro">{erro}</AvisoConta>
        </div>
      ) : null}

      {acao ? (
        <div className="mt-6 border-t-2 border-dashed border-roxo/20 pt-5">
          {confirmando ? (
            <div role="group" aria-labelledby={`pergunta-${pedido.id}`} className="space-y-3">
              <p id={`pergunta-${pedido.id}`} className="text-sm font-medium text-roxo">
                {ACOES[acao].pergunta}
              </p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button type="button" onClick={desistir} disabled={enviando} className={buttonClasses("fantasma", "md", "w-full sm:w-auto")}>
                  voltar
                </button>
                <button
                  ref={confirmarRef}
                  type="button"
                  onClick={executar}
                  disabled={enviando}
                  className={buttonClasses(ACOES[acao].variante, "md", "w-full sm:w-auto")}
                >
                  {enviando ? "salvando…" : ACOES[acao].confirmar}
                </button>
              </div>
            </div>
          ) : (
            <button
              ref={botaoRef}
              type="button"
              onClick={() => setConfirmando(true)}
              aria-label={`${ACOES[acao].botao} do ${titulo}`}
              className={buttonClasses(ACOES[acao].variante, "md", "w-full sm:w-auto")}
            >
              {ACOES[acao].botao}
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}

/** Lista de compras ou de vendas da conta logada, com filtro por status. */
export function ListaDePedidos({ papel }: { papel: Papel }) {
  const chamar = useChamadaAutenticada();
  const [status, setStatus] = useState<StatusPedido | "">("");
  const [pedidos, setPedidos] = useState<PedidoDaConta[] | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(() => {
    setErro("");
    chamar((t) => meusPedidos.listar(t, papel, status || undefined)).then(
      (r) => setPedidos(r.pedidos),
      (e) => {
        setPedidos([]);
        setErro(e instanceof Error ? e.message : "não deu para carregar os pedidos.");
      },
    );
  }, [chamar, papel, status]);

  useEffect(carregar, [carregar]);

  const opcoes: [StatusPedido | "", string][] = [["", "todos"], ...STATUS_PEDIDO.map((s): [StatusPedido, string] => [s, TEXTO_STATUS[s]])];

  return (
    <>
      <div role="group" aria-label="filtrar por status" className="mt-8 flex flex-wrap gap-2">
        {opcoes.map(([valor, texto]) => (
          <button
            key={valor || "todos"}
            type="button"
            aria-pressed={status === valor}
            onClick={() => {
              setAviso("");
              setStatus(valor);
            }}
            className={buttonClasses(status === valor ? "violeta" : "nevoa", "sm")}
          >
            {texto}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-6 empty:hidden">
        {aviso ? <AvisoConta tipo="sucesso">{aviso}</AvisoConta> : null}
      </div>
      {erro ? (
        <div className="mt-6">
          <AvisoConta tipo="erro">{erro}</AvisoConta>
        </div>
      ) : null}

      {pedidos === null ? (
        <p role="status" className="mt-10 text-roxo-soft">
          carregando seus pedidos…
        </p>
      ) : pedidos.length === 0 && !erro ? (
        <div className="mt-10 text-center">
          <Sticker tone="lilas" rotate={-3}>
            {status ? "nada com esse status" : "nada por aqui ainda"}
          </Sticker>
          <p className="mx-auto mt-5 max-w-md text-roxo-soft">
            {papel === "compradora"
              ? "quando você comprar uma peça, o pedido aparece aqui para acompanhar até chegar."
              : "quando alguém comprar uma peça sua, a venda aparece aqui com o endereço para enviar."}
          </p>
          {papel === "compradora" && !status ? (
            <ButtonLink href={catalogoUrl()} variant="violeta" size="lg" className="mt-8">
              garimpar na vitrine
            </ButtonLink>
          ) : null}
        </div>
      ) : (
        <ul className="mt-8 space-y-8">
          {pedidos.map((p) => (
            <li key={p.id}>
              <CartaoPedido
                pedido={p}
                papel={papel}
                aoMudar={(novo, mensagem) => {
                  setPedidos((lista) => (lista ?? []).map((x) => (x.id === novo.id ? novo : x)));
                  setAviso(mensagem);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
