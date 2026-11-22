import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { IconInstagram, IconPinterest, IconTiktok } from "@/components/ui/icons";
import { ROUTES } from "@/lib/routes";

const COLUNAS = [
  {
    titulo: "como funciona",
    links: [
      { href: ROUTES.comoFunciona, label: "comprar e vender" },
      { href: ROUTES.sobre, label: "sobre o desaPego" },
      { href: ROUTES.termos, label: "termos de uso" },
      { href: ROUTES.privacidade, label: "privacidade (LGPD)" },
    ],
  },
  {
    titulo: "pra quem compra",
    links: [
      { href: ROUTES.catalogo, label: "explorar peças" },
      { href: ROUTES.carrinho, label: "sacola e reserva" },
      { href: `${ROUTES.ajuda}#pix`, label: "pagamento via Pix" },
      { href: ROUTES.minhasCompras, label: "acompanhar pedido" },
    ],
  },
  {
    titulo: "pra quem vende",
    links: [
      { href: ROUTES.anunciar, label: "anunciar uma peça" },
      { href: `${ROUTES.ajuda}#simulador`, label: "quanto vou receber" },
      { href: `${ROUTES.ajuda}#chave-pix`, label: "cadastrar chave Pix" },
      { href: ROUTES.carteira, label: "carteira e repasses" },
    ],
  },
  {
    titulo: "ajuda e contato",
    links: [
      { href: ROUTES.ajuda, label: "central de ajuda" },
      { href: ROUTES.contato, label: "fale com a gente" },
      { href: ROUTES.entrar, label: "entrar na conta" },
    ],
  },
];

// TODO: trocar pelos perfis oficiais quando forem criados.
const REDES = [
  { href: "https://www.instagram.com/", label: "Instagram", Icon: IconInstagram },
  { href: "https://www.tiktok.com/", label: "TikTok", Icon: IconTiktok },
  { href: "https://www.pinterest.com/", label: "Pinterest", Icon: IconPinterest },
];

export function SiteFooter() {
  const ano = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-roxo text-nevoa">
      <div className="mx-auto max-w-7xl px-4 pt-16 pb-8 sm:px-6 lg:px-8 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <LogoMark tom="nevoa" className="text-4xl" />
            <p className="mt-4 text-[0.95rem] leading-relaxed text-nevoa/80">
              o brechó online comunitário onde qualquer pessoa anuncia as peças paradas no armário, vê quanto vai
              receber e vende com pagamento via Pix. roupa boa merece outra história.
            </p>
            <ul className="mt-6 flex gap-2" aria-label="Redes sociais">
              {REDES.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`desaPego no ${label} (abre em nova aba)`}
                    className="grid size-11 place-items-center rounded-full border-2 border-nevoa/40 transition-all hover:-translate-y-0.5 hover:border-rosa hover:bg-rosa hover:text-roxo"
                  >
                    <Icon size={20} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Rodapé" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {COLUNAS.map((coluna) => (
              <div key={coluna.titulo}>
                <h2 className="font-hand text-2xl text-rosa">{coluna.titulo}</h2>
                <ul className="mt-3 space-y-2.5">
                  {coluna.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-nevoa/80 underline-offset-4 transition-colors hover:text-nevoa hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div
          aria-hidden="true"
          // marca d'água decorativa: o WCAG 1.4.3 isenta texto puramente decorativo do contraste mínimo
          data-decorativo
          className="mt-16 flex items-center justify-center gap-4 pb-[0.06em] font-display text-[22vw] leading-none font-semibold tracking-[-0.06em] text-nevoa/10 select-none lg:text-[17rem]"
        >
          <span>
            <span className="italic">desa</span>Pego
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-nevoa/20 pt-6 text-xs text-nevoa/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© {ano} desaPego. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
