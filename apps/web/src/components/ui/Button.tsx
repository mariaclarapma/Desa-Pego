import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Botão "adesivo": pílula com contorno e sombra sólida deslocada.
 * No hover levanta; no clique afunda (a sombra some).
 */
export type ButtonVariant = "cereja" | "chiclete" | "chicleteSobreEscuro" | "vinho" | "creme" | "fantasma";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "group/btn inline-flex items-center justify-center gap-2 rounded-full border-2 font-semibold whitespace-nowrap transition-[transform,box-shadow,background-color] duration-200 ease-out select-none disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  cereja:
    "border-vinho bg-cereja text-creme shadow-[4px_4px_0_0_var(--color-vinho)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-vinho)] active:translate-x-1 active:translate-y-1 active:shadow-none",
  chiclete:
    "border-vinho bg-chiclete text-vinho shadow-[4px_4px_0_0_var(--color-vinho)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-vinho)] active:translate-x-1 active:translate-y-1 active:shadow-none",
  // para fundos vinho: contorno e sombra em creme
  chicleteSobreEscuro:
    "border-creme bg-chiclete text-vinho shadow-[4px_4px_0_0_var(--color-creme)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-creme)] active:translate-x-1 active:translate-y-1 active:shadow-none",
  vinho:
    "border-vinho bg-vinho text-creme shadow-[4px_4px_0_0_var(--color-chiclete)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-chiclete)] active:translate-x-1 active:translate-y-1 active:shadow-none",
  creme:
    "border-vinho bg-creme text-vinho shadow-[4px_4px_0_0_var(--color-vinho)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-chiclete-100 hover:shadow-[6px_6px_0_0_var(--color-vinho)] active:translate-x-1 active:translate-y-1 active:shadow-none",
  fantasma: "border-transparent bg-transparent text-vinho hover:bg-vinho/5",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-6 text-[0.95rem]",
  lg: "h-14 px-7 text-base sm:text-lg",
};

export function buttonClasses(variant: ButtonVariant = "cereja", size: ButtonSize = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconRight?: ReactNode;
};

export function ButtonLink({
  variant = "cereja",
  size = "md",
  className = "",
  iconRight,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {children}
      {iconRight ? (
        <span className="transition-transform duration-200 group-hover/btn:translate-x-0.5">{iconRight}</span>
      ) : null}
    </Link>
  );
}
