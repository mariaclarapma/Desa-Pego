"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AvisoConta } from "@/components/conta/AvisoConta";
import { ExcluirConta } from "@/components/conta/ExcluirConta";
import { FormPerfil } from "@/components/conta/FormPerfil";
import { FormSenha } from "@/components/conta/FormSenha";
import { buttonClasses, ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { renovarSessao, sair } from "@/lib/api/contas";
import { catalogoUrl, ROUTES } from "@/lib/routes";
import { useSessao } from "@/lib/sessao";

const CARTAO = "rounded-[1.5rem] border-2 border-roxo bg-nevoa p-5 shadow-[6px_6px_0_0_var(--color-roxo)] sm:p-8";
const TITULO_CARTAO = "font-display text-2xl font-medium tracking-[-0.02em] text-roxo";

type Edicao = "perfil" | "senha" | null;

/**
 * Área da conta (rota privada): ver os dados (READ), editar nome e e-mail, trocar a senha (UPDATE)
 * e excluir a conta (DELETE). Sem sessão na memória, tenta recuperar pelo cookie; sem cookie
 * válido, vai para o login.
 */
export default function ContaPage() {
  const router = useRouter();
  const sessao = useSessao((s) => s.sessao);
  const definir = useSessao((s) => s.definir);
  const [saindo, setSaindo] = useState(false);
  const [editando, setEditando] = useState<Edicao>(null);
  const [aviso, setAviso] = useState("");
  const [excluida, setExcluida] = useState(false);
  // tenta recuperar a sessão uma única vez ao abrir a página (e nunca depois de sair)
  const jaTentou = useRef(false);
  const avisoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessao || jaTentou.current) return;
    jaTentou.current = true;
    renovarSessao()
      .then(definir)
      .catch(() => router.replace(ROUTES.entrar));
  }, [sessao, definir, router]);

  async function encerrar() {
    jaTentou.current = true;
    setSaindo(true);
    await sair().catch(() => undefined);
    definir(null);
    router.replace(ROUTES.entrar);
  }

  function abrir(edicao: Edicao) {
    setAviso("");
    setEditando(edicao);
    // leva o foco ao primeiro campo do formulário aberto
    requestAnimationFrame(() => document.getElementById(edicao === "perfil" ? "perfil-nome" : "senha-senhaAtual")?.focus());
  }

  function fechar(mensagem = "") {
    const botao = editando === "perfil" ? "botao-editar-perfil" : "botao-alterar-senha";
    setEditando(null);
    setAviso(mensagem);
    requestAnimationFrame(() => (mensagem ? avisoRef.current : document.getElementById(botao))?.focus());
  }

  function contaExcluida() {
    jaTentou.current = true;
    setExcluida(true);
    definir(null);
  }

  if (excluida) {
    return (
      <section className="bg-dots">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
          <SectionHeading eyebrow="conta excluída">
            até a <span className="text-violeta italic">próxima</span>
          </SectionHeading>
          <p role="status" className="mt-6 text-lg text-roxo-soft">
            sua conta foi excluída e você saiu de todos os aparelhos.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <ButtonLink href={ROUTES.home} variant="violeta" size="lg">
              voltar pro início
            </ButtonLink>
            <ButtonLink href={ROUTES.cadastro} variant="nevoa" size="lg">
              criar outra conta
            </ButtonLink>
          </div>
        </div>
      </section>
    );
  }

  if (!sessao) {
    return (
      <p role="status" className="min-h-[60vh] px-4 py-24 text-center text-roxo-soft">
        carregando sua conta…
      </p>
    );
  }

  const { usuario } = sessao;
  return (
    <section className="bg-dots">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
        <SectionHeading eyebrow="minha conta">
          olá, <span className="text-violeta italic">{usuario.nome.split(" ")[0]}</span>
        </SectionHeading>

        {aviso ? (
          <div className="mt-8">
            <AvisoConta ref={avisoRef} tipo="sucesso">
              {aviso}
            </AvisoConta>
          </div>
        ) : null}

        {/* READ e UPDATE: dados da conta */}
        <section aria-labelledby="titulo-dados" className={`mt-10 ${CARTAO}`}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 id="titulo-dados" className={TITULO_CARTAO}>
              seus dados
            </h2>
            {editando !== "perfil" ? (
              <button
                id="botao-editar-perfil"
                type="button"
                onClick={() => abrir("perfil")}
                className={buttonClasses("nevoa", "sm")}
              >
                editar dados
              </button>
            ) : null}
          </div>

          {editando === "perfil" ? (
            <FormPerfil sessao={sessao} aoCancelar={() => fechar()} aoSalvar={() => fechar("seus dados foram atualizados.")} />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold tracking-[0.18em] text-violeta uppercase">nome</dt>
                <dd className="mt-1 text-lg font-medium">{usuario.nome}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-[0.18em] text-violeta uppercase">e-mail</dt>
                <dd className="mt-1 text-lg font-medium break-all">{usuario.email}</dd>
              </div>
            </dl>
          )}
        </section>

        {/* UPDATE: senha */}
        <section aria-labelledby="titulo-senha" className={`mt-8 ${CARTAO}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 id="titulo-senha" className={TITULO_CARTAO}>
              senha
            </h2>
            {editando !== "senha" ? (
              <button
                id="botao-alterar-senha"
                type="button"
                onClick={() => abrir("senha")}
                className={buttonClasses("nevoa", "sm")}
              >
                alterar senha
              </button>
            ) : null}
          </div>
          {editando === "senha" ? (
            <div className="mt-4">
              <FormSenha
                sessao={sessao}
                aoCancelar={() => fechar()}
                aoSalvar={() => fechar("senha alterada. você saiu da conta nos outros aparelhos.")}
              />
            </div>
          ) : (
            <p className="text-roxo-soft">use uma senha forte, que você não usa em outros sites.</p>
          )}
        </section>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <ButtonLink href={ROUTES.minhasCompras} variant="violeta" size="lg">
            minhas compras
          </ButtonLink>
          <ButtonLink href={ROUTES.minhasVendas} variant="nevoa" size="lg">
            minhas vendas
          </ButtonLink>
          <ButtonLink href={ROUTES.carteira} variant="nevoa" size="lg">
            minha carteira
          </ButtonLink>
          <ButtonLink href={ROUTES.vendedora} variant="nevoa" size="lg">
            perfil de vendedora
          </ButtonLink>
          <ButtonLink href={catalogoUrl()} variant="nevoa" size="lg">
            ir pra vitrine
          </ButtonLink>
          {/* só esconde o atalho: quem barra o acesso ao painel é o backend (403) */}
          {usuario.perfil === "ADMIN_MASTER" ? (
            <ButtonLink href={ROUTES.admin} variant="nevoa" size="lg">
              painel da administração
            </ButtonLink>
          ) : null}
          <button type="button" onClick={encerrar} disabled={saindo} className={buttonClasses("nevoa", "lg")}>
            {saindo ? "saindo…" : "sair da conta"}
          </button>
        </div>

        {/* DELETE: zona de perigo */}
        <section aria-labelledby="titulo-excluir" className="mt-14 border-t-2 border-dashed border-roxo/30 pt-8">
          <h2 id="titulo-excluir" className={TITULO_CARTAO}>
            excluir conta
          </h2>
          <p className="mt-2 mb-5 text-roxo-soft">apaga sua conta de vez. pedimos sua senha para confirmar.</p>
          <ExcluirConta sessao={sessao} aoExcluir={contaExcluida} />
        </section>
      </div>
    </section>
  );
}
