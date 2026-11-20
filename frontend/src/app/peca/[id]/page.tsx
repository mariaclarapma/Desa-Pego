import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoSacola } from "@/components/sacola/BotaoSacola";
import { ApiIndisponivel } from "@/components/ui/ApiIndisponivel";
import { ConditionBadge } from "@/components/ui/ConditionBadge";
import { Sticker, Tape } from "@/components/ui/Sticker";
import { CATEGORIAS } from "@/data/demo/catalogo";
import { buscarPeca, statusAtual } from "@/lib/api/catalogo";
import { formatarPreco } from "@/lib/format";
import { catalogoUrl } from "@/lib/routes";
import type { Peca } from "@/types/catalogo";

// o status (disponível, reservada, vendida) é lido da API a cada acesso, nunca do cache
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const peca = await buscarPeca(id).catch(() => null);
  return { title: peca?.titulo ?? "peça" };
}

export default async function PecaPage({ params }: Props) {
  // rota dinâmica /peca/[id]: o Next entrega o segmento da URL em params
  const { id } = await params;

  let peca: Peca | null;
  try {
    peca = await buscarPeca(id);
  } catch {
    return <ApiIndisponivel />;
  }
  if (!peca) notFound();

  const status = statusAtual(peca);
  const categoria = CATEGORIAS.find((c) => c.slug === peca.categoria);
  const medidas = Object.entries(peca.medidas ?? {});

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <nav aria-label="Você está em" className="mb-8 text-sm text-roxo-soft">
        <Link href={catalogoUrl()} className="hover:text-violeta">
          vitrine
        </Link>
        {categoria ? (
          <>
            {" / "}
            <Link href={catalogoUrl({ categoria: categoria.slug })} className="hover:text-violeta">
              {categoria.nome}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid gap-10 md:grid-cols-2 lg:gap-16">
        <div className="relative">
          <Tape className="-top-3 left-8 -rotate-6" />
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] border-2 border-roxo bg-nevoa-200 shadow-[6px_6px_0_0_var(--color-roxo)]">
            <Image
              src={peca.fotoUrl}
              alt={peca.fotoAlt}
              fill
              priority
              sizes="(min-width: 768px) 45vw, 100vw"
              className={`object-cover ${status !== "disponivel" ? "opacity-60 grayscale" : ""}`}
            />
            <ConditionBadge condicao={peca.condicao} className="absolute top-3 left-3" />
          </div>
          {status !== "disponivel" ? (
            <Sticker tone={status === "vendida" ? "violeta" : "pervinca"} rotate={4} className="absolute -right-2 bottom-8">
              {status === "vendida" ? "vendida" : "reservada"}
            </Sticker>
          ) : null}
        </div>

        <div className="space-y-6">
          <div>
            {peca.marca ? (
              <p className="text-xs font-bold tracking-[0.18em] text-roxo-soft uppercase">{peca.marca}</p>
            ) : null}
            <h1 className="mt-2 font-display text-4xl leading-[1] font-medium tracking-[-0.03em] text-balance sm:text-5xl">
              {peca.titulo}
            </h1>
            <p className="mt-4 font-display text-4xl font-semibold tracking-tight text-violeta">
              {formatarPreco(peca.precoCentavos)}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border-2 border-roxo/20 p-3">
              <dt className="text-roxo-soft">tamanho</dt>
              <dd className="mt-0.5 text-lg font-bold">{peca.tamanho}</dd>
            </div>
            <div className="rounded-2xl border-2 border-roxo/20 p-3">
              <dt className="text-roxo-soft">vendido por</dt>
              <dd className="mt-0.5 font-bold">
                {peca.vendedor.nomePublico} <span className="font-normal text-roxo-soft">· {peca.vendedor.cidade}</span>
              </dd>
            </div>
          </dl>

          <p className="text-lg leading-relaxed text-roxo-soft">{peca.descricao}</p>

          {medidas.length > 0 ? (
            <div>
              <h2 className="mb-2 text-xs font-bold tracking-[0.18em] text-violeta uppercase">medidas (cm)</h2>
              <ul className="flex flex-wrap gap-2">
                {medidas.map(([nome, valor]) => (
                  <li key={nome} className="rounded-full border-2 border-roxo bg-nevoa px-3 py-1 text-sm">
                    {nome}: <strong>{valor}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <BotaoSacola peca={peca} status={status} />
        </div>
      </div>
    </div>
  );
}
