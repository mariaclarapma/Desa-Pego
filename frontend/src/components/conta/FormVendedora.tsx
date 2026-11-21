"use client";

import { useRef, useState, type FormEvent } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { atualizarPerfilVendedora, comSessao, ContaErro, type PerfilVendedora, type Sessao } from "@/lib/api/contas";
import { useSessao } from "@/lib/sessao";
import { validarVendedora, type DadosVendedora, type Erros } from "@/lib/validacao-vendedora";
import { AvisoConta } from "./AvisoConta";
import { CampoConta } from "./CampoConta";

const ORDEM: (keyof DadosVendedora)[] = ["nomePublico", "cidade"];

/** UPDATE (Req. 002): nome público e cidade da vendedora. */
export function FormVendedora({
  sessao,
  perfil,
  aoCancelar,
  aoSalvar,
}: {
  sessao: Sessao;
  perfil: PerfilVendedora;
  aoCancelar: () => void;
  aoSalvar: (perfil: PerfilVendedora) => void;
}) {
  const definir = useSessao((s) => s.definir);
  const [dados, setDados] = useState<DadosVendedora>({ nomePublico: perfil.nomePublico ?? "", cidade: perfil.cidade ?? "" });
  const [erros, setErros] = useState<Erros<DadosVendedora>>({});
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const alertaRef = useRef<HTMLDivElement>(null);
  const primeiroNome = sessao.usuario.nome.trim().split(/\s+/)[0];

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErroGeral("");
    const encontrados = validarVendedora(dados);
    setErros(encontrados);
    const primeiro = ORDEM.find((c) => encontrados[c]);
    if (primeiro) return document.getElementById(`vendedora-${primeiro}`)?.focus();

    setEnviando(true);
    try {
      const corpo = { nomePublico: dados.nomePublico.trim(), cidade: dados.cidade.trim() };
      aoSalvar(await comSessao(sessao, (token) => atualizarPerfilVendedora(token, corpo), definir));
    } catch (falha) {
      const erro = falha instanceof ContaErro ? falha : new ContaErro("algo deu errado. tente de novo.");
      setErros((e) => ({ ...e, ...(erro.campos as Erros<DadosVendedora>) }));
      setErroGeral(erro.message);
      setEnviando(false);
      requestAnimationFrame(() => alertaRef.current?.focus());
    }
  }

  const campo = (nome: keyof DadosVendedora) => ({
    id: `vendedora-${nome}`,
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
    <form onSubmit={enviar} noValidate aria-busy={enviando} aria-label="editar perfil na vitrine" className="space-y-5">
      {erroGeral ? (
        <AvisoConta ref={alertaRef} tipo="erro">
          {erroGeral}
        </AvisoConta>
      ) : null}
      <CampoConta
        {...campo("nomePublico")}
        rotulo="nome público (opcional)"
        autoComplete="off"
        maxLength={40}
        dica={`é o nome que aparece nos seus anúncios. se deixar vazio, mostramos "${primeiroNome}". não coloque CPF nem documentos.`}
      />
      <CampoConta {...campo("cidade")} rotulo="cidade" autoComplete="address-level2" maxLength={60} dica="ex.: Brasília/DF" required />
      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
        <button type="button" onClick={aoCancelar} disabled={enviando} className={buttonClasses("fantasma", "md", "w-full sm:w-auto")}>
          cancelar
        </button>
        <button type="submit" disabled={enviando} className={buttonClasses("violeta", "md", "w-full sm:w-auto")}>
          {enviando ? "salvando…" : "salvar perfil"}
        </button>
      </div>
    </form>
  );
}
