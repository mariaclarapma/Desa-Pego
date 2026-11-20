"use client";

import { useRef, useState, type FormEvent } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { alterarSenha, comSessao, ContaErro, type Sessao } from "@/lib/api/contas";
import { useSessao } from "@/lib/sessao";
import { SENHA_MINIMO } from "@/lib/validacao-conta";
import { validarTrocaSenha, type DadosSenha, type Erros } from "@/lib/validacao-perfil";
import { AvisoConta } from "./AvisoConta";
import { CampoConta } from "./CampoConta";

const VAZIO: DadosSenha = { senhaAtual: "", novaSenha: "", confirmarSenha: "" };
const ORDEM: (keyof DadosSenha)[] = ["senhaAtual", "novaSenha", "confirmarSenha"];

/** UPDATE: troca a senha conferindo a atual. As sessões em outros aparelhos são encerradas. */
export function FormSenha({ sessao, aoCancelar, aoSalvar }: { sessao: Sessao; aoCancelar: () => void; aoSalvar: () => void }) {
  const definir = useSessao((s) => s.definir);
  const [dados, setDados] = useState<DadosSenha>(VAZIO);
  const [erros, setErros] = useState<Erros<DadosSenha>>({});
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const alertaRef = useRef<HTMLDivElement>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErroGeral("");
    const encontrados = validarTrocaSenha(dados);
    setErros(encontrados);
    const primeiro = ORDEM.find((c) => encontrados[c]);
    if (primeiro) return document.getElementById(`senha-${primeiro}`)?.focus();

    setEnviando(true);
    try {
      const nova = await comSessao(sessao, (token) => alterarSenha(token, dados.senhaAtual, dados.novaSenha), definir);
      definir(nova);
      aoSalvar();
    } catch (falha) {
      const erro = falha instanceof ContaErro ? falha : new ContaErro("algo deu errado. tente de novo.");
      setErros((e) => ({ ...e, ...(erro.campos as Erros<DadosSenha>) }));
      setErroGeral(erro.message);
      setDados((d) => ({ ...d, senhaAtual: "" }));
      setEnviando(false);
      requestAnimationFrame(() => alertaRef.current?.focus());
    }
  }

  const campo = (nome: keyof DadosSenha) => ({
    id: `senha-${nome}`,
    name: nome,
    value: dados[nome],
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
      setDados((d) => ({ ...d, [nome]: ev.target.value }));
      if (erros[nome]) setErros((e) => ({ ...e, [nome]: undefined }));
    },
    erro: erros[nome],
    disabled: enviando,
    required: true,
    senha: true,
  });

  return (
    <form onSubmit={enviar} noValidate aria-busy={enviando} aria-label="alterar senha" className="space-y-5">
      {erroGeral ? <AvisoConta ref={alertaRef} tipo="erro">{erroGeral}</AvisoConta> : null}
      <CampoConta {...campo("senhaAtual")} rotulo="senha atual" autoComplete="current-password" />
      <CampoConta
        {...campo("novaSenha")}
        rotulo="nova senha"
        autoComplete="new-password"
        dica={`pelo menos ${SENHA_MINIMO} caracteres, com letra e número.`}
      />
      <CampoConta {...campo("confirmarSenha")} rotulo="confirmar nova senha" autoComplete="new-password" />
      <p className="text-sm text-roxo-soft">ao trocar a senha, você sai da conta nos outros aparelhos.</p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={aoCancelar} disabled={enviando} className={buttonClasses("fantasma", "md", "w-full sm:w-auto")}>
          cancelar
        </button>
        <button type="submit" disabled={enviando} className={buttonClasses("violeta", "md", "w-full sm:w-auto")}>
          {enviando ? "trocando…" : "trocar senha"}
        </button>
      </div>
    </form>
  );
}
