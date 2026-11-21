import type { Metadata } from "next";
import { PaginaCarteira } from "@/components/carteira/PaginaCarteira";

export const metadata: Metadata = { title: "minha carteira" };

export default function CarteiraPage() {
  return <PaginaCarteira />;
}
