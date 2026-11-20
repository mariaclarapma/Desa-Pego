import type { Metadata } from "next";
import { PaginaConta } from "@/components/conta/PaginaConta";

export const metadata: Metadata = { title: "entrar" };

export default function EntrarPage() {
  return <PaginaConta modoInicial="entrar" />;
}
