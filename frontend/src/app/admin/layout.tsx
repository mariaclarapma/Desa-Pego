import type { Metadata } from "next";

// a página é um componente de cliente; o título da aba fica neste layout
export const metadata: Metadata = { title: "painel da administração", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
