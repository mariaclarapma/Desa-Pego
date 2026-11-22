"use client";

import { useRef, useState, type FormEvent } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { IconAlerta } from "@/components/ui/icons";
import { comSessao, ContaErro, salvarChavePix, type PerfilVendedora, type Sessao, type TipoChavePix } from "@/lib/api/contas";
import { useSessao } from "@/lib/sessao";
import { TIPOS_CHAVE, validarChavePix, type DadosChavePix, type Erros } from "@/lib/validacao-vendedora";
import { AvisoConta } from "./AvisoConta";
import { CampoConta } from "./CampoConta";

const ORDEM: (keyof DadosChavePix)[] = ["tipo", "chave", "senhaAtual"];

/**
 * UPDATE (Req. 002): cadastra ou troca a chave Pix. Pede a senha atual, porque trocar a chave
 * muda para onde vai o dinheiro das vendas. A chave digitada não fica guardada no navegador.
 */
export function FormChavePix({
  sessao,
  trocando,
  aoCancelar,
  aoSalvar,
}: {
  sessao: Sessao;
  /** Já existe uma chave: o texto fala em "trocar". */
  trocando: boolean;
  aoCancelar: () => void;
  aoSalvar: (perfil: PerfilVendedora) => void;
}) {
  const definir = useSessao((s) => s.definir);
  const [dados, setDados] = useState<DadosChavePix>({ tipo: "", chave: "", senhaAtual: "" });
  const [erros, setErros] = useState<Erros<DadosChavePix>>({});
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const alertaRef = useRef<HTMLDivElement>(null);
  const tipo = dados.tipo ? TIPOS_CHAVE[dados.tipo] : null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErroGeral("");
    const encontrados = validarChavePix(dados);
    setErros(encontrados);
    const primeiro = ORDEM.find((c) => encontrados[c]);
    if (primeiro) return document.getElementById(primeiro === "tipo" ? "pix-tipo-cpf" : `pix-${primeiro}`)?.focus();

    setEnviando(true);
    try {
      const corpo = { tipo: dados.tipo as TipoChavePix, chave: dados.chave.trim(), senhaAtual: dados.senhaAtual };
      const resposta = await comSessao(sessao, (token) => salvarChavePix(token, corpo), definir);
      // token novo com a chave cadastrada: já libera a publicação de anúncios
      definir({ ...(useSessao.getState().sessao ?? sessao), accessToken: resposta.accessToken, expiraEm: resposta.expiraEm });
      aoSalvar(resposta.vendedora);
    } catch (falha) {
      const erro = falha instanceof ContaErro ? falha : new ContaErro("algo deu errado. tente de novo.");
      setErros((e) => ({ ...e, ...(erro.campos as Erros<DadosChavePix>) }));
      setErroGeral(erro.message);
      // a senha errada nunca fica no campo
      if (erro.status === 403) setDados((d) => ({ ...d, senhaAtual: "" }));
      setEnviando(false);
      requestAnimationFrame(() => alertaRef.current?.focus());
    }
  }

  const mudar = (nome: keyof DadosChavePix, valor: string) => {
    setDados((d) => ({ ...d, [nome]: valor }));
    if (erros[nome]) setErros((e) => ({ ...e, [nome]: undefined }));
  };

  return (
    <form onSubmit={enviar} noValidate aria-busy={enviando} aria-label={trocando ? "trocar chave Pix" : "cadastrar chave Pix"} className="space-y-5">
      {erroGeral ? (
        <AvisoConta ref={alertaRef} tipo="erro">
          {erroGeral}
        </AvisoConta>
      ) : null}

      <fieldset aria-describedby={erros.tipo ? "pix-tipo-erro" : undefined} aria-invalid={erros.tipo ? true : undefined}>
        <legend className="mb-1.5 block text-sm font-semibold text-roxo">tipo da chave</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TIPOS_CHAVE) as TipoChavePix[]).map((t) => (
            <label
              key={t}
              htmlFor={`pix-tipo-${t}`}
              className={`flex cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors has-[:focus-visible]:shadow-[3px_3px_0_0_var(--color-rosa)] ${
                dados.tipo === t ? "border-roxo bg-lilas-100 text-roxo" : "border-roxo/40 bg-white/70 text-roxo hover:border-roxo"
              }`}
            >
              <input
                id={`pix-tipo-${t}`}
                type="radio"
                name="tipo"
                value={t}
                checked={dados.tipo === t}
                onChange={() => mudar("tipo", t)}
                disabled={enviando}
                className="accent-violeta"
              />
              {TIPOS_CHAVE[t].rotulo}
            </label>
          ))}
        </div>
        {erros.tipo ? (
          <p id="pix-tipo-erro" className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-magenta">
            <IconAlerta size={16} className="mt-0.5 shrink-0" />
            {erros.tipo}
          </p>
        ) : null}
      </fieldset>

      <CampoConta
        id="pix-chave"
        name="chave"
        rotulo={tipo ? `chave Pix (${tipo.rotulo})` : "chave Pix"}
        value={dados.chave}
        onChange={(ev) => mudar("chave", ev.target.value)}
        erro={erros.chave}
        disabled={enviando}
        inputMode={tipo?.inputMode ?? "text"}
        placeholder={tipo?.exemplo}
        autoComplete="off"
        spellCheck={false}
        maxLength={120}
        dica="é para essa chave que vamos fazer o repasse das suas vendas. confira com cuidado."
        required
      />
      <CampoConta
        id="pix-senhaAtual"
        name="senhaAtual"
        rotulo="senha atual"
        senha
        value={dados.senhaAtual}
        onChange={(ev) => mudar("senhaAtual", ev.target.value)}
        erro={erros.senhaAtual}
        disabled={enviando}
        autoComplete="current-password"
        dica="por segurança, confirme sua senha para salvar a chave Pix."
        required
      />
      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
        <button type="button" onClick={aoCancelar} disabled={enviando} className={buttonClasses("fantasma", "md", "w-full sm:w-auto")}>
          cancelar
        </button>
        <button type="submit" disabled={enviando} className={buttonClasses("violeta", "md", "w-full sm:w-auto")}>
          {enviando ? "salvando…" : trocando ? "trocar chave Pix" : "cadastrar chave Pix"}
        </button>
      </div>
    </form>
  );
}
