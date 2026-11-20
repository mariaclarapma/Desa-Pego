"use client";

import { useEffect, useState } from "react";

/** Contagem regressiva até o fim da reserva (mm:ss). */
export function Contagem({ ate, onExpirar }: { ate: string; onExpirar?: () => void }) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const restante = Math.max(0, new Date(ate).getTime() - agora);

  useEffect(() => {
    if (restante === 0) onExpirar?.();
  }, [restante, onExpirar]);

  const min = String(Math.floor(restante / 60_000)).padStart(2, "0");
  const seg = String(Math.floor((restante % 60_000) / 1000)).padStart(2, "0");
  return (
    <span className="font-semibold tabular-nums">
      {min}:{seg}
    </span>
  );
}
