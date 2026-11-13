import Link from "next/link";
import { ROUTES } from "@/lib/routes";

type LogoProps = {
  /** "vinho" sobre fundos claros; "creme" sobre fundos escuros. */
  tom?: "vinho" | "creme";
  className?: string;
};

/**
 * Logotipo tipográfico. A grafia é sempre "desaPego":
 * "desa" em itálico + "Pego" em cereja/chiclete, sem espaço.
 */
export function LogoMark({ tom = "vinho", className = "" }: LogoProps) {
  const destaque = tom === "vinho" ? "text-cereja" : "text-chiclete";
  return (
    <span
      className={`font-display leading-none font-semibold tracking-[-0.03em] [font-variation-settings:'SOFT'_100,'WONK'_1] ${
        tom === "vinho" ? "text-vinho" : "text-creme"
      } ${className}`}
    >
      <span className="italic">desa</span>
      <span className={destaque}>Pego</span>
    </span>
  );
}

export function Logo({ tom = "vinho", className = "" }: LogoProps) {
  return (
    <Link
      href={ROUTES.home}
      aria-label="desaPego, página inicial"
      className={`group inline-flex items-center gap-1 rounded-lg ${className}`}
    >
      <LogoMark tom={tom} className="text-[1.75rem] sm:text-[2rem]" />
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-3.5 -translate-y-2 fill-chiclete transition-transform duration-300 group-hover:rotate-90"
      >
        <path d="M12 2c.6 4.8 2.6 7.4 8 8.2v.6c-5.4.8-7.4 3.4-8 8.2h-.6c-.6-4.8-2.6-7.4-8-8.2v-.6c5.4-.8 7.4-3.4 8-8.2h.6Z" />
      </svg>
    </Link>
  );
}
