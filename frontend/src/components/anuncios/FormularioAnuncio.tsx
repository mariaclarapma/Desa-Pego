"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { CampoConta } from "@/components/conta/CampoConta";
import { buttonClasses } from "@/components/ui/Button";
import { ConditionBadge } from "@/components/ui/ConditionBadge";
import { IconAlerta } from "@/components/ui/icons";
import { CATEGORIAS } from "@/data/demo/catalogo";
import { regrasPlataforma, type Anuncio, type DadosAnuncio, type FaixaSugerida } from "@/lib/api/anuncios";
import { CONDICAO_LABEL, formatarPreco } from "@/lib/format";
import { centavosParaCampo, reaisParaCentavos } from "@/lib/preco";
import type { ChamadaAutenticada } from "@/lib/useChamadaAutenticada";
import { useFrete } from "@/lib/useFrete";
import { CATEGORIAS_ANUNCIO, validarAnuncio, type ErrosAnuncio, type FormAnuncio } from "@/lib/validacao-anuncio";
import type { CategoriaSlug, Condicao } from "@/types/catalogo";
import type { TaxasPlataforma } from "@desapego/core/pricing";
import { FotosAnuncio, type FotoNoFormulario } from "./FotosAnuncio";
import { SimuladorGanho } from "./SimuladorGanho";

const ORDEM_CAMPOS: (keyof ErrosAnuncio)[] = ["fotos", "titulo", "descricao", "categoria", "tamanho", "marca", "condicao", "preco"];
const CONDICOES = Object.keys(CONDICAO_LABEL) as Condicao[];
const DESCRICAO_CONDICAO: Record<Condicao, string> = {
  nova_com_etiqueta: "nunca usada",
  otimo_estado: "sem marcas aparentes",
  bom_estado: "sinais leves de uso",
  com_marcas_de_uso: "uso visível, descrito no anúncio",
};
const nomeCategoria = (slug: string) => CATEGORIAS.find((c) => c.slug === slug)?.nome ?? slug;

const campoBase = "w-full rounded-2xl border-2 bg-white/70 px-4 text-roxo transition-[background-color,box-shadow] hover:bg-white focus:bg-white focus:outline-none";
const borda = (erro?: string) =>
  erro ? "border-magenta focus:shadow-[3px_3px_0_0_var(--color-magenta)]" : "border-roxo focus:shadow-[3px_3px_0_0_var(--color-rosa)]";

function Erro({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-magenta">
      <IconAlerta size={16} className="mt-0.5 shrink-0" />
      {children}
    </p>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border-2 border-roxo bg-nevoa p-5 sm:p-7">
      <h2 className="mb-5 font-display text-2xl font-medium">{titulo}</h2>
      {children}
    </section>
  );
}

/**
 * Formulário de anúncio (Req. 004) com o simulador de ganho (Req. 005). Serve para publicar e para editar.
 * A comissão, a taxa do Pix, o frete e a faixa sugerida vêm da configuração do admin (nunca daqui).
 */
export function FormularioAnuncio({
  inicial,
  chamar,
  textoBotao,
  textoEnviando,
  aoSalvar,
}: {
  inicial?: Anuncio;
  chamar: ChamadaAutenticada;
  textoBotao: string;
  textoEnviando: string;
  aoSalvar: (dados: DadosAnuncio) => Promise<unknown>;
}) {
  const id = useId();
  const frete = useFrete();
  const [form, setForm] = useState<FormAnuncio>({
    titulo: inicial?.titulo ?? "",
    descricao: inicial?.descricao ?? "",
    categoria: inicial?.categoria ?? "",
    tamanho: inicial?.tamanho ?? "",
    marca: inicial?.marca ?? "",
    condicao: inicial?.condicao ?? "",
    preco: inicial ? centavosParaCampo(inicial.precoCentavos) : "",
  });
  const [fotos, setFotos] = useState<FotoNoFormulario[]>(
    () => inicial?.fotos.map((f) => ({ id: f.chave, chave: f.chave, url: f.url, estado: "pronta" as const })) ?? [],
  );
  const [erros, setErros] = useState<ErrosAnuncio>({});
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroGeral, setErroGeral] = useState("");
  const [regras, setRegras] = useState<(TaxasPlataforma & { precosSugeridos: FaixaSugerida[] }) | null>(null);
  const [falhaRegras, setFalhaRegras] = useState(false);

  useEffect(() => {
    let ativo = true;
    regrasPlataforma()
      .then((r) => ativo && setRegras(r))
      .catch(() => ativo && setFalhaRegras(true));
    return () => {
      ativo = false;
    };
  }, []);

  const prontas = fotos.filter((f) => f.estado === "pronta");
  const pendentes = fotos.length - prontas.length;

  function mudar(campo: keyof FormAnuncio, valor: string) {
    const novo = { ...form, [campo]: valor };
    setForm(novo);
    if (enviado) setErros(validarAnuncio(novo, prontas.length, pendentes));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviado(true);
    setErroGeral("");
    const encontrados = validarAnuncio(form, prontas.length, pendentes);
    setErros(encontrados);
    const primeiro = ORDEM_CAMPOS.find((c) => encontrados[c]);
    if (primeiro) {
      document.getElementById(`${id}-${primeiro}`)?.focus();
      return;
    }
    setEnviando(true);
    try {
      await aoSalvar({
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        categoria: form.categoria as CategoriaSlug,
        tamanho: form.tamanho.trim(),
        marca: form.marca.trim(),
        condicao: form.condicao as Condicao,
        precoCentavos: reaisParaCentavos(form.preco)!,
        fotos: prontas.map((f) => f.chave!),
      });
    } catch (falha) {
      setErroGeral(falha instanceof Error ? falha.message : "não deu para salvar agora. tente de novo.");
      setEnviando(false);
    }
  }

  const faixa = regras?.precosSugeridos.find((f) => f.categoria === form.categoria && f.condicao === form.condicao);
  const precoCentavos = reaisParaCentavos(form.preco);

  return (
    <form onSubmit={enviar} noValidate aria-busy={enviando} className="space-y-6">
      {erroGeral ? (
        <div role="alert" className="flex gap-2.5 rounded-2xl border-2 border-magenta bg-rosa-100 p-4 text-sm">
          <IconAlerta size={18} className="mt-0.5 shrink-0 text-magenta" />
          <p>{erroGeral}</p>
        </div>
      ) : null}

      <Secao titulo="fotos">
        <div id={`${id}-fotos`} tabIndex={-1} className="outline-none">
          <FotosAnuncio fotos={fotos} aoMudar={setFotos} chamar={chamar} erro={enviado ? erros.fotos : undefined} />
        </div>
      </Secao>

      <Secao titulo="sobre a peça">
        <div className="space-y-5">
          <CampoConta
            id={`${id}-titulo`}
            rotulo="título"
            value={form.titulo}
            onChange={(e) => mudar("titulo", e.target.value)}
            erro={erros.titulo}
            maxLength={100}
            placeholder="ex.: jaqueta jeans oversized"
          />
          <div>
            <label htmlFor={`${id}-descricao`} className="mb-1.5 block text-sm font-semibold">
              descrição
            </label>
            <textarea
              id={`${id}-descricao`}
              rows={4}
              value={form.descricao}
              onChange={(e) => mudar("descricao", e.target.value)}
              aria-invalid={erros.descricao ? true : undefined}
              aria-describedby={erros.descricao ? `${id}-descricao-erro` : `${id}-descricao-dica`}
              maxLength={2000}
              className={`${campoBase} ${borda(erros.descricao)} py-3`}
            />
            <Erro id={`${id}-descricao-erro`}>{erros.descricao}</Erro>
            {!erros.descricao ? (
              <p id={`${id}-descricao-dica`} className="mt-1.5 text-sm text-roxo-soft">
                tecido, medidas, defeitos: tudo que ajuda quem vai comprar.
              </p>
            ) : null}
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor={`${id}-categoria`} className="mb-1.5 block text-sm font-semibold">
                categoria
              </label>
              <select
                id={`${id}-categoria`}
                value={form.categoria}
                onChange={(e) => mudar("categoria", e.target.value)}
                aria-invalid={erros.categoria ? true : undefined}
                aria-describedby={erros.categoria ? `${id}-categoria-erro` : undefined}
                className={`${campoBase} ${borda(erros.categoria)} h-12`}
              >
                <option value="">escolha…</option>
                {CATEGORIAS_ANUNCIO.map((c) => (
                  <option key={c} value={c}>
                    {nomeCategoria(c)}
                  </option>
                ))}
              </select>
              <Erro id={`${id}-categoria-erro`}>{erros.categoria}</Erro>
            </div>
            <CampoConta
              id={`${id}-tamanho`}
              rotulo="tamanho"
              value={form.tamanho}
              onChange={(e) => mudar("tamanho", e.target.value)}
              erro={erros.tamanho}
              maxLength={20}
              placeholder="P, M, 38, único…"
            />
            <CampoConta
              id={`${id}-marca`}
              rotulo="marca (opcional)"
              value={form.marca}
              onChange={(e) => mudar("marca", e.target.value)}
              erro={erros.marca}
              maxLength={60}
            />
          </div>

          <fieldset aria-describedby={erros.condicao ? `${id}-condicao-erro` : undefined}>
            <legend className="mb-2 text-sm font-semibold">condição</legend>
            <div id={`${id}-condicao`} tabIndex={-1} className="grid gap-2 outline-none sm:grid-cols-2">
              {CONDICOES.map((c) => (
                <label
                  key={c}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-roxo/30 p-3 transition-colors hover:bg-rosa-100 has-checked:border-roxo has-checked:bg-lilas-100 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-magenta"
                >
                  <input type="radio" name={`${id}-condicao`} value={c} checked={form.condicao === c} onChange={() => mudar("condicao", c)} className="sr-only" />
                  <ConditionBadge condicao={c} />
                  <span className="text-sm text-roxo-soft">{DESCRICAO_CONDICAO[c]}</span>
                </label>
              ))}
            </div>
            <Erro id={`${id}-condicao-erro`}>{erros.condicao}</Erro>
          </fieldset>
        </div>
      </Secao>

      <Secao titulo="preço">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label htmlFor={`${id}-preco`} className="mb-1.5 block text-sm font-semibold">
              preço de venda
            </label>
            <div className="relative">
              <span aria-hidden="true" className="absolute top-1/2 left-4 -translate-y-1/2 font-semibold text-roxo-soft">
                R$
              </span>
              <input
                id={`${id}-preco`}
                inputMode="decimal"
                autoComplete="off"
                value={form.preco}
                onChange={(e) => mudar("preco", e.target.value)}
                aria-invalid={erros.preco ? true : undefined}
                aria-describedby={[erros.preco ? `${id}-preco-erro` : "", `${id}-faixa`].filter(Boolean).join(" ")}
                placeholder="0,00"
                className={`${campoBase} ${borda(erros.preco)} h-12 pl-11 text-lg tabular-nums`}
              />
            </div>
            <Erro id={`${id}-preco-erro`}>{erros.preco}</Erro>
            <p id={`${id}-faixa`} className="mt-3 text-sm text-roxo-soft">
              {!form.categoria || !form.condicao
                ? "escolha a categoria e a condição para ver a faixa de preço sugerida."
                : faixa
                  ? `peças assim costumam sair entre ${formatarPreco(faixa.minimoCentavos)} e ${formatarPreco(faixa.maximoCentavos)}. é só uma referência: o preço quem decide é você.`
                  : "ainda não há uma faixa sugerida para essa categoria e condição."}
            </p>
          </div>
          {falhaRegras ? (
            <p role="alert" className="rounded-[1.25rem] border-2 border-magenta p-5 text-sm">
              não deu para carregar a comissão e a taxa do Pix agora, então o simulador ficou fora do ar. você ainda pode
              publicar; o valor oficial é calculado na venda.
            </p>
          ) : regras ? (
            <SimuladorGanho precoCentavos={precoCentavos} freteCentavos={frete} taxas={regras} />
          ) : (
            <p className="rounded-[1.25rem] border-2 border-roxo/30 p-5 text-sm text-roxo-soft">carregando o simulador…</p>
          )}
        </div>
      </Secao>

      <button type="submit" disabled={enviando} className={buttonClasses("violeta", "lg", "w-full sm:w-auto")}>
        {enviando ? (
          <>
            <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {textoEnviando}
          </>
        ) : (
          textoBotao
        )}
      </button>
    </form>
  );
}
