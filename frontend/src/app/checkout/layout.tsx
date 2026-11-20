import type { Metadata } from "next";

// a página é um componente de cliente; o título da aba fica neste layout
export const metadata: Metadata = { title: "fechar a compra" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
