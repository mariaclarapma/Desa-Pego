"use client";

import Link from "next/link";
import { useRef } from "react";
import { Logo } from "@/components/brand/Logo";
import { buttonClasses } from "@/components/ui/Button";
import { IconArrowRight, IconBag, IconClose, IconMenu, IconSparkle, IconUser } from "@/components/ui/icons";
import { CATEGORIAS } from "@/data/demo/catalogo";
import { catalogoUrl, ROUTES } from "@/lib/routes";
import { SearchForm } from "./SearchForm";

const AVISOS = [
  "pagamento via Pix",
  "peça única, reservada pra você no checkout",
  "veja quanto vai receber antes de anunciar",
  "compra e venda entre pessoas",
];

const LINKS_CONTA = [
  { href: ROUTES.entrar, label: "entrar ou criar conta" },
  { href: ROUTES.minhasCompras, label: "minhas compras" },
  { href: ROUTES.meusAnuncios, label: "meus anúncios" },
  { href: ROUTES.carteira, label: "minha carteira" },
  { href: ROUTES.comoFunciona, label: "como funciona" },
  { href: ROUTES.ajuda, label: "ajuda" },
];

function AnnouncementBar() {
  const itens = [...AVISOS, ...AVISOS];
  return (
    <div className="overflow-hidden bg-vinho text-creme">
      <p className="sr-only">{AVISOS.join(". ")}</p>
      <div aria-hidden="true" className="flex w-max animate-marquee py-1.5 hover:[animation-play-state:paused]">
        {[0, 1].map((bloco) => (
          <ul key={bloco} className="flex shrink-0 items-center">
            {itens.map((aviso, i) => (
              <li key={`${bloco}-${i}`} className="flex items-center gap-4 px-4 text-xs font-medium tracking-wide">
                <IconSparkle size={10} className="text-chiclete" />
                {aviso}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function SiteHeader() {
  const menuRef = useRef<HTMLDialogElement>(null);

  const abrirMenu = () => menuRef.current?.showModal();
  const fecharMenu = () => menuRef.current?.close();

  return (
    <>
      <AnnouncementBar />
      <header className="sticky top-0 z-50 border-b-2 border-vinho bg-creme/90 backdrop-blur-md supports-[backdrop-filter]:bg-creme/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6 lg:h-[4.5rem] lg:px-8">
          <button
            type="button"
            onClick={abrirMenu}
            aria-label="Abrir menu"
            aria-haspopup="dialog"
            className="-ml-1 grid size-10 place-items-center rounded-full text-vinho transition-colors hover:bg-chiclete-100 lg:hidden"
          >
            <IconMenu />
          </button>

          <Logo className="shrink-0" />

          <SearchForm className="mx-auto hidden w-full max-w-xl md:block" />

          <nav aria-label="Atalhos da conta" className="ml-auto flex items-center gap-1 sm:gap-2 md:ml-0">
            <Link href={ROUTES.anunciar} className={buttonClasses("cereja", "sm", "mr-1 !h-9 !px-3.5 sm:mr-2 sm:!h-10 sm:!px-5")}>
              <span aria-hidden="true" className="text-lg leading-none">
                +
              </span>
              <span>
                anunciar<span className="hidden sm:inline"> peça</span>
              </span>
            </Link>
            <Link
              href={ROUTES.conta}
              aria-label="Minha conta"
              className="hidden size-10 place-items-center rounded-full text-vinho transition-colors hover:bg-chiclete-100 sm:grid"
            >
              <IconUser />
            </Link>
            <Link
              href={ROUTES.carrinho}
              aria-label="Sacola de compras"
              className="grid size-10 place-items-center rounded-full text-vinho transition-colors hover:bg-chiclete-100"
            >
              <IconBag />
            </Link>
          </nav>
        </div>

        <div className="px-4 pb-3 sm:px-6 md:hidden">
          <SearchForm />
        </div>

        <nav aria-label="Categorias" className="hidden border-t border-vinho/15 lg:block">
          <ul className="mx-auto flex max-w-7xl items-center justify-center gap-1 px-8 py-1.5">
            <li>
              <Link
                href={catalogoUrl({ ordem: "recentes" })}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold text-cereja transition-colors hover:bg-chiclete-100"
              >
                <IconSparkle size={12} /> novidades
              </Link>
            </li>
            {CATEGORIAS.map((categoria) => (
              <li key={categoria.slug}>
                <Link
                  href={catalogoUrl({ categoria: categoria.slug })}
                  className="relative inline-flex rounded-full px-4 py-1.5 text-sm font-medium text-vinho transition-colors after:absolute after:inset-x-4 after:bottom-1 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-chiclete after:transition-transform hover:text-cereja hover:after:scale-x-100"
                >
                  {categoria.nome}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={ROUTES.comoFunciona}
                className="inline-flex rounded-full px-4 py-1.5 text-sm font-medium text-vinho-soft transition-colors hover:text-cereja"
              >
                como funciona
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      {/* Menu mobile: <dialog> nativo cuida do foco, do Esc e do fundo inerte. */}
      <dialog
        ref={menuRef}
        aria-label="Menu"
        onClick={(e) => {
          if (e.target === e.currentTarget) fecharMenu();
        }}
        className="m-0 h-dvh max-h-none w-[min(88vw,380px)] max-w-none overflow-y-auto border-r-2 border-vinho bg-creme p-0 text-vinho backdrop:bg-vinho/45 backdrop:backdrop-blur-sm"
      >
        <div className="flex min-h-full flex-col">
          <div className="flex items-center justify-between border-b-2 border-vinho px-5 py-4">
            <Logo />
            <button
              type="button"
              onClick={fecharMenu}
              aria-label="Fechar menu"
              autoFocus
              className="grid size-10 place-items-center rounded-full border-2 border-vinho transition-colors hover:bg-chiclete"
            >
              <IconClose size={18} />
            </button>
          </div>

          <nav aria-label="Categorias" className="bg-dots px-5 py-6">
            <p className="mb-3 text-xs font-bold tracking-[0.2em] text-cereja uppercase">garimpa por categoria</p>
            <ul className="space-y-1">
              {CATEGORIAS.map((categoria) => (
                <li key={categoria.slug}>
                  <Link
                    href={catalogoUrl({ categoria: categoria.slug })}
                    onClick={fecharMenu}
                    className="group flex items-center justify-between rounded-2xl px-3 py-2.5 font-display text-3xl tracking-tight transition-colors hover:bg-chiclete-100"
                  >
                    {categoria.nome}
                    <IconArrowRight
                      size={20}
                      className="-translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Conta e ajuda" className="border-t-2 border-vinho px-5 py-5">
            <ul className="grid gap-1">
              {LINKS_CONTA.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={fecharMenu}
                    className="block rounded-xl px-3 py-2 font-medium transition-colors hover:bg-chiclete-100"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto bg-gingham p-5">
            <Link href={ROUTES.anunciar} onClick={fecharMenu} className={buttonClasses("cereja", "lg", "w-full")}>
              quero desapegar
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
