"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { SemLogin } from "@/lib/comLogin";
import { RESERVA_MINUTOS } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import { useSacola } from "@/lib/sacola";
import type { PecaResumo, StatusPeca } from "@/types/catalogo";

/** Botão "colocar na sacola": reserva a peça única por 15 minutos (ADR-003). */
export function BotaoSacola({ peca, status }: { peca: PecaResumo; status: StatusPeca }) {
  const router = useRouter();
  const adicionar = useSacola((s) => s.adicionar);
  const naSacola = useSacola((s) => s.itens.some((i) => i.id === peca.id));
  const [montado, setMontado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [precisaEntrar, setPrecisaEntrar] = useState(false);
  useEffect(() => setMontado(true), []);

  async function colocarNaSacola() {
    setEnviando(true);
    setAviso("");
    setPrecisaEntrar(false);
    try {
      await adicionar(peca);
      router.push(ROUTES.carrinho);
    } catch (erro) {
      // a sacola exige login: a reserva fica no nome de quem reservou
      if (erro instanceof SemLogin) {
        setPrecisaEntrar(true);
        setEnviando(false);
        return;
      }
      setAviso(erro instanceof Error ? erro.message : "Não deu para reservar a peça.");
      router.refresh();
      setEnviando(false);
    }
  }

  if (montado && naSacola) {
    return (
      <Link href={ROUTES.carrinho} className={buttonClasses("roxo", "lg", "w-full")}>
        já está na sua sacola · ver sacola
      </Link>
    );
  }

  if (status !== "disponivel") {
    return (
      <p className="rounded-full border-2 border-dashed border-roxo/40 py-4 text-center font-semibold text-roxo-soft">
        {status === "vendida" ? "essa peça já foi vendida" : "reservada por outra pessoa, volta daqui a pouco"}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {aviso ? (
        <p role="alert" className="rounded-2xl border-2 border-roxo bg-pervinca-100 px-4 py-3 text-sm">
          {aviso}
        </p>
      ) : null}
      {precisaEntrar ? (
        <p role="alert" className="rounded-2xl border-2 border-roxo bg-pervinca-100 px-4 py-3 text-sm">
          pra reservar, entre na sua conta.{" "}
          <Link href={ROUTES.entrar} className="font-semibold text-violeta underline underline-offset-4">
            entrar
          </Link>{" "}
          ou{" "}
          <Link href={ROUTES.cadastro} className="font-semibold text-violeta underline underline-offset-4">
            criar conta
          </Link>
        </p>
      ) : null}
      <button type="button" onClick={colocarNaSacola} disabled={enviando} className={buttonClasses("violeta", "lg", "w-full")}>
        {enviando ? "reservando…" : "colocar na sacola"}
      </button>
      <p className="text-center text-sm text-roxo-soft">
        a peça fica reservada pra você por {RESERVA_MINUTOS} minutos
      </p>
    </div>
  );
}
