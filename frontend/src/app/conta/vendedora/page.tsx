import type { Metadata } from "next";
import { PaginaVendedora } from "@/components/conta/PaginaVendedora";

export const metadata: Metadata = { title: "perfil de vendedora" };

export default function VendedoraPage() {
  return <PaginaVendedora />;
}
