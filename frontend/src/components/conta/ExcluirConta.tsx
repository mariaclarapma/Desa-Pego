"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { comSessao, ContaErro, excluirConta, type Sessao } from "@/lib/api/contas";
import { useSessao } from "@/lib/sessao";
import { AvisoConta } from "./AvisoConta";
import { CampoConta } from "./CampoConta";

/**
 * DELETE: excluir a conta. Primeiro pede confirmação (painel que explica o que acontece),
 * depois a senha (reautenticação). Esc ou "cancelar" fecham o painel e devolvem o foco.
 */
export function ExcluirConta({ sessao, aoExcluir }: { sessao: Sessao; aoExcluir: () => void }) {
  const definir = useSessao((s) => s.definir);
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [ciente, setCiente] = useState(false);
  const [erroSenha, setErroSenha] = useState<string>();
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const abrirRef = useRef<HTMLButtonElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const alertaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberto) tituloRef.current?.focus();
  }, [aberto]);

  function fechar() {
    setAberto(false);
    setSenha("");
    setCiente(false);
    setErroSenha(undefined);
    setErroGeral("");
    requestAnimationFrame(() => abrirRef.current?.focus());
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErroGeral("");
    if (!senha) {
      setErroSenha("informe sua senha para confirmar.");
      return document.getElementById("excluir-senha")?.focus();
    }
    setEnviando(true);
    try {
      await comSessao(sessao, (token) => excluirConta(token, senha), definir);
      aoExcluir();
    } catch (falha) {
      const erro = falha instanceof ContaErro ? falha : new ContaErro("algo deu errado. tente de novo.");
      setErroSenha(erro.campos?.senha);
      setErroGeral(erro.message);
      setSenha("");
      setEnviando(false);
      requestAnimationFrame(() => alertaRef.current?.focus());
    }
  }

  if (!aberto) {
    return (
      <button
        ref={abrirRef}
        type="button"
        onClick={() => setAberto(true)}
        aria-expanded={false}
        className={buttonClasses("perigoSuave", "md", "w-full sm:w-auto")}
      >
        excluir minha conta
      </button>
    );
  }

  return (
    <form
      onSubmit={enviar}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !enviando) fechar();
      }}
      noValidate
      aria-busy={enviando}
      aria-labelledby="excluir-titulo"
      className="space-y-5 rounded-2xl border-2 border-magenta bg-rosa-100 p-5 sm:p-6"
    >
      <h3 id="excluir-titulo" ref={tituloRef} tabIndex={-1} className="font-display text-2xl font-medium text-roxo outline-none">
        tem certeza?
      </h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-roxo">
        <li>sua conta e seus dados de acesso são apagados de vez;</li>
        <li>você sai da conta em todos os aparelhos;</li>
        <li>não dá para desfazer. para voltar, é preciso criar uma conta nova.</li>
      </ul>

      {erroGeral ? <AvisoConta ref={alertaRef} tipo="erro">{erroGeral}</AvisoConta> : null}

      <CampoConta
        id="excluir-senha"
        name="senha"
        rotulo="sua senha"
        senha
        autoComplete="current-password"
        value={senha}
        onChange={(ev) => {
          setSenha(ev.target.value);
          setErroSenha(undefined);
        }}
        erro={erroSenha}
        disabled={enviando}
        required
      />

      <label className="flex min-h-12 cursor-pointer items-start gap-3 text-sm text-roxo">
        <input
          type="checkbox"
          checked={ciente}
          onChange={(ev) => setCiente(ev.target.checked)}
          disabled={enviando}
          className="mt-0.5 size-5 shrink-0 accent-magenta"
        />
        entendo que a exclusão é definitiva.
      </label>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={fechar} disabled={enviando} className={buttonClasses("nevoa", "md", "w-full sm:w-auto")}>
          cancelar
        </button>
        <button
          type="submit"
          disabled={!ciente || enviando}
          className={buttonClasses("perigo", "md", "w-full sm:w-auto")}
        >
          {enviando ? "excluindo…" : "excluir de vez"}
        </button>
      </div>
    </form>
  );
}
