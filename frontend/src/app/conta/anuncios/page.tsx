"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { buttonClasses, ButtonLink } from "@/components/ui/Button";
import { ConditionBadge } from "@/components/ui/ConditionBadge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { anuncios, type Anuncio } from "@/lib/api/anuncios";
import { formatarPreco } from "@/lib/format";
import { editarAnuncioUrl, ROUTES } from "@/lib/routes";
import { useChamadaAutenticada, type ChamadaAutenticada } from "@/lib/useChamadaAutenticada";
import { useSessaoObrigatoria } from "@/lib/useSessaoObrigatoria";

const AVISOS: Record<string, string> = { publicado: "anúncio publicado.", editado: "alterações salvas." };

/** Situação do anúncio para a vendedora. */
function situacao(a: Anuncio): { texto: string; estilo: string } {
  if (a.oculta) return { texto: "oculto pela administração", estilo: "bg-nevoa-200 text-roxo" };
  if (a.status === "vendida") return { texto: "vendido", estilo: "bg-roxo text-nevoa" };
  if (a.status === "reservada" || a.emPedido) return { texto: "num pedido", estilo: "bg-pervinca text-roxo" };
  if (a.pausada) return { texto: "pausado", estilo: "bg-nevoa-200 text-roxo" };
  return { texto: "na vitrine", estilo: "bg-lilas text-roxo" };
}

/** Peça reservada, vendida ou num pedido esperando o Pix não muda (a mesma regra do backend). */
const alteravel = (a: Anuncio) => a.status === "disponivel" && !a.emPedido;

function ItemAnuncio({
  anuncio,
  chamar,
  aoMudar,
  aoExcluir,
}: {
  anuncio: Anuncio;
  chamar: ChamadaAutenticada;
  aoMudar: (a: Anuncio) => void;
  aoExcluir: (id: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const { texto, estilo } = situacao(anuncio);

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    setErro("");
    try {
      await acao();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "não deu certo. tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <li className="flex flex-col gap-4 rounded-[1.25rem] border-2 border-roxo bg-nevoa p-4 sm:flex-row">
      <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-xl border-2 border-roxo bg-nevoa-200 sm:w-28">
        {anuncio.fotos[0] ? <Image src={anuncio.fotos[0].url} alt="" fill unoptimized sizes="112px" className="object-cover" /> : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${estilo}`}>{texto}</span>
          <ConditionBadge condicao={anuncio.condicao} />
        </div>
        <h2 className="mt-2 text-lg font-semibold">{anuncio.titulo}</h2>
        <p className="mt-1 font-display text-xl font-semibold text-violeta">{formatarPreco(anuncio.precoCentavos)}</p>
        {anuncio.oculta && anuncio.motivoOculta ? <p className="mt-1 text-sm text-roxo-soft">motivo: {anuncio.motivoOculta}</p> : null}
        {!alteravel(anuncio) ? <p className="mt-2 text-sm text-roxo-soft">está num pedido ou vendido: não dá para editar, pausar ou excluir.</p> : null}
        {erro ? (
          <p role="alert" className="mt-2 text-sm font-medium text-magenta">
            {erro}
          </p>
        ) : null}
      </div>

      {alteravel(anuncio) ? (
        <div className="flex flex-wrap items-start gap-2 sm:w-56 sm:flex-col sm:items-stretch">
          {confirmando ? (
            <div role="group" aria-label={`confirmar exclusão de ${anuncio.titulo}`} className="flex w-full flex-col gap-2">
              <p className="text-sm font-semibold">excluir este anúncio?</p>
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  executar(async () => {
                    await chamar((token) => anuncios.excluir(token, anuncio.id));
                    aoExcluir(anuncio.id);
                  })
                }
                className={buttonClasses("violeta", "sm")}
              >
                sim, excluir
              </button>
              <button type="button" onClick={() => setConfirmando(false)} className={buttonClasses("nevoa", "sm")} autoFocus>
                cancelar
              </button>
            </div>
          ) : (
            <>
              <Link href={editarAnuncioUrl(anuncio.id)} className={buttonClasses("nevoa", "sm")} aria-label={`editar ${anuncio.titulo}`}>
                editar
              </Link>
              {!anuncio.oculta ? (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    executar(async () =>
                      aoMudar(await chamar((token) => (anuncio.pausada ? anuncios.reativar : anuncios.pausar)(token, anuncio.id))),
                    )
                  }
                  className={buttonClasses("nevoa", "sm")}
                  aria-label={`${anuncio.pausada ? "reativar" : "pausar"} ${anuncio.titulo}`}
                >
                  {anuncio.pausada ? "reativar" : "pausar"}
                </button>
              ) : null}
              <button type="button" onClick={() => setConfirmando(true)} className={buttonClasses("fantasma", "sm", "underline")} aria-label={`excluir ${anuncio.titulo}`}>
                excluir
              </button>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

function ListaAnuncios() {
  const sessao = useSessaoObrigatoria();
  const chamar = useChamadaAutenticada();
  const aviso = AVISOS[useSearchParams().get("aviso") ?? ""];
  const [lista, setLista] = useState<Anuncio[] | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  // carrega uma vez só: `chamar` muda quando o token é renovado
  const carregado = useRef(false);

  useEffect(() => {
    if (!sessao || carregado.current) return;
    carregado.current = true;
    chamar((token) => anuncios.meus(token)).then(setLista, (falha: Error) => setErro(falha.message));
  }, [sessao, chamar]);

  if (!sessao || (!lista && !erro)) {
    return (
      <p role="status" className="py-16 text-center text-roxo-soft">
        carregando…
      </p>
    );
  }

  return (
    <>
      <p role="status" className="sr-only">
        {mensagem}
      </p>
      {aviso ? <p className="mt-6 rounded-2xl border-2 border-roxo bg-lilas-100 px-4 py-3 text-sm font-semibold">{aviso}</p> : null}
      {erro ? (
        <p role="alert" className="mt-6 text-magenta">
          {erro}
        </p>
      ) : lista && lista.length === 0 ? (
        <div className="mt-10 rounded-[1.5rem] border-2 border-dashed border-roxo/40 p-10 text-center">
          <p className="text-lg">você ainda não anunciou nenhuma peça.</p>
          <ButtonLink href={ROUTES.anunciar} size="lg" variant="violeta" className="mt-6">
            anunciar a primeira
          </ButtonLink>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {lista!.map((a) => (
            <ItemAnuncio
              key={a.id}
              anuncio={a}
              chamar={chamar}
              aoMudar={(novo) => {
                setLista((atual) => atual!.map((x) => (x.id === novo.id ? novo : x)));
                setMensagem(`${novo.titulo}: ${situacao(novo).texto}.`);
              }}
              aoExcluir={(id) => {
                setLista((atual) => atual!.filter((x) => x.id !== id));
                setMensagem("anúncio excluído.");
              }}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/** Meus anúncios (Req. 004): a vendedora vê, edita, pausa, reativa e exclui as próprias peças. */
export default function MeusAnunciosPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading eyebrow="minha conta">meus anúncios</SectionHeading>
        <ButtonLink href={ROUTES.anunciar} variant="violeta">
          anunciar peça
        </ButtonLink>
      </div>
      <Suspense>
        <ListaAnuncios />
      </Suspense>
    </div>
  );
}
