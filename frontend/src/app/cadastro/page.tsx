import type { Metadata } from "next";
import { PaginaConta } from "@/components/conta/PaginaConta";

export const metadata: Metadata = { title: "criar conta" };

export default function CadastroPage() {
  return <PaginaConta modoInicial="cadastro" />;
}
