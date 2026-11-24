import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { criarAppCatalogo } from "./app.js";
import type { GestaoPedidos } from "./gestao.js";
import { abrirLoja } from "./loja.js";

const SEMENTE = fileURLToPath(new URL("../../db.seed.json", import.meta.url));
const CHAVE = "chave-de-teste-da-integracao";
const SEGREDO = new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres");
const ORIGEM = "http://localhost:3000";
const MINUTO = 60_000;
const ANA = "conta-ana";
const BIA = "conta-bia";
const ENDERECO = { cep: "70000-000", logradouro: "Rua A", numero: "10", bairro: "Asa Sul", cidade: "Brasília", uf: "df" };
const COMPRADOR = { nome: "Ana Souza", email: "Ana@Exemplo.com" };

/** Módulo 05 de mentira: aceita tudo, porque aqui só interessa o estado das peças. */
const gestao: GestaoPedidos = {
  criar: async () => ({ id: "gestao-1" }),
  confirmarPagamento: async () => {},
  expirar: async () => {},
};

const loja = abrirLoja(null, SEMENTE);
let relogio: number;
let app: ReturnType<typeof criarAppCatalogo>;

beforeEach(() => {
  loja.restaurar();
  relogio = Date.now();
  app = criarAppCatalogo(
    loja,
    { origens: [ORIGEM], apiKeys: [CHAVE], trustProxy: "loopback", reservaMinutos: 15, freteCentavos: 1990, jwtSegredo: SEGREDO, gestao },
    () => relogio,
  );
});

/** Cabeçalho de login de uma conta (o token que o serviço de contas emite). */
const conta = async (sub: string) => ({
  Authorization: `Bearer ${await new SignJWT({ nome: sub, perfil: "USUARIO" }).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setExpirationTime("15m").sign(SEGREDO)}`,
});

const disponivel = () => loja.listarPecas().find((p) => p.status === "disponivel")!;
const reservar = async (sub: string, pecaId: string) => request(app).post(`/pecas/${pecaId}/reservar`).set(await conta(sub)).expect(200);
const fazerPedido = async (sub: string, pecaId: string) =>
  (await request(app).post("/pedidos").set(await conta(sub)).send({ comprador: COMPRADOR, endereco: ENDERECO, itens: [pecaId] }).expect(201)).body;

describe("reserva vencida: o dado gravado acompanha o relógio (issue #010)", () => {
  it("peça que ficou na sacola e venceu volta a ser gravada como disponível", async () => {
    const peca = disponivel();
    await reservar(ANA, peca.id);

    relogio += 16 * MINUTO;
    // a vitrine já a trata como disponível (statusAtual), mas o dado gravado ainda diz "reservada"
    expect(loja.peca(peca.id)?.status).toBe("reservada");

    expect(await app.compras.liberarReservasVencidas()).toBe(1);

    expect(loja.peca(peca.id)).toMatchObject({ status: "disponivel", reservadaAte: null, reservadaPor: null });
  });

  it("não mexe em reserva ainda válida nem em reserva nova de outra pessoa", async () => {
    const peca = disponivel();
    await reservar(ANA, peca.id);

    relogio += 14 * MINUTO;
    expect(await app.compras.liberarReservasVencidas()).toBe(0);
    expect(loja.peca(peca.id)).toMatchObject({ status: "reservada", reservadaPor: ANA });

    // a reserva da Ana vence e a Bia reserva a mesma peça antes de a varredura rodar
    relogio += 2 * MINUTO;
    await reservar(BIA, peca.id);
    expect(await app.compras.liberarReservasVencidas()).toBe(0);
    expect(loja.peca(peca.id)).toMatchObject({ status: "reservada", reservadaPor: BIA });
  });

  it("peça vendida continua vendida", async () => {
    const peca = disponivel();
    await reservar(ANA, peca.id);
    const pedido = await fazerPedido(ANA, peca.id);
    await request(app).post(`/integracao/pagamentos/${pedido.id}/confirmar`).set("X-API-Key", CHAVE).expect(200);

    relogio += 60 * MINUTO;
    expect(await app.compras.liberarReservasVencidas()).toBe(0);
    expect(loja.peca(peca.id)?.status).toBe("vendida");
  });

  it("Pix vencido: a varredura e o cancelamento do pedido podem rodar em qualquer ordem", async () => {
    const peca = disponivel();
    await reservar(ANA, peca.id);
    const pedido = await fazerPedido(ANA, peca.id);

    relogio += 16 * MINUTO;
    expect(await app.compras.liberarReservasVencidas()).toBe(1);
    await app.compras.expirarVencidos();

    expect(loja.pedido(pedido.id)?.status).toBe("cancelado");
    expect(loja.peca(peca.id)).toMatchObject({ status: "disponivel", reservadaPor: null });
  });

  it("se o cancelamento do Pix rodou primeiro, a varredura não encontra mais nada", async () => {
    const peca = disponivel();
    await reservar(ANA, peca.id);
    await fazerPedido(ANA, peca.id);

    relogio += 16 * MINUTO;
    await app.compras.expirarVencidos();
    expect(await app.compras.liberarReservasVencidas()).toBe(0);
    expect(loja.peca(peca.id)?.status).toBe("disponivel");
  });
    it("peça de um pedido que ainda espera o Pix nunca é liberada, mesmo com a reserva marcada como vencida", async () => {
    const peca = disponivel();
    await reservar(ANA, peca.id);
    await fazerPedido(ANA, peca.id);

    // dado inconsistente de propósito: a reserva da peça venceu, mas o prazo do Pix ainda não
    loja.peca(peca.id)!.reservadaAte = new Date(relogio - MINUTO).toISOString();

    expect(await app.compras.liberarReservasVencidas()).toBe(0);
    expect(loja.peca(peca.id)).toMatchObject({ status: "reservada", reservadaPor: ANA });
  });
});
