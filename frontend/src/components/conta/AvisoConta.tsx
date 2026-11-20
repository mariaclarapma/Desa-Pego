import { forwardRef } from "react";
import { IconAlerta } from "@/components/ui/icons";

/**
 * Aviso dos formulários da conta, no mesmo estilo do login. Erro usa role="alert" (lido na hora);
 * sucesso usa role="status". Recebe foco (tabIndex -1) para o leitor de tela anunciar.
 */
export const AvisoConta = forwardRef<HTMLDivElement, { tipo: "erro" | "sucesso"; children: React.ReactNode }>(function AvisoConta(
  { tipo, children },
  ref,
) {
  const erro = tipo === "erro";
  return (
    <div
      ref={ref}
      role={erro ? "alert" : "status"}
      tabIndex={-1}
      className={`flex gap-2.5 rounded-2xl border-2 p-4 text-sm text-roxo outline-none ${
        erro ? "border-magenta bg-rosa-100" : "border-violeta bg-lilas-100"
      }`}
    >
      {erro ? <IconAlerta size={18} className="mt-0.5 shrink-0 text-magenta" /> : null}
      <p>{children}</p>
    </div>
  );
});
