"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { buscarPeca } from "@/lib/api/catalogo";
import { criarPedido } from "@/lib/api/pedidos";
import { FRETE_FIXO_CENTAVOS } from "@/lib/config";
import { formatarPreco } from "@/lib/format";
import { pedidoUrl, ROUTES } from "@/lib/routes";
import { subtotalSacola, useSacola } from "@/lib/sacola";
import type { EnderecoEntrega } from "@/types/pedido";

const campo =
  "h-12 w-full rounded-2xl border-2 border-roxo bg-white/70 px-4 text-roxo focus:bg-white focus:shadow-[3px_3px_0_0_var(--color-rosa)] focus:outline-none";

const VAZIO = { nome: "", email: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" };

export default function CheckoutPage() {
  const router = useRouter();
  const { itens, esvaziar, removerExpirados } = useSacola();
  const [montado, setMontado] = useState(false);
  const [dados, setDados] = useState(VAZIO);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => setMontado(true), []);
  useEffect(() => {
    if (montado && itens.length === 0 && !enviando) router.replace(ROUTES.carrinho);
  }, [montado, itens.length, enviando, router]);

  const mudar = (chave: keyof typeof VAZIO) => (e: ChangeEvent<HTMLInputElement>) =>
    setDados((d) => ({ ...d, [chave]: e.target.value }));

  // Req. 011: endereço preenchido pelo CEP via ViaCEP
  async function completarCep() {
    const cep = dados.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const json = await r.json();
      if (!json.erro) {
        setDados((d) => ({ ...d, logradouro: json.logradouro, bairro: json.bairro, cidade: json.localidade, uf: json.uf }));
      }
    } catch {
      // sem internet: a pessoa preenche à mão
    } finally {
      setBuscandoCep(false);
    }
  }

  async function finalizar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      // a peça precisa continuar reservada: relemos cada uma da API antes de criar o pedido
      const atuais = await Promise.all(itens.map((i) => buscarPeca(i.id)));
      const perdida = itens.find((item, i) => {
        const p = atuais[i];
        return !p || p.status !== "reservada" || !p.reservadaAte || new Date(p.reservadaAte) <= new Date();
      });
      if (perdida) {
        removerExpirados();
        throw new Error(`A reserva de “${perdida.titulo}” expirou. Volte à sacola e tente de novo.`);
      }

      const { nome, email, ...endereco } = dados;
      const subtotal = subtotalSacola(itens);
      const expiraEm = itens.map((i) => i.reservadaAte).sort()[0];
      const pedido = await criarPedido(
        {
          comprador: { nome, email },
          endereco: endereco as EnderecoEntrega,
          itens: itens.map(({ id, titulo, precoCentavos }) => ({ id, titulo, precoCentavos })),
          subtotalCentavos: subtotal,
          freteCentavos: FRETE_FIXO_CENTAVOS,
          totalCentavos: subtotal + FRETE_FIXO_CENTAVOS,
        },
        expiraEm,
      );
      esvaziar();
      router.push(pedidoUrl(pedido.id));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não deu para criar o pedido.");
      setEnviando(false);
    }
  }

  if (!montado || itens.length === 0) return <div className="min-h-[60vh]" />;

  const subtotal = subtotalSacola(itens);

  return (
    <form onSubmit={finalizar} className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_340px] lg:px-8 lg:py-16">
      <div className="space-y-8">
        <SectionHeading eyebrow="quase lá">fechar a compra</SectionHeading>

        <fieldset className="space-y-3">
          <legend className="mb-3 text-xs font-bold tracking-[0.18em] text-violeta uppercase">1 · seus dados</legend>
          <input required className={campo} placeholder="nome completo" autoComplete="name" value={dados.nome} onChange={mudar("nome")} />
          <input required type="email" className={campo} placeholder="e-mail" autoComplete="email" value={dados.email} onChange={mudar("email")} />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-3 text-xs font-bold tracking-[0.18em] text-violeta uppercase">2 · entrega</legend>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <input
              required
              className={campo}
              placeholder="CEP"
              inputMode="numeric"
              maxLength={9}
              autoComplete="postal-code"
              value={dados.cep}
              onChange={mudar("cep")}
              onBlur={completarCep}
            />
            <input required className={campo} placeholder={buscandoCep ? "buscando endereço…" : "rua / avenida"} value={dados.logradouro} onChange={mudar("logradouro")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <input required className={campo} placeholder="número" value={dados.numero} onChange={mudar("numero")} />
            <input className={campo} placeholder="complemento (opcional)" value={dados.complemento} onChange={mudar("complemento")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_90px]">
            <input required className={campo} placeholder="bairro" value={dados.bairro} onChange={mudar("bairro")} />
            <input required className={campo} placeholder="cidade" value={dados.cidade} onChange={mudar("cidade")} />
            <input required className={campo} placeholder="UF" maxLength={2} value={dados.uf} onChange={mudar("uf")} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-xs font-bold tracking-[0.18em] text-violeta uppercase">3 · pagamento</legend>
          <p className="rounded-2xl border-2 border-roxo bg-lilas-100 p-4 text-sm">
            <strong>Pix.</strong> Depois de confirmar, você recebe o QR Code e o código copia-e-cola. Ambiente de
            demonstração: nenhum pagamento real é feito.
          </p>
        </fieldset>
      </div>

      <aside className="h-fit space-y-4 rounded-[1.5rem] border-2 border-roxo bg-rosa-100 p-6 shadow-[4px_4px_0_0_var(--color-roxo)] lg:mt-24">
        <h2 className="font-display text-2xl font-medium">resumo</h2>
        <ul className="space-y-1 text-sm">
          {itens.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span className="truncate">{i.titulo}</span>
              <span className="shrink-0">{formatarPreco(i.precoCentavos)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t-2 border-roxo/20 pt-3 text-sm">
          <div className="flex justify-between">
            <dt>frete fixo</dt>
            <dd>{formatarPreco(FRETE_FIXO_CENTAVOS)}</dd>
          </div>
          <div className="flex justify-between text-base font-bold">
            <dt>total</dt>
            <dd>{formatarPreco(subtotal + FRETE_FIXO_CENTAVOS)}</dd>
          </div>
        </dl>
        {erro ? (
          <p role="alert" className="rounded-2xl border-2 border-roxo bg-pervinca-100 p-3 text-sm">
            {erro}
          </p>
        ) : null}
        <button type="submit" disabled={enviando} className={buttonClasses("violeta", "lg", "w-full")}>
          {enviando ? "gerando Pix…" : "gerar Pix"}
        </button>
      </aside>
    </form>
  );
}
