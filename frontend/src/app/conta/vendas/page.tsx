import type { Metadata } from "next";
import { PaginaPedidos } from "@/components/pedidos/PaginaPedidos";

export const metadata: Metadata = { title: "minhas vendas" };

export default function MinhasVendasPage() {
  return <PaginaPedidos papel="vendedora" />;
}
