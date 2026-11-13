import { CONDICAO_LABEL } from "@/lib/format";
import type { Condicao } from "@/types/catalogo";

const estilos: Record<Condicao, string> = {
  nova_com_etiqueta: "bg-chiclete text-vinho",
  otimo_estado: "bg-lilas text-vinho",
  bom_estado: "bg-pessego text-vinho",
  com_marcas_de_uso: "bg-creme-200 text-vinho",
};

/**
 * Selo padronizado de condição da peça (Req. 004).
 * Componente único para vitrine, detalhes e formulário de anúncio.
 */
export function ConditionBadge({ condicao, className = "" }: { condicao: Condicao; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-vinho/80 px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide uppercase ${estilos[condicao]} ${className}`}
    >
      {CONDICAO_LABEL[condicao]}
    </span>
  );
}
