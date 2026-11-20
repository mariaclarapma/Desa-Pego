import { CONDICAO_LABEL } from "@/lib/format";
import type { Condicao } from "@/types/catalogo";

const estilos: Record<Condicao, string> = {
  nova_com_etiqueta: "bg-rosa text-roxo",
  otimo_estado: "bg-lilas text-roxo",
  bom_estado: "bg-pervinca text-roxo",
  com_marcas_de_uso: "bg-nevoa-200 text-roxo",
};

/**
 * Selo padronizado de condição da peça (Req. 004).
 * Componente único para vitrine, detalhes e formulário de anúncio.
 */
export function ConditionBadge({ condicao, className = "" }: { condicao: Condicao; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-roxo/80 px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide uppercase ${estilos[condicao]} ${className}`}
    >
      {CONDICAO_LABEL[condicao]}
    </span>
  );
}
