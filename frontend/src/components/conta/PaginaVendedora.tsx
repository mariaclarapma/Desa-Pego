"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { comSessao, ContaErro, lerPerfilVendedora, type PerfilVendedora, type Sessao } from "@/lib/api/contas";
import { ROUTES } from "@/lib/routes";
import { useSessao } from "@/lib/sessao";
import { useSessaoObrigatoria } from "@/lib/useSessaoObrigatoria";
import { TIPOS_CHAVE } from "@/lib/validacao-vendedora";
import { AvisoConta } from "./AvisoConta";
import { FormChavePix } from "./FormChavePix";
import { FormVendedora } from "./FormVendedora";

const CARTAO = "rounded-[1.5rem] border-2 border-roxo bg-nevoa p-5 shadow-[6px_6px_0_0_var(--color-roxo)] sm:p-8";
const TITULO_CARTAO = "font-display text-2xl font-medium tracking-[-0.02em] text-roxo";
const ROTULO = "text-xs font-bold tracking-[0.18em] text-violeta uppercase";

type Edicao = "perfil" | "pix" | null;

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Perfil de vendedora (Req. 002), rota privada: nome público, cidade e chave Pix (só mascarada).
 * Sem sessão, tenta recuperar pelo cookie; sem cookie válido, vai para o login.
 */
export function PaginaVendedora() {
  const sessao = useSessaoObrigatoria();

  if (!sessao) {
    return (
      <p role="status" className="min-h-[60vh] px-4 py-24 text-center text-roxo-soft">
        carregando seu perfil…
      </p>
    );
  }

  return (
    <section className="bg-dots">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
        <SectionHeading eyebrow="minha conta">
          perfil de <span className="text-violeta italic">vendedora</span>
        </SectionHeading>
        <p className="mt-4 text-lg text-roxo-soft">
          como você aparece na vitrine e para onde vai o dinheiro das suas vendas. sua chave Pix fica guardada com criptografia e
          só aparece aqui, mascarada.
        </p>
        <nav aria-label="atalhos da conta" className="mt-8">
          <ul className="flex flex-wrap gap-3">
            <li>
              <Link href={ROUTES.carteira} className={buttonClasses("nevoa", "md")}>
                minha carteira
              </Link>
            </li>
            <li>
              <Link href={ROUTES.conta} className={buttonClasses("fantasma", "md")}>
                voltar pra minha conta
              </Link>
            </li>
          </ul>
        </nav>
        <ConteudoVendedora sessao={sessao} />
      </div>
    </section>
  );
}

export function ConteudoVendedora({ sessao }: { sessao: Sessao }) {
  const definir = useSessao((s) => s.definir);
  const [perfil, setPerfil] = useState<PerfilVendedora | null>(null);
  const [erroCarga, setErroCarga] = useState("");
  const [editando, setEditando] = useState<Edicao>(null);
  const [aviso, setAviso] = useState("");
  const avisoRef = useRef<HTMLDivElement>(null);
  // a sessão muda quando o token é renovado; a carga usa a mais recente sem recarregar a página
  const sessaoRef = useRef(sessao);
  sessaoRef.current = sessao;

  const carregar = useCallback(async () => {
    setErroCarga("");
    try {
      setPerfil(await comSessao(sessaoRef.current, lerPerfilVendedora, definir));
    } catch (falha) {
      setErroCarga(falha instanceof ContaErro ? falha.message : "não conseguimos carregar seu perfil. tente de novo.");
    }
  }, [definir]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function abrir(edicao: Edicao) {
    setAviso("");
    setEditando(edicao);
    requestAnimationFrame(() => document.getElementById(edicao === "perfil" ? "vendedora-nomePublico" : "pix-tipo-cpf")?.focus());
  }

  function fechar(mensagem = "", novo?: PerfilVendedora) {
    const botao = editando === "perfil" ? "botao-editar-vendedora" : "botao-chave-pix";
    if (novo) setPerfil(novo);
    setEditando(null);
    setAviso(mensagem);
    requestAnimationFrame(() => (mensagem ? avisoRef.current : document.getElementById(botao))?.focus());
  }

  if (erroCarga) {
    return (
      <div className="mt-10 space-y-4">
        <AvisoConta tipo="erro">{erroCarga}</AvisoConta>
        <button type="button" onClick={() => void carregar()} className={buttonClasses("nevoa", "md")}>
          tentar de novo
        </button>
      </div>
    );
  }

  if (!perfil) {
    return (
      <p role="status" className="mt-10 text-roxo-soft">
        carregando seu perfil…
      </p>
    );
  }

  return (
    <>
      {aviso ? (
        <div className="mt-8">
          <AvisoConta ref={avisoRef} tipo="sucesso">
            {aviso}
          </AvisoConta>
        </div>
      ) : null}

      <section aria-labelledby="titulo-vitrine" className={`mt-10 ${CARTAO}`}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-vitrine" className={TITULO_CARTAO}>
            na vitrine
          </h2>
          {editando !== "perfil" ? (
            <button id="botao-editar-vendedora" type="button" onClick={() => abrir("perfil")} className={buttonClasses("nevoa", "sm")}>
              editar perfil
            </button>
          ) : null}
        </div>
        {editando === "perfil" ? (
          <FormVendedora
            sessao={sessao}
            perfil={perfil}
            aoCancelar={() => fechar()}
            aoSalvar={(novo) => fechar("seu perfil de vendedora foi atualizado.", novo)}
          />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className={ROTULO}>nome público</dt>
              <dd className="mt-1 text-lg font-medium">
                {perfil.nomeNaVitrine}
                {perfil.nomePublico ? null : <span className="block text-sm font-normal text-roxo-soft">seu primeiro nome, por enquanto</span>}
              </dd>
            </div>
            <div>
              <dt className={ROTULO}>cidade</dt>
              <dd className="mt-1 text-lg font-medium">{perfil.cidade ?? <span className="text-roxo-soft">não informada</span>}</dd>
            </div>
          </dl>
        )}
      </section>

      <section aria-labelledby="titulo-pix" className={`mt-8 ${CARTAO}`}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-pix" className={TITULO_CARTAO}>
            chave Pix
          </h2>
          {editando !== "pix" ? (
            <button id="botao-chave-pix" type="button" onClick={() => abrir("pix")} className={buttonClasses("nevoa", "sm")}>
              {perfil.pix ? "trocar chave Pix" : perfil.pixIndisponivel ? "cadastrar de novo" : "cadastrar chave Pix"}
            </button>
          ) : null}
        </div>
        {perfil.pixIndisponivel && editando !== "pix" ? (
          <div className="mb-5">
            <AvisoConta tipo="erro">
              sua chave Pix está indisponível e precisa ser cadastrada de novo. enquanto isso, não dá para publicar anúncios
              novos. use o botão &quot;cadastrar de novo&quot;: seus outros dados continuam salvos.
            </AvisoConta>
          </div>
        ) : null}
        {editando === "pix" ? (
          <FormChavePix
            sessao={sessao}
            trocando={!!perfil.pix}
            aoCancelar={() => fechar()}
            aoSalvar={(novo) => fechar(perfil.pix ? "sua chave Pix foi trocada." : "chave Pix cadastrada. você já pode anunciar suas peças.", novo)}
          />
        ) : perfil.pix ? (
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className={ROTULO}>tipo</dt>
              <dd className="mt-1 text-lg font-medium">{TIPOS_CHAVE[perfil.pix.tipo].rotulo}</dd>
            </div>
            <div>
              <dt className={ROTULO}>chave</dt>
              <dd className="mt-1 font-mono text-lg font-medium break-all">{perfil.pix.mascarada}</dd>
            </div>
            <div>
              <dt className={ROTULO}>atualizada em</dt>
              <dd className="mt-1 text-lg font-medium">{data(perfil.pix.atualizadaEm)}</dd>
            </div>
          </dl>
        ) : perfil.pixIndisponivel ? null : (
          <p className="text-roxo-soft">
            você ainda não cadastrou uma chave Pix. <strong className="text-roxo">sem ela, não dá para publicar anúncios</strong>, porque é
            para ela que vai o dinheiro das suas vendas.
          </p>
        )}
      </section>
    </>
  );
}
