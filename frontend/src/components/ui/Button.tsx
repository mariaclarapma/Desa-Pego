import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Botão "adesivo": pílula com contorno e sombra sólida deslocada.
 * No hover levanta; no clique afunda (a sombra some).
 */
export type ButtonVariant = "violeta" | "rosa" | "rosaSobreEscuro" | "roxo" | "nevoa" | "fantasma" | "perigo" | "perigoSuave";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "group/btn inline-flex items-center justify-center gap-2 rounded-full border-2 font-semibold whitespace-nowrap transition-[transform,box-shadow,background-color] duration-200 ease-out select-none disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  violeta:
    "border-roxo bg-violeta text-nevoa shadow-[4px_4px_0_0_var(--color-roxo)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-roxo)] active:translate-x-1 active:translate-y-1 active:shadow-none",
  rosa:
    "border-roxo bg-rosa text-roxo shadow-[4px_4px_0_0_var(--color-roxo)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-roxo)] active:translate-x-1 active:translate-y-1 active:shadow-none",
  // para fundos roxos: contorno e sombra em névoa
  rosaSobreEscuro:
    "border-nevoa bg-rosa text-roxo shadow-[4px_4px_0_0_var(--color-nevoa)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-nevoa)] active:translate-x-1 active:translate-y-1 active:shadow-none",
  roxo:
    "border-roxo bg-roxo text-nevoa shadow-[4px_4px_0_0_var(--color-rosa)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-rosa)] active:translate-x-1 active:translate-y-1 active:shadow-none",
  nevoa:
    "border-roxo bg-nevoa text-roxo shadow-[4px_4px_0_0_var(--color-roxo)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-rosa-100 hover:shadow-[6px_6px_0_0_var(--color-roxo)] active:translate-x-1 active:translate-y-1 active:shadow-none",
  fantasma: "border-transparent bg-transparent text-roxo hover:bg-roxo/5",
  // ações destrutivas (ex.: excluir a conta), em magenta, que tem contraste AA nos três temas
  perigo:
    "border-roxo bg-magenta text-nevoa shadow-[4px_4px_0_0_var(--color-roxo)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-roxo)] active:translate-x-1 active:translate-y-1 active:shadow-none",
  perigoSuave:
    "border-magenta bg-nevoa text-magenta shadow-[4px_4px_0_0_var(--color-magenta)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-rosa-100 hover:shadow-[6px_6px_0_0_var(--color-magenta)] active:translate-x-1 active:translate-y-1 active:shadow-none",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-6 text-[0.95rem]",
  lg: "h-14 px-7 text-base sm:text-lg",
};

export function buttonClasses(variant: ButtonVariant = "violeta", size: ButtonSize = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconRight?: ReactNode;
};

export function ButtonLink({
  variant = "violeta",
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
