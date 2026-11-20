"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Contagem } from "@/components/sacola/Contagem";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Sticker } from "@/components/ui/Sticker";
import { FRETE_FIXO_CENTAVOS } from "@/lib/config";
import { formatarPreco } from "@/lib/format";
import { catalogoUrl, pecaUrl, ROUTES } from "@/lib/routes";
import { subtotalSacola, useSacola } from "@/lib/sacola";

export default function CarrinhoPage() {
  const { itens, remover, removerExpirados } = useSacola();
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    removerExpirados();
  }, [removerExpirados]);

  if (!montado) return <div className="min-h-[60vh]" />;

  if (itens.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
        <Sticker tone="lilas">sacola vazia</Sticker>
        <h1 className="mt-6 font-display text-5xl font-medium tracking-tight">nada por aqui ainda</h1>
        <p className="mt-4 text-roxo-soft">garimpa um achadinho na vitrine e ele fica reservado pra você.</p>
        <ButtonLink href={catalogoUrl()} size="lg" className="mt-8">
          ir pra vitrine
        </ButtonLink>
      </section>
    );
  }

  const subtotal = subtotalSacola(itens);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <SectionHeading eyebrow="peças reservadas pra você">sua sacola</SectionHeading>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
        <ul className="space-y-4">
          {itens.map((item) => (
            <li key={item.id} className="flex gap-4 rounded-[1.25rem] border-2 border-roxo bg-nevoa p-3 sm:p-4">
              <Link href={pecaUrl(item.id)} className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-xl border-2 border-roxo sm:w-28">
                <Image src={item.fotoUrl} alt={item.fotoAlt} fill sizes="112px" className="object-cover" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                {item.marca ? <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-roxo-soft uppercase">{item.marca}</p> : null}
                <Link href={pecaUrl(item.id)} className="font-medium hover:text-violeta">
                  {item.titulo}
                </Link>
                <p className="text-sm text-roxo-soft">tam. {item.tamanho}</p>
                <p className="mt-auto pt-2 text-sm text-violeta">
                  reservada por mais <Contagem ate={item.reservadaAte} onExpirar={removerExpirados} />
                </p>
              </div>
              <div className="flex flex-col items-end justify-between">
                <p className="font-display text-xl font-semibold">{formatarPreco(item.precoCentavos)}</p>
                <button
                  type="button"
                  onClick={() => remover(item.id)}
                  aria-label={`remover ${item.titulo} da sacola`}
                  className="text-sm text-roxo-soft underline hover:text-violeta"
                >
                  remover
                </button>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit space-y-4 rounded-[1.5rem] border-2 border-roxo bg-rosa-100 p-6 shadow-[4px_4px_0_0_var(--color-roxo)]">
          <h2 className="font-display text-2xl font-medium">resumo</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>subtotal</dt>
              <dd>{formatarPreco(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>frete fixo</dt>
              <dd>{formatarPreco(FRETE_FIXO_CENTAVOS)}</dd>
            </div>
            <div className="flex justify-between border-t-2 border-roxo/20 pt-2 text-base font-bold">
              <dt>total</dt>
              <dd>{formatarPreco(subtotal + FRETE_FIXO_CENTAVOS)}</dd>
            </div>
          </dl>
          <ButtonLink href={ROUTES.checkout} size="lg" className="w-full">
            fechar com Pix
          </ButtonLink>
          <Link href={catalogoUrl()} className="block text-center text-sm underline">
            continuar garimpando
          </Link>
        </aside>
      </div>
    </div>
  );
}
