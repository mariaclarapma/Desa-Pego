"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { buscarPeca } from "@/lib/api/catalogo";
import { criarPedido } from "@/lib/api/pedidos";
import { useFrete } from "@/lib/useFrete";
import { formatarPreco } from "@/lib/format";
import { pedidoUrl, ROUTES } from "@/lib/routes";
import { subtotalSacola, useSacola } from "@/lib/sacola";
import type { EnderecoEntrega } from "@/types/pedido";

const campo =
  "h-12 w-full rounded-2xl border-2 border-roxo bg-white/70 px-4 text-roxo focus:bg-white focus:shadow-[3px_3px_0_0_var(--color-rosa)] focus:outline-none";

/** Campo do checkout com rótulo visível (o placeholder sozinho não serve de rótulo: WCAG 3.3.2). */
function Campo({ id, rotulo, ...props }: { id: string; rotulo: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-roxo">
        {rotulo}
      </label>
      <input id={id} name={id.replace("checkout-", "")} className={campo} {...props} />
    </div>
  );
}

const VAZIO = { nome: "", email: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" };

export default function CheckoutPage() {
  const router = useRouter();
  const { itens, esvaziar, removerExpirados } = useSacola();
  const [montado, setMontado] = useState(false);
  const frete = useFrete();
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
      // preço, frete e total são calculados pelo servidor a partir do catálogo
      const pedido = await criarPedido({
        comprador: { nome, email },
        endereco: endereco as EnderecoEntrega,
        itens: itens.map((i) => i.id),
      });
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
          <Campo id="checkout-nome" rotulo="nome completo" required autoComplete="name" value={dados.nome} onChange={mudar("nome")} />
          <Campo id="checkout-email" rotulo="e-mail" required type="email" autoComplete="email" value={dados.email} onChange={mudar("email")} />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-3 text-xs font-bold tracking-[0.18em] text-violeta uppercase">2 · entrega</legend>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <Campo
              id="checkout-cep"
              rotulo="CEP"
              required
              placeholder="00000-000"
              inputMode="numeric"
              maxLength={9}
              autoComplete="postal-code"
              aria-describedby="checkout-cep-status"
              value={dados.cep}
              onChange={mudar("cep")}
              onBlur={completarCep}
            />
            <Campo id="checkout-logradouro" rotulo="rua / avenida" required autoComplete="address-line1" value={dados.logradouro} onChange={mudar("logradouro")} />
          </div>
          <p id="checkout-cep-status" aria-live="polite" className="min-h-5 text-sm text-roxo-soft">
            {buscandoCep ? "buscando endereço pelo CEP…" : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <Campo id="checkout-numero" rotulo="número" required autoComplete="address-line2" value={dados.numero} onChange={mudar("numero")} />
            <Campo id="checkout-complemento" rotulo="complemento (opcional)" autoComplete="address-line3" value={dados.complemento} onChange={mudar("complemento")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_90px]">
            <Campo id="checkout-bairro" rotulo="bairro" required value={dados.bairro} onChange={mudar("bairro")} />
            <Campo id="checkout-cidade" rotulo="cidade" required autoComplete="address-level2" value={dados.cidade} onChange={mudar("cidade")} />
            <Campo id="checkout-uf" rotulo="UF" required maxLength={2} autoComplete="address-level1" value={dados.uf} onChange={mudar("uf")} />
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
            <dd>{formatarPreco(frete)}</dd>
          </div>
          <div className="flex justify-between text-base font-bold">
            <dt>total</dt>
            <dd>{formatarPreco(subtotal + frete)}</dd>
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
