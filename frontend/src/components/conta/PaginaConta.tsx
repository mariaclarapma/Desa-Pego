"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { IconAlerta, IconArrowRight, IconCadeado, IconEnvelope, IconUser } from "@/components/ui/icons";
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
import { ArteArara } from "./ArteArara";
import { CampoConta } from "./CampoConta";

const TEXTOS: Record<
  ModoConta,
  { titulo: [string, string]; apoio: string; h1: string; aba: string; botao: string; enviando: string; tituloAba: string }
> = {
  entrar: {
    titulo: ["que bom te ver ", "de novo!"],
    apoio: "entre na sua conta e continue de onde seu garimpo parou.",
    h1: "entrar",
    aba: "já tenho conta",
    botao: "entrar na minha conta",
    enviando: "entrando…",
    tituloAba: "entrar · desaPego",
  },
  cadastro: {
    titulo: ["boas-vindas ao ", "desaPego!"],
    apoio: "crie sua conta para garimpar peças únicas e desapegar das suas.",
    h1: "criar conta",
    aba: "criar minha conta",
    botao: "criar minha conta",
    enviando: "criando sua conta…",
    tituloAba: "criar conta · desaPego",
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
    document.title = texto.tituloAba;
  }, [texto.tituloAba]);

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
    <div className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-br from-rosa-100/80 via-nevoa to-lilas-100/70" />
      <div aria-hidden="true" className="bg-dots absolute inset-0 -z-10 opacity-80" />

      <div className="mx-auto grid max-w-7xl gap-x-12 gap-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:px-10 lg:py-12 xl:gap-x-20">
        {/* apresentação */}
        <div className="lg:col-start-1 lg:row-start-1 lg:pl-6">
          <p className="mt-2 font-display text-[2.6rem] leading-[0.98] font-semibold tracking-[-0.035em] text-roxo sm:text-6xl lg:text-[4.1rem]">
            <span className="block">{texto.titulo[0]}</span>
            <span className="block text-violeta italic">{texto.titulo[1]}</span>
          </p>
          <p className="mt-4 max-w-sm text-base text-roxo-soft sm:text-lg">{texto.apoio}</p>
        </div>

        {/* autenticação */}
        <section
          aria-labelledby="conta-titulo"
          className="w-full max-w-xl justify-self-center lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center"
        >
          <div className="rounded-[2rem] border border-roxo/10 bg-white/90 p-5 shadow-[0_30px_70px_-35px_color-mix(in_srgb,var(--color-roxo)_55%,transparent)] backdrop-blur-sm sm:p-8 lg:p-10">
            <div
              role="tablist"
              aria-label="entrar ou criar conta"
              className="grid grid-cols-2 gap-1 rounded-full bg-nevoa-200/80 p-1.5 shadow-[inset_0_1px_3px_color-mix(in_srgb,var(--color-roxo)_12%,transparent)]"
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
                  className="rounded-full px-2 py-3 text-sm font-semibold text-roxo transition-[background-color,color,box-shadow] duration-200 hover:bg-white/80 aria-selected:bg-roxo aria-selected:text-nevoa aria-selected:shadow-[0_8px_16px_-8px_color-mix(in_srgb,var(--color-roxo)_80%,transparent)] aria-selected:hover:bg-roxo sm:text-base"
                >
                  {TEXTOS[m].aba}
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
              className="mt-7"
            >
              <h1 id="conta-titulo" ref={tituloRef} tabIndex={-1} className="mb-5 font-display text-3xl font-semibold text-roxo sm:text-4xl">
                {texto.h1}
              </h1>

              {erroGeral ? (
                <div
                  ref={alertaRef}
                  role="alert"
                  tabIndex={-1}
                  className="mb-5 flex gap-2.5 rounded-2xl border-2 border-magenta bg-rosa-100 p-4 text-sm text-roxo outline-none"
                >
                  <IconAlerta size={18} className="mt-0.5 shrink-0 text-magenta" />
                  <p>{erroGeral}</p>
                </div>
              ) : null}

              <div className="space-y-5">
                {modo === "cadastro" ? (
                  <CampoConta
                    {...campo("nome")}
                    rotulo="nome completo"
                    autoComplete="name"
                    estilo="editorial"
                    icone={<IconUser size={20} />}
                    placeholder="seu nome e sobrenome"
                  />
                ) : null}
                <CampoConta
                  {...campo("email")}
                  rotulo="e-mail"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  estilo="editorial"
                  icone={<IconEnvelope size={20} />}
                  placeholder="seuemail@exemplo.com"
                />
                {modo === "cadastro" ? (
                  <CampoConta
                    {...campo("cpf")}
                    rotulo="CPF"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={14}
                    placeholder="000.000.000-00"
                    estilo="editorial"
                    dica="só os números; a pontuação entra sozinha. guardamos seu CPF protegido e ele não aparece no seu perfil."
                  />
                ) : null}
                <CampoConta
                  {...campo("senha")}
                  rotulo="senha"
                  senha
                  autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                  estilo="editorial"
                  icone={<IconCadeado size={20} />}
                  placeholder={modo === "entrar" ? "digite sua senha" : "crie uma senha"}
                  dica={modo === "cadastro" ? `pelo menos ${SENHA_MINIMO} caracteres, com letra e número.` : undefined}
                />
                {modo === "cadastro" ? (
                  <CampoConta
                    {...campo("confirmarSenha")}
                    rotulo="confirmar senha"
                    senha
                    autoComplete="new-password"
                    estilo="editorial"
                    icone={<IconCadeado size={20} />}
                    placeholder="repita a senha"
                  />
                ) : null}
              </div>

              {modo === "entrar" ? (
                <p className="mt-3 text-right">
                  <Link href={ROUTES.recuperarSenha} className="text-sm font-semibold text-violeta underline underline-offset-4 hover:text-roxo">
                    esqueci minha senha
                  </Link>
                </p>
              ) : null}

              <button
                type="submit"
                disabled={enviando}
                className="group/btn mt-7 inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-roxo px-6 text-base font-semibold text-nevoa shadow-[0_5px_0_0_var(--color-roxo-900),0_12px_24px_-12px_color-mix(in_srgb,var(--color-roxo)_70%,transparent)] transition-[translate,box-shadow] duration-200 ease-out select-none hover:shadow-[0_7px_0_0_var(--color-roxo-900),0_20px_30px_-12px_color-mix(in_srgb,var(--color-roxo)_75%,transparent)] active:shadow-[0_2px_0_0_var(--color-roxo-900)] disabled:pointer-events-none disabled:opacity-60 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0.5 sm:text-lg"
              >
                {enviando ? (
                  <>
                    <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {texto.enviando}
                  </>
                ) : (
                  <>
                    {texto.botao}
                    <IconArrowRight size={20} className="transition-transform duration-200 motion-safe:group-hover/btn:translate-x-1" />
                  </>
                )}
              </button>

              <p className="mt-6 text-center text-roxo-soft">
                {modo === "entrar" ? "ainda não tem conta? " : "já tem uma conta? "}
                <button
                  type="button"
                  onClick={() => trocarModo(modo === "entrar" ? "cadastro" : "entrar")}
                  className="inline-flex items-center gap-1 font-semibold text-violeta underline underline-offset-4 hover:text-roxo"
                >
                  {modo === "entrar" ? "cadastre-se aqui" : "entrar"}
                </button>
              </p>
            </form>

          </div>
        </section>

        {/* ilustração da arara */}
        <ArteArara className="mx-auto w-full max-w-[34rem] lg:col-start-1 lg:row-start-2 lg:max-w-[40rem] lg:self-start" />
      </div>
    </div>
  );
}
