"use client";

import { useEffect, useState } from "react";
import { useSacola } from "@/lib/sacola";

/** Bolinha com a quantidade de peças na sacola, ao lado do ícone do cabeçalho. */
export function SacolaBadge() {
  const quantidade = useSacola((s) => s.itens.length);
  // a sacola fica no navegador: só mostra depois de montar, para não divergir do HTML do servidor
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  if (!montado || quantidade === 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full border-2 border-nevoa bg-violeta text-[0.65rem] font-bold text-nevoa">
      {quantidade}
      <span className="sr-only">{quantidade === 1 ? " peça" : " peças"}</span>
    </span>
  );
}
