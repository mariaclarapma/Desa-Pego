"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Tape } from "@/components/ui/Sticker";
import { buttonClasses } from "@/components/ui/Button";
import { IconAlerta } from "@/components/ui/icons";
import { IMAGENS_HOME } from "@/data/demo/imagens";
import { cadastrar, ContaErro, entrar } from "@/lib/api/contas";
import { ROUTES } from "@/lib/routes";
import { useSessao } from "@/lib/sessao";
import {
  CAMPOS,
  mascararCpf,
  SENHA_MINIMO,
  validarCampo,
  validarConta,
  type DadosConta,
  type ErrosConta,
  type ModoConta,
} from "@/lib/validacao-conta";
import { CampoConta } from "./CampoConta";

const TEXTOS: Record<ModoConta, { titulo: [string, string]; apoio: string; h1: string; botao: string; enviando: string; aba: string }> = {
  entrar: {
    titulo: ["que bom te ver ", "de novo"],
    apoio: "entre para acompanhar suas compras, seus anúncios e sua carteira.",
    h1: "entrar",
    botao: "entrar",
    enviando: "entrando…",
    aba: "entrar · desaPego",
  },
  cadastro: {
    titulo: ["boas-vindas ao ", "desaPego"],
    apoio: "crie sua conta para garimpar peças únicas e desapegar das suas.",
    h1: "criar conta",
    botao: "criar minha conta",
    enviando: "criando sua conta…",
    aba: "criar conta · desaPego",
  },
};

const VAZIO: DadosConta = { nome: "", email: "", cpf: "", senha: "", confirmarSenha: "" };

/** Login e cadastro na mesma tela (Req. 001), alternando sem recarregar a página. */
export function PaginaConta({ modoInicial }: { modoInicial: ModoConta }) {
  const router = useRouter();
  const definirSessao = useSessao((s) => s.definir);
  const [modo, setModo] = useState<ModoConta>(modoInicial);
  const [dados, setDados] = useState<DadosConta>(VAZIO);
  const [erros, setErros] = useState<ErrosConta>({});
  const [tocados, setTocados] = useState<Partial<Record<keyof DadosConta, boolean>>>({});
  const [enviando, setEnviando] = useState(false);
  const [erroGeral, setErroGeral] = useState("");
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const alertaRef = useRef<HTMLDivElement>(null);
  const texto = TEXTOS[modo];

  useEffect(() => {
    document.title = texto.aba;
  }, [texto.aba]);

  function trocarModo(novo: ModoConta, focarTitulo = true) {
    if (novo === modo) return;
    setModo(novo);
    // mantém o e-mail digitado; limpa senhas e erros
    setDados((d) => ({ ...VAZIO, email: d.email }));
    setErros({});
    setTocados({});
    setErroGeral("");
    window.history.replaceState(null, "", novo === "entrar" ? ROUTES.entrar : ROUTES.cadastro);
    if (focarTitulo) requestAnimationFrame(() => tituloRef.current?.focus());
  }

  function mudar(campo: keyof DadosConta, bruto: string) {
    const valor = campo === "cpf" ? mascararCpf(bruto) : bruto;
    const novos = { ...dados, [campo]: valor };
    setDados(novos);
    // depois que o campo foi visitado, revalida enquanto a pessoa digita
    if (tocados[campo] || erros[campo]) setErros((e) => ({ ...e, [campo]: validarCampo(campo, novos, modo) }));
    if (campo === "senha" && (tocados.confirmarSenha || erros.confirmarSenha)) {
      setErros((e) => ({ ...e, confirmarSenha: validarCampo("confirmarSenha", novos, modo) }));
    }
  }

  function sair(campo: keyof DadosConta) {
    setTocados((t) => ({ ...t, [campo]: true }));
    if (dados[campo]) setErros((e) => ({ ...e, [campo]: validarCampo(campo, dados, modo) }));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErroGeral("");
    const encontrados = validarConta(dados, modo);
    setErros(encontrados);
    setTocados(Object.fromEntries(CAMPOS[modo].map((c) => [c, true])));
    const primeiro = CAMPOS[modo].find((c) => encontrados[c]);
    if (primeiro) {
      document.getElementById(`conta-${primeiro}`)?.focus();
      return;
    }

    setEnviando(true);
    try {
      const sessao =
        modo === "entrar"
          ? await entrar(dados.email.trim(), dados.senha)
          : await cadastrar(dados.nome.trim(), dados.email.trim(), dados.cpf, dados.senha);
      definirSessao(sessao);
      router.push(ROUTES.conta);
    } catch (falha) {
      setErroGeral(falha instanceof ContaErro ? falha.message : "algo deu errado. tente de novo.");
      // erro de um campo vindo do backend (ex.: CPF já cadastrado): mostra também ao lado do campo
      const doBackend = falha instanceof ContaErro ? falha.campos : undefined;
      const camposComErro = CAMPOS[modo].filter((c) => doBackend?.[c]);
      if (camposComErro.length) {
        setErros((e) => ({ ...e, ...Object.fromEntries(camposComErro.map((c) => [c, doBackend![c]])) }));
      }
      setEnviando(false);
      requestAnimationFrame(() => alertaRef.current?.focus());
    }
  }

  const campo = (nome: keyof DadosConta) => ({
    id: `conta-${nome}`,
    name: nome,
    value: dados[nome],
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => mudar(nome, ev.target.value),
    onBlur: () => sair(nome),
    erro: tocados[nome] ? erros[nome] : undefined,
    required: true,
    disabled: enviando,
  });

  return (
    <div className="grid lg:min-h-[calc(100dvh-7.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* lado esquerdo: apresentação */}
      <div className="paleta-marca relative overflow-hidden bg-roxo text-nevoa">
        <div className="mx-auto flex h-full max-w-xl flex-col justify-center gap-10 px-6 py-10 sm:px-10 lg:py-16">
          <div>
            <p className="font-display text-[2.6rem] leading-[0.95] font-medium tracking-[-0.04em] text-balance sm:text-5xl lg:text-6xl">
              {texto.titulo[0]}
              <span className="text-rosa italic">{texto.titulo[1]}</span>
            </p>
            <p className="mt-5 max-w-sm text-lg text-nevoa/80">{texto.apoio}</p>
          </div>

          <div aria-hidden="true" className="relative mx-auto hidden w-full max-w-[19rem] lg:block">
            <Tape className="-top-3 left-1/2 -translate-x-1/2 -rotate-3" />
            <div className="shape-arch relative aspect-[3/4] overflow-hidden border-2 border-nevoa shadow-[10px_10px_0_0_var(--color-rosa)]">
              <Image src={IMAGENS_HOME.arara.src} alt="" fill priority sizes="19rem" className="object-cover" />
            </div>
          </div>
        </div>
      </div>

      {/* lado direito: autenticação */}
      <section aria-labelledby="conta-titulo" className="bg-dots flex items-center justify-center px-4 py-10 sm:px-8 lg:py-16">
        <div className="w-full max-w-md">
          <div
            role="tablist"
            aria-label="entrar ou criar conta"
            className="mb-8 grid grid-cols-2 rounded-full border-2 border-roxo bg-nevoa p-1"
            onKeyDown={(e) => {
              // abas: setas (e Home/End) trocam entre entrar e criar conta
              const proximo: ModoConta | null =
                e.key === "ArrowRight" || e.key === "End" ? "cadastro" : e.key === "ArrowLeft" || e.key === "Home" ? "entrar" : null;
              if (!proximo) return;
              e.preventDefault();
              trocarModo(proximo, false);
              document.getElementById(`aba-${proximo}`)?.focus();
            }}
          >
            {(["entrar", "cadastro"] as const).map((m) => (
              <button
                key={m}
                id={`aba-${m}`}
                type="button"
                role="tab"
                aria-selected={modo === m}
                aria-controls="conta-formulario"
                tabIndex={modo === m ? 0 : -1}
                onClick={() => trocarModo(m)}
                className="rounded-full py-2 text-sm font-semibold text-roxo transition-colors hover:bg-rosa-100 aria-selected:bg-roxo aria-selected:text-nevoa aria-selected:hover:bg-roxo"
              >
                {m === "entrar" ? "entrar" : "criar conta"}
              </button>
            ))}
          </div>

          <form
            id="conta-formulario"
            role="tabpanel"
            aria-labelledby={`aba-${modo}`}
            onSubmit={enviar}
            noValidate
            aria-busy={enviando}
            className="rounded-[1.5rem] border-2 border-roxo bg-nevoa p-6 shadow-[6px_6px_0_0_var(--color-roxo)] sm:p-8"
          >
            <h1
              id="conta-titulo"
              ref={tituloRef}
              tabIndex={-1}
              className="font-display text-4xl font-medium tracking-[-0.03em] text-roxo outline-none"
            >
              {texto.h1}
            </h1>

            {erroGeral ? (
              <div
                ref={alertaRef}
                role="alert"
                tabIndex={-1}
                className="mt-5 flex gap-2.5 rounded-2xl border-2 border-magenta bg-rosa-100 p-4 text-sm text-roxo outline-none"
              >
                <IconAlerta size={18} className="mt-0.5 shrink-0 text-magenta" />
                <p>{erroGeral}</p>
              </div>
            ) : null}

            <div className="mt-6 space-y-5">
              {modo === "cadastro" ? <CampoConta {...campo("nome")} rotulo="nome completo" autoComplete="name" /> : null}
              <CampoConta {...campo("email")} rotulo="e-mail" type="email" inputMode="email" autoComplete="email" spellCheck={false} />
              {modo === "cadastro" ? (
                <CampoConta
                  {...campo("cpf")}
                  rotulo="CPF"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={14}
                  placeholder="000.000.000-00"
                  dica="só os números; a pontuação entra sozinha. guardamos seu CPF protegido e ele não aparece no seu perfil."
                />
              ) : null}
              <CampoConta
                {...campo("senha")}
                rotulo="senha"
                senha
                autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                dica={modo === "cadastro" ? `pelo menos ${SENHA_MINIMO} caracteres, com letra e número.` : undefined}
              />
              {modo === "cadastro" ? (
                <CampoConta {...campo("confirmarSenha")} rotulo="confirmar senha" senha autoComplete="new-password" />
              ) : null}
            </div>

            {modo === "entrar" ? (
              <p className="mt-3 text-right">
                <Link href={ROUTES.recuperarSenha} className="text-sm font-semibold text-violeta underline-offset-4 hover:underline">
                  esqueci minha senha
                </Link>
              </p>
            ) : null}

            <button type="submit" disabled={enviando} className={buttonClasses("violeta", "lg", "mt-7 w-full")}>
              {enviando ? (
                <>
                  <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {texto.enviando}
                </>
              ) : (
                texto.botao
              )}
            </button>

            <p className="mt-6 text-center text-sm text-roxo-soft">
              {modo === "entrar" ? "ainda não tem conta? " : "já tem uma conta? "}
              <button
                type="button"
                onClick={() => trocarModo(modo === "entrar" ? "cadastro" : "entrar")}
                className="font-semibold text-violeta underline underline-offset-4 hover:text-roxo"
              >
                {modo === "entrar" ? "criar conta" : "entrar"}
              </button>
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
