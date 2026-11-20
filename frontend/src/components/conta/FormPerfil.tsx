"use client";

import { useRef, useState, type FormEvent } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { atualizarPerfil, comSessao, ContaErro, type Sessao } from "@/lib/api/contas";
import { useSessao } from "@/lib/sessao";
import { mesmoEmail, validarPerfil, type DadosPerfil, type Erros } from "@/lib/validacao-perfil";
import { AvisoConta } from "./AvisoConta";
import { CampoConta } from "./CampoConta";

const ORDEM: (keyof DadosPerfil)[] = ["nome", "email", "senhaAtual"];

/** UPDATE: edita nome e e-mail. Trocar o e-mail pede a senha atual (reautenticação). */
export function FormPerfil({ sessao, aoCancelar, aoSalvar }: { sessao: Sessao; aoCancelar: () => void; aoSalvar: () => void }) {
  const definir = useSessao((s) => s.definir);
  const { usuario } = sessao;
  const [dados, setDados] = useState<DadosPerfil>({ nome: usuario.nome, email: usuario.email, senhaAtual: "" });
  const [erros, setErros] = useState<Erros<DadosPerfil>>({});
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const alertaRef = useRef<HTMLDivElement>(null);
  const trocandoEmail = !mesmoEmail(dados.email, usuario.email);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErroGeral("");
    const encontrados = validarPerfil(dados, usuario.email);
    setErros(encontrados);
    const primeiro = ORDEM.find((c) => encontrados[c]);
    if (primeiro) return document.getElementById(`perfil-${primeiro}`)?.focus();

    setEnviando(true);
    try {
      const corpo = { nome: dados.nome.trim(), email: dados.email.trim(), ...(trocandoEmail ? { senhaAtual: dados.senhaAtual } : {}) };
      const nova = await comSessao(sessao, (token) => atualizarPerfil(token, corpo), definir);
      definir(nova);
      aoSalvar();
    } catch (falha) {
      const erro = falha instanceof ContaErro ? falha : new ContaErro("algo deu errado. tente de novo.");
      setErros((e) => ({ ...e, ...(erro.campos as Erros<DadosPerfil>) }));
      setErroGeral(erro.status === 409 ? "esse e-mail já é de outra conta." : erro.message);
      setEnviando(false);
      requestAnimationFrame(() => alertaRef.current?.focus());
    }
  }

  const campo = (nome: keyof DadosPerfil) => ({
    id: `perfil-${nome}`,
    name: nome,
    value: dados[nome],
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
      setDados((d) => ({ ...d, [nome]: ev.target.value }));
      if (erros[nome]) setErros((e) => ({ ...e, [nome]: undefined }));
    },
    erro: erros[nome],
    disabled: enviando,
  });

  return (
    <form onSubmit={enviar} noValidate aria-busy={enviando} aria-label="editar dados" className="space-y-5">
      {erroGeral ? <AvisoConta ref={alertaRef} tipo="erro">{erroGeral}</AvisoConta> : null}
      <CampoConta {...campo("nome")} rotulo="nome completo" autoComplete="name" required />
      <CampoConta {...campo("email")} rotulo="e-mail" type="email" inputMode="email" autoComplete="email" spellCheck={false} required />
      {trocandoEmail ? (
        <CampoConta
          {...campo("senhaAtual")}
          rotulo="senha atual"
          senha
          autoComplete="current-password"
          dica="por segurança, confirme sua senha para trocar o e-mail."
          required
        />
      ) : null}
      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
        <button type="button" onClick={aoCancelar} disabled={enviando} className={buttonClasses("fantasma", "md", "w-full sm:w-auto")}>
          cancelar
        </button>
        <button type="submit" disabled={enviando} className={buttonClasses("violeta", "md", "w-full sm:w-auto")}>
          {enviando ? "salvando…" : "salvar alterações"}
        </button>
      </div>
    </form>
  );
}
