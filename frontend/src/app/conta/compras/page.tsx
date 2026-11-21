import type { Metadata } from "next";
import { PaginaPedidos } from "@/components/pedidos/PaginaPedidos";

export const metadata: Metadata = { title: "minhas compras" };

export default function MinhasComprasPage() {
  return <PaginaPedidos papel="compradora" />;
}
