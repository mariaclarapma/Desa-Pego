"use client";

import Image from "next/image";
import { useId, useState, type ChangeEvent } from "react";
import { IconAlerta, IconCamera, IconClose } from "@/components/ui/icons";
import { anuncios, subirFoto, TIPOS_FOTO, type TipoFoto } from "@/lib/api/anuncios";
import type { ChamadaAutenticada } from "@/lib/useChamadaAutenticada";
import { FOTO_MAX_MB, FOTOS_MAX } from "@/lib/validacao-anuncio";

export interface FotoNoFormulario {
  /** id local (para a lista do React) */
  id: string;
  chave?: string;
  url: string;
  estado: "enviando" | "pronta" | "erro";
}

const tipoAceito = (tipo: string): tipo is TipoFoto => (TIPOS_FOTO as readonly string[]).includes(tipo);

/**
 * Fotos do anúncio (Req. 004): de 1 a 5, só JPG, PNG ou WebP, com limite de tamanho. Cada foto sobe
 * direto para o armazenamento por uma URL pré-assinada assim que é escolhida. A primeira é a capa.
 */
export function FotosAnuncio({
  fotos,
  aoMudar,
  chamar,
  erro,
}: {
  fotos: FotoNoFormulario[];
  aoMudar: (atualizar: (atuais: FotoNoFormulario[]) => FotoNoFormulario[]) => void;
  chamar: ChamadaAutenticada;
  erro?: string;
}) {
  const idInput = useId();
  const [avisos, setAvisos] = useState<string[]>([]);
  const restantes = FOTOS_MAX - fotos.length;

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    const novosAvisos: string[] = [];
    const aceitos = arquivos.filter((a) => {
      if (!tipoAceito(a.type)) return novosAvisos.push(`“${a.name}” não é JPG, PNG ou WebP.`) && false;
      if (a.size > FOTO_MAX_MB * 1024 * 1024) return novosAvisos.push(`“${a.name}” passa de ${FOTO_MAX_MB} MB.`) && false;
      return true;
    });
    if (aceitos.length > restantes) {
      novosAvisos.push(`o anúncio aceita até ${FOTOS_MAX} fotos; ${aceitos.length - restantes} ficaram de fora.`);
      aceitos.splice(restantes);
    }
    setAvisos(novosAvisos);
    if (aceitos.length === 0) return;

    const locais = aceitos.map((a) => ({ id: crypto.randomUUID(), url: URL.createObjectURL(a), estado: "enviando" as const }));
    aoMudar((atuais) => [...atuais, ...locais]);
    const atualizar = (id: string, dados: Partial<FotoNoFormulario>) => aoMudar((atuais) => atuais.map((f) => (f.id === id ? { ...f, ...dados } : f)));

    try {
      const preparadas = await chamar((token) => anuncios.prepararFotos(token, aceitos.map((a) => ({ tipo: a.type as TipoFoto, tamanhoBytes: a.size }))));
      await Promise.all(
        preparadas.map((p, i) =>
          subirFoto(p, aceitos[i])
            .then(() => atualizar(locais[i].id, { chave: p.chave, estado: "pronta" }))
            .catch((falha: Error) => {
              atualizar(locais[i].id, { estado: "erro" });
              setAvisos((a) => [...a, `“${aceitos[i].name}”: ${falha.message}`]);
            }),
        ),
      );
    } catch (falha) {
      locais.forEach((l) => atualizar(l.id, { estado: "erro" }));
      setAvisos((a) => [...a, falha instanceof Error ? falha.message : "não deu para enviar as fotos."]);
    }
  }

  const remover = (id: string) => aoMudar((atuais) => atuais.filter((f) => f.id !== id));
  const avisosVisiveis = [...(erro ? [erro] : []), ...avisos];

  return (
    <div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {fotos.map((foto, i) => (
          <li key={foto.id} className="relative">
            <div className="relative aspect-square overflow-hidden rounded-2xl border-2 border-roxo bg-nevoa-200">
              <Image
                src={foto.url}
                alt={`foto ${i + 1}${i === 0 ? " (capa)" : ""}`}
                fill
                unoptimized
                sizes="160px"
                className={`object-cover ${foto.estado === "enviando" ? "opacity-50" : ""}`}
              />
              {foto.estado !== "pronta" ? (
                <span className="absolute inset-x-1 bottom-1 rounded-full bg-nevoa/90 px-2 py-0.5 text-center text-[0.7rem] font-semibold">
                  {foto.estado === "enviando" ? "enviando…" : "falhou"}
                </span>
              ) : i === 0 ? (
                <span className="absolute inset-x-1 bottom-1 rounded-full bg-roxo px-2 py-0.5 text-center text-[0.7rem] font-semibold text-nevoa">capa</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => remover(foto.id)}
              aria-label={`remover foto ${i + 1}`}
              className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full border-2 border-roxo bg-nevoa hover:bg-rosa-100"
            >
              <IconClose size={14} />
            </button>
          </li>
        ))}
        {restantes > 0 ? (
          <li>
            <label
              htmlFor={idInput}
              className="grid aspect-square cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-roxo/60 text-center text-xs font-semibold text-roxo-soft transition-colors hover:bg-rosa-100 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-magenta"
            >
              <span className="flex flex-col items-center gap-1">
                <IconCamera size={24} />
                {fotos.length === 0 ? "escolher fotos" : "mais fotos"}
              </span>
              <input id={idInput} type="file" multiple accept={TIPOS_FOTO.join(",")} onChange={escolher} aria-describedby={`${idInput}-dica`} className="sr-only" />
            </label>
          </li>
        ) : null}
      </ul>
      <p id={`${idInput}-dica`} className="mt-2 text-sm text-roxo-soft">
        de 1 a {FOTOS_MAX} fotos em JPG, PNG ou WebP, com até {FOTO_MAX_MB} MB cada. a primeira é a capa.
      </p>
      {avisosVisiveis.length > 0 ? (
        <ul role="alert" className="mt-2 space-y-1 text-sm font-medium text-magenta">
          {avisosVisiveis.map((a) => (
            <li key={a} className="flex items-start gap-1.5">
              <IconAlerta size={16} className="mt-0.5 shrink-0" />
              {a}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
