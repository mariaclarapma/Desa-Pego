import type { Metadata } from "next";

// as páginas são componentes de cliente; o título da aba fica neste layout
export const metadata: Metadata = { title: "meus anúncios" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
