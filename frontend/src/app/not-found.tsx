import { ButtonLink } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
import { ROUTES } from "@/lib/routes";

/**
 * Página 404. Também cobre as rotas dos módulos que ainda estão em
 * desenvolvimento (catálogo, anúncio, conta, sacola...).
 */
export default function NotFound() {
  return (
    <section className="bg-dots relative overflow-hidden">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 py-20 text-center">
        <Sticker tone="lilas" rotate={-4}>
          ops!
        </Sticker>
        <h1 className="mt-6 font-display text-5xl leading-[0.95] font-medium tracking-[-0.04em] text-balance text-roxo sm:text-7xl">
          essa página ainda tá <span className="text-violeta italic">no provador</span>
        </h1>
        <p className="mt-6 max-w-md text-lg text-roxo-soft">
          ou ela não existe, ou a gente ainda está costurando esta parte do desaPego. enquanto isso, que tal voltar pro
          começo?
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <ButtonLink href={ROUTES.home} variant="violeta" size="lg">
            voltar pra home
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
