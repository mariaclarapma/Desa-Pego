import { ButtonLink } from "@/components/ui/Button";
import { ROUTES } from "@/lib/routes";

/** Req. 002: só quem tem chave Pix anuncia. Aparece no lugar do formulário. */
export function AvisoChavePix() {
  return (
    <div className="rounded-[1.5rem] border-2 border-roxo bg-lilas-100 p-6 sm:p-8">
      <h2 className="font-display text-2xl font-medium">cadastre sua chave Pix para anunciar</h2>
      <p className="mt-2 max-w-xl text-roxo-soft">
        é para essa chave que vai o dinheiro das suas vendas. depois de cadastrar, é só voltar aqui.
      </p>
      <ButtonLink href={ROUTES.vendedora} variant="violeta" className="mt-6">
        cadastrar chave Pix
      </ButtonLink>
    </div>
  );
}
