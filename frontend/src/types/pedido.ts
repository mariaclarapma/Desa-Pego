export type StatusPedido = "aguardando_pagamento" | "pago" | "cancelado";

export interface EnderecoEntrega {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface ItemPedido {
  id: string;
  titulo: string;
  precoCentavos: number;
}

export interface Pedido {
  id: string;
  comprador: { nome: string; email: string };
  endereco: EnderecoEntrega;
  itens: ItemPedido[];
  subtotalCentavos: number;
  freteCentavos: number;
  totalCentavos: number;
  status: StatusPedido;
  /** Código Pix "copia e cola" (simulado em desenvolvimento). */
  pixCopiaECola: string;
  pixExpiraEm: string;
  criadoEm: string;
}
