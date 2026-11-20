import type { ReactNode } from "react";

type StickerTone = "rosa" | "lilas" | "pervinca" | "violeta" | "nevoa";

const tones: Record<StickerTone, string> = {
  rosa: "bg-rosa text-roxo",
  lilas: "bg-lilas text-roxo",
  pervinca: "bg-pervinca text-roxo",
  violeta: "bg-violeta text-nevoa",
  nevoa: "bg-nevoa text-roxo",
};

/** Adesivo de scrapbook: etiqueta levemente torta com contorno e sombra sólida. */
export function Sticker({
  children,
  tone = "rosa",
  rotate = -4,
  className = "",
}: {
  children: ReactNode;
  tone?: StickerTone;
  rotate?: number;
  className?: string;
}) {
  return (
    <span
      style={{ rotate: `${rotate}deg` }}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 border-roxo px-3.5 py-1 font-hand text-lg leading-tight font-bold shadow-[3px_3px_0_0_var(--color-roxo)] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Pedaço de fita adesiva translúcida para "colar" fotos. Puramente decorativo. */
export function Tape({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 h-7 w-24 bg-rosa-100/80 shadow-sm backdrop-blur-[1px] [clip-path:polygon(3%_0,97%_4%,100%_100%,0_94%)] ${className}`}
    />
  );
}
