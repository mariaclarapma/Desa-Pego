import type { Metadata } from "next";

// a página é um componente de cliente; o título da aba fica neste layout
export const metadata: Metadata = { title: "anunciar peça" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
