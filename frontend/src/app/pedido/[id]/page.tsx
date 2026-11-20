"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Contagem } from "@/components/sacola/Contagem";
import { ApiIndisponivel } from "@/components/ui/ApiIndisponivel";
import { buttonClasses, ButtonLink } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
import { buscarPedido } from "@/lib/api/pedidos";
import { formatarPreco } from "@/lib/format";
import { catalogoUrl } from "@/lib/routes";
import type { Pedido } from "@/types/pedido";
import { confirmarPagamentoDemo } from "./acoes";

/** QR Code ilustrativo (não é um QR real): desenha quadradinhos a partir do código Pix. */
function QrIlustrativo({ codigo }: { codigo: string }) {
  const n = 21;
  const celulas = Array.from({ length: n * n }, (_, i) => (codigo.charCodeAt(i % codigo.length) * (i + 7)) % 3 === 0);
  const canto = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="size-48 rounded-xl border-2 border-roxo p-2" style={{ background: "#ffffff" }} role="img" aria-label="QR Code do Pix (ilustrativo)">
      {celulas.map((preto, i) => {
        const x = i % n;
        const y = Math.floor(i / n);
        if (canto(x, y)) {
          const borda = x % (n - 7) === 0 || y % (n - 7) === 0 || x % (n - 7) === 6 || y % (n - 7) === 6;
          const miolo = [2, 3, 4].includes(x % (n - 7)) && [2, 3, 4].includes(y % (n - 7));
          return borda || miolo ? <rect key={i} x={x} y={y} width={1} height={1} fill="#4a1259" /> : null;
        }
        return preto ? <rect key={i} x={x} y={y} width={1} height={1} fill="#4a1259" /> : null;
      })}
    </svg>
  );
}

export default function PedidoPage() {
  // rota dinâmica /pedido/[id], lida no navegador com useParams()
  const { id } = useParams<{ id: string }>();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [erroPagamento, setErroPagamento] = useState("");
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(() => {
    buscarPedido(id).then(setPedido).catch(() => setFalhou(true));
  }, [id]);
  useEffect(carregar, [carregar]);

  async function simularPagamento() {
    if (!pedido) return;
    setPagando(true);
    setErroPagamento("");
    try {
      setPedido(await confirmarPagamentoDemo(pedido.id));
    } catch (erro) {
      setErroPagamento(erro instanceof Error ? erro.message : "não deu para confirmar o pagamento.");
    } finally {
      setPagando(false);
    }
  }

  async function copiar() {
    if (!pedido) return;
    await navigator.clipboard.writeText(pedido.pixCopiaECola);
    setCopiado(true);
  }

  if (falhou) return <ApiIndisponivel />;
  if (!pedido) return <div className="min-h-[60vh]" />;

  const pago = pedido.status === "pago";
  const expirado = !pago && new Date(pedido.pixExpiraEm) <= new Date();

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 text-center sm:px-6 lg:py-16">
      <Sticker tone={pago ? "rosa" : "lilas"} rotate={-3}>
        pedido #{pedido.id.slice(0, 6)}
      </Sticker>
      <h1 className="mt-6 font-display text-5xl leading-[0.95] font-medium tracking-[-0.04em] text-balance">
        {pago ? (
          <>
            pagamento <span className="text-violeta italic">confirmado!</span>
          </>
        ) : (
          "pague com Pix pra garantir"
        )}
      </h1>

      {pago ? (
        <p className="mt-5 text-lg text-roxo-soft">
          obrigado, {pedido.comprador.nome.split(" ")[0]}! as peças agora são suas e quem vendeu já foi avisado pra enviar.
        </p>
      ) : expirado ? (
        <p className="mt-5 text-lg text-roxo-soft">o prazo do Pix acabou e as peças voltaram pra vitrine.</p>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-5">
          <QrIlustrativo codigo={pedido.pixCopiaECola} />
          <p className="text-sm text-roxo-soft">
            o código expira em <Contagem ate={pedido.pixExpiraEm} onExpirar={carregar} />
          </p>
          <div className="w-full rounded-2xl border-2 border-roxo bg-white/70 p-3 text-left font-mono text-xs break-all">{pedido.pixCopiaECola}</div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={copiar} className={buttonClasses("nevoa", "md")}>
              {copiado ? "copiado!" : "copiar código Pix"}
            </button>
            {/* faz o papel do webhook do Mercado Pago (PixSimuladoProvider) */}
            <button type="button" onClick={simularPagamento} disabled={pagando} className={buttonClasses("violeta", "md")}>
              {pagando ? "confirmando…" : "simular pagamento (demo)"}
            </button>
          </div>
          {erroPagamento ? (
            <p role="alert" className="text-sm font-medium text-magenta">
              {erroPagamento}
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-10 rounded-[1.5rem] border-2 border-roxo bg-nevoa p-5 text-left text-sm">
        <ul className="space-y-1">
          {pedido.itens.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.titulo}</span>
              <span>{formatarPreco(item.precoCentavos)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 text-roxo-soft">
            <span>frete fixo</span>
            <span>{formatarPreco(pedido.freteCentavos)}</span>
          </li>
        </ul>
        <p className="mt-3 flex justify-between border-t-2 border-roxo/20 pt-3 text-base font-bold">
          <span>total</span>
          <span>{formatarPreco(pedido.totalCentavos)}</span>
        </p>
        <p className="mt-3 text-roxo-soft">
          entrega: {pedido.endereco.logradouro}, {pedido.endereco.numero} · {pedido.endereco.cidade}/{pedido.endereco.uf}
        </p>
      </div>

      <ButtonLink href={catalogoUrl()} variant="roxo" size="lg" className="mt-10">
        continuar garimpando
      </ButtonLink>
    </section>
  );
}
