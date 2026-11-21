"use client";

import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { buttonClasses } from "@/components/ui/Button";
import type { Papel } from "@/lib/api/meusPedidos";
import { ROUTES } from "@/lib/routes";
import { useSessaoObrigatoria } from "@/lib/useSessaoObrigatoria";
import { ListaDePedidos } from "./ListaDePedidos";

const ABAS: { papel: Papel; href: string; texto: string }[] = [
  { papel: "compradora", href: ROUTES.minhasCompras, texto: "minhas compras" },
  { papel: "vendedora", href: ROUTES.minhasVendas, texto: "minhas vendas" },
];

/**
 * Compras ou vendas da conta logada (Req. 013). Rota privada: sem sessão vai para o login.
 * Uma mesma conta compra e vende, então as duas listas ficam lado a lado.
 */
export function PaginaPedidos({ papel }: { papel: Papel }) {
  const sessao = useSessaoObrigatoria();

  if (!sessao) {
    return (
      <p role="status" className="min-h-[60vh] px-4 py-24 text-center text-roxo-soft">
        carregando sua conta…
      </p>
    );
  }

  return (
    <section className="bg-dots">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
        <SectionHeading eyebrow="minha conta">
          {papel === "compradora" ? (
            <>
              minhas <span className="text-violeta italic">compras</span>
            </>
          ) : (
            <>
              minhas <span className="text-violeta italic">vendas</span>
            </>
          )}
        </SectionHeading>
        <p className="mt-4 text-lg text-roxo-soft">
          {papel === "compradora"
            ? "acompanhe cada peça do pagamento até chegar na sua casa. quando chegar, confirme o recebimento."
            : "veja o que você vendeu, para onde enviar e quanto vai receber. marque como enviado depois de postar."}
        </p>

        <nav aria-label="compras e vendas" className="mt-8">
          <ul className="flex flex-wrap gap-3">
            {ABAS.map((aba) => (
              <li key={aba.papel}>
                <Link
                  href={aba.href}
                  aria-current={aba.papel === papel ? "page" : undefined}
                  className={buttonClasses(aba.papel === papel ? "roxo" : "nevoa", "md")}
                >
                  {aba.texto}
                </Link>
              </li>
            ))}
            <li>
              <Link href={ROUTES.conta} className={buttonClasses("fantasma", "md")}>
                voltar pra minha conta
              </Link>
            </li>
          </ul>
        </nav>

        <ListaDePedidos papel={papel} />
      </div>
    </section>
  );
}
