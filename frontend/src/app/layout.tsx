import type { Metadata, Viewport } from "next";
import { Caveat, DM_Sans, Fraunces } from "next/font/google";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AplicarPreferencias } from "@/components/acessibilidade/AplicarPreferencias";
import { BarraAcessibilidade } from "@/components/acessibilidade/BarraAcessibilidade";
import { SCRIPT_PREFERENCIAS } from "@/lib/preferencias";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "desaPego · brechó online comunitário",
    template: "%s · desaPego",
  },
  description:
    "Compre e venda roupas, calçados, bolsas e acessórios que merecem outro armário. Anuncie suas peças, veja quanto vai receber e pague com Pix.",
};

export const viewport: Viewport = {
  themeColor: "#faf6fd",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      data-tema="claro"
      // o script abaixo ajusta data-tema antes da hidratação (tema salvo ou do sistema)
      suppressHydrationWarning
      className={`${fraunces.variable} ${dmSans.variable} ${caveat.variable}`}
    >
      {/* espaço reservado para a barra de acessibilidade: embaixo no celular, à esquerda a partir de md */}
      <body className="min-h-dvh pb-16 antialiased md:pb-0 md:pl-14">
        {/*
          Ajusta o tema antes da primeira pintura. Fica no início do <body>, e não no <head>: extensões
          do navegador (e o Cypress) inserem scripts no <head>, e o React acusaria erro de hidratação.
        */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_PREFERENCIAS }} />
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-roxo focus:px-4 focus:py-2 focus:text-nevoa"
        >
          pular para o conteúdo
        </a>
        <SiteHeader />
        <main id="conteudo">{children}</main>
        <SiteFooter />
        <BarraAcessibilidade />
        <AplicarPreferencias />
      </body>
    </html>
  );
}
