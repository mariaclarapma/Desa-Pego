import { formatarPercentual, simularGanho, validarPreco, type TaxasPlataforma } from "@desapego/core/pricing";
import { formatarPreco } from "@/lib/format";

/**
 * Simulador de ganho (Req. 005): recalcula a cada tecla com a mesma função que a carteira usa
 * (@desapego/core/pricing), então o valor mostrado é o valor que a vendedora recebe.
 * A comissão incide sobre a peça; a taxa do Pix, sobre tudo o que a compradora paga (peça + frete);
 * o frete fica com a vendedora, que envia a peça.
 */
export function SimuladorGanho({
  precoCentavos,
  freteCentavos,
  taxas,
}: {
  precoCentavos: number | null;
  freteCentavos: number;
  taxas: TaxasPlataforma;
}) {
  const valido = precoCentavos !== null && validarPreco(precoCentavos) === null;
  const r = valido ? simularGanho(precoCentavos, freteCentavos, taxas) : null;
  const valor = (centavos: number | undefined, sinal = "") => (centavos === undefined ? "—" : `${sinal}${formatarPreco(centavos)}`);

  return (
    <section aria-labelledby="simulador-titulo" className="rounded-[1.25rem] border-2 border-roxo bg-lilas-100 p-5">
      <h3 id="simulador-titulo" className="text-sm font-bold">
        quanto você recebe
      </h3>
      <dl aria-live="polite" className="mt-3 space-y-1.5 text-sm tabular-nums">
        <div className="flex justify-between gap-3">
          <dt>preço da peça</dt>
          <dd className="shrink-0 whitespace-nowrap">{valor(r?.subtotalCentavos)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-roxo-soft">
          <dt>comissão da plataforma ({formatarPercentual(taxas.comissaoPontosBase)})</dt>
          <dd className="shrink-0 whitespace-nowrap">{valor(r?.comissaoCentavos, "− ")}</dd>
        </div>
        <div className="flex justify-between gap-3 text-roxo-soft">
          <dt>frete pago por quem compra (você envia)</dt>
          <dd className="shrink-0 whitespace-nowrap">{valor(r?.freteCentavos, "+ ")}</dd>
        </div>
        <div className="flex justify-between gap-3 text-roxo-soft">
          <dt>taxa do Pix ({formatarPercentual(taxas.taxaPixPontosBase)} sobre peça + frete)</dt>
          <dd className="shrink-0 whitespace-nowrap">{valor(r?.taxaPixCentavos, "− ")}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t-2 border-roxo/20 pt-2">
          <dt className="font-semibold">você recebe</dt>
          <dd className="font-display text-2xl font-semibold text-violeta">{valor(r?.vendedoraCentavos)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-roxo-soft">
        conta para a peça vendida sozinha. se a mesma pessoa comprar mais de uma peça sua, o frete entra uma vez só no
        pedido. o valor fica na carteira até quem comprou confirmar o recebimento.
      </p>
    </section>
  );
}
