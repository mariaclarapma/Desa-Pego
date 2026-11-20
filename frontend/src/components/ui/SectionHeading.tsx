import type { ReactNode } from "react";

/** Título de seção editorial: sobretítulo pequeno + título grande em serifa. */
export function SectionHeading({
  id,
  eyebrow,
  children,
  className = "",
  tom = "roxo",
}: {
  id?: string;
  eyebrow?: ReactNode;
  children: ReactNode;
  className?: string;
  tom?: "roxo" | "nevoa";
}) {
  return (
    <div className={className}>
      {eyebrow ? (
        <p
          className={`mb-3 flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase ${
            tom === "roxo" ? "text-violeta" : "text-rosa"
          }`}
        >
          <span aria-hidden="true" className="h-px w-8 bg-current" />
          {eyebrow}
        </p>
      ) : null}
      <h2
        id={id}
        className={`font-display text-[2.4rem] leading-[0.95] font-medium tracking-[-0.035em] text-balance sm:text-5xl lg:text-6xl ${
          tom === "roxo" ? "text-roxo" : "text-nevoa"
        }`}
      >
        {children}
      </h2>
    </div>
  );
}
