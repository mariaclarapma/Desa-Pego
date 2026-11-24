import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { conectar } from "../../comum/postgres.js";
import type { PerfisVendedoras } from "./anuncios.js";
import { criarAppCatalogo } from "./app.js";
import { ArmazenamentoLocal } from "./fotos.js";
import { ArmazenamentoSupabase, BUCKET_ENVIOS, BUCKET_FOTOS } from "./fotos-supabase.js";
import { abrirLoja, abrirLojaBanco, type BancoCatalogo, type Dados } from "./loja.js";
import { aplicarMigracao, exportarCatalogo, jsonCanonico, planejarMigracao } from "./migracao.js";
import { StorageSimulado } from "./storage-simulado.js";

/*
 * Primeiro deploy com DATABASE_URL: o que acontece com o que estava no db.json, e a migração.
 * A "produção" aqui é o catálogo como está hoje na main (db.json em memória + fotos numa pasta),
 * servido em /api como no Render. O destino é o pg-mem (ou TEST_DATABASE_URL) + Storage simulado.
 */

const SEMENTE = fileURLToPath(new URL("../../db.seed.json", import.meta.url));
const SEGREDO = new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres");
const CHAVE = "sb_secret_ficticia_so_para_teste";
const API_KEY = "chave-api-ficticia-de-teste";
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a1e5a0a10000000049454e44ae426082", "hex");
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const URL_TESTE = process.env.TEST_DATABASE_URL || undefined;
const AGORA = Date.now();

const storage = new StorageSimulado(CHAVE, {
  [BUCKET_ENVIOS]: { publico: false, tiposAceitos: ["image/jpeg", "image/png", "image/webp"], limiteBytes: 5 * 1024 * 1024 },
  [BUCKET_FOTOS]: { publico: true },
});

const token = (sub: string, perfil = "USUARIO") =>
  new SignJWT({ nome: sub, perfil, temChavePix: true }).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setExpirationTime("15m").sign(SEGREDO);
const conta = async (sub: string) => ({ Authorization: `Bearer ${await token(sub)}` });

let pasta: string;
let producao: ReturnType<typeof abrirLoja>;
let site: Server;
let base: string;
let db: BancoCatalogo;
let schema: string;
/** O que a produção tem antes do deploy. */
let cenario: { anuncioId: string; fotos: string[]; abandonada: string; reservadaAtiva: string; reservadaVencida: string; vendida: string; pedidoId: string };

beforeAll(() => storage.iniciar());
afterAll(() => storage.parar());

beforeEach(async () => {
  storage.objetos.clear();
  pasta = mkdtempSync(join(tmpdir(), "desapego-migracao-"));
  producao = abrirLoja(null, SEMENTE);
  const perfis: PerfisVendedoras = { buscar: async (id) => ({ nomePublico: id, cidade: "Brasília/DF" }) };
  const catalogo = criarAppCatalogo(producao, {
    origens: ["http://localhost:3000"],
    apiKeys: [API_KEY],
    trustProxy: "loopback",
    reservaMinutos: 15,
    freteCentavos: 1990,
    jwtSegredo: SEGREDO,
    anuncios: { armazenamento: new ArmazenamentoLocal(pasta, "/api/fotos", SEGREDO), perfis, fotoMaxBytes: 5 * 1024 * 1024 },
  });
  // como no Render: o site repassa /api/* para o catálogo
  const app = express().use("/api", catalogo);
  site = await new Promise<Server>((ok) => {
    const s = app.listen(0, "127.0.0.1", () => ok(s));
  });
  base = `http://127.0.0.1:${(site.address() as AddressInfo).port}`;

  // anúncio da Ana com duas fotos, mais um envio que ela nunca usou
  const ana = await conta("conta-ana");
  const pedido = await request(app)
    .post("/api/anuncios/fotos")
    .set(ana)
    .send({ arquivos: [{ tipo: "image/png", tamanhoBytes: PNG.length }, { tipo: "image/jpeg", tamanhoBytes: JPG.length }, { tipo: "image/png", tamanhoBytes: PNG.length }] })
    .expect(201);
  const [f1, f2, f3] = pedido.body.fotos as { chave: string; urlUpload: string }[];
  await request(app).put(f1.urlUpload).set("Content-Type", "image/png").send(PNG).expect(204);
  await request(app).put(f2.urlUpload).set("Content-Type", "image/jpeg").send(JPG).expect(204);
  await request(app).put(f3.urlUpload).set("Content-Type", "image/png").send(PNG).expect(204);
  const anuncio = (
    await request(app)
      .post("/api/anuncios")
      .set(ana)
      .send({ titulo: "Jaqueta jeans", descricao: "Lavagem clara.", categoria: "feminino", tamanho: "M", marca: null, condicao: "otimo_estado", precoCentavos: 12000, fotos: [f1.chave, f2.chave] })
      .expect(201)
  ).body;

  // reserva em vigor (Bia), reserva vencida, peça vendida, pedido esperando o Pix e frete do painel
  const livres = producao.listarPecas().filter((p) => p.status === "disponivel" && p.vendedoraId && p.vendedoraId !== "conta-ana");
  await request(app).post(`/api/pecas/${livres[0].id}/reservar`).set(await conta("conta-bia")).expect(200);
  await producao.alterarEmFila((d) => {
    const vencida = d.pecas.find((p) => p.id === livres[1].id)!;
    Object.assign(vencida, { status: "reservada", reservadaAte: new Date(AGORA - 60_000).toISOString(), reservadaPor: "conta-cris" });
    const vendida = d.pecas.find((p) => p.id === livres[2].id)!;
    vendida.status = "vendida";
    d.pedidos.push({
      id: "pedido-teste-1",
      compradoraId: "conta-bia",
      comprador: { nome: "Bia", email: "bia@example.test" },
      endereco: { cidade: "Brasília" },
      itens: [{ id: livres[0].id, titulo: livres[0].titulo, precoCentavos: livres[0].precoCentavos, vendedoraId: livres[0].vendedoraId }],
      subtotalCentavos: livres[0].precoCentavos,
      freteCentavos: 2490,
      totalCentavos: livres[0].precoCentavos + 2490,
      status: "aguardando_pagamento",
      pixCopiaECola: "pix-ficticio",
      pixExpiraEm: new Date(AGORA + 10 * 60_000).toISOString(),
      criadoEm: new Date(AGORA).toISOString(),
    });
    d.configuracao = { freteCentavos: 2490 };
  });
  cenario = { anuncioId: anuncio.id, fotos: [f1.chave, f2.chave], abandonada: f3.chave, reservadaAtiva: livres[0].id, reservadaVencida: livres[1].id, vendida: livres[2].id, pedidoId: "pedido-teste-1" };

  db = (await conectar(URL_TESTE)).db as BancoCatalogo;
  schema = URL_TESTE ? `teste_migracao_${randomBytes(5).toString("hex")}` : "catalogo";
});

afterEach(async () => {
  await new Promise((ok) => site.close(ok));
  rmSync(pasta, { recursive: true, force: true });
  if (URL_TESTE) await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await db.end();
});

const armazenamento = () => new ArmazenamentoSupabase(new URL(storage.url), CHAVE);
const lerDaPasta = async (chave: string) => {
  try {
    return readFileSync(join(pasta, chave));
  } catch {
    return null;
  }
};
const semente = (): Dados => JSON.parse(readFileSync(SEMENTE, "utf8"));
/** O db.json da produção como ele seria gravado no disco (com o registro dos envios). */
const comoDbJson = (): Dados =>
  structuredClone({
    pecas: producao.listarPecas(),
    pedidos: producao.listarPedidos(),
    fotos: [...cenario.fotos, cenario.abandonada].map((c) => producao.foto(c)!),
    configuracao: producao.configuracao(),
  });

describe("primeiro deploy sem migração", () => {
  it("só a semente entra: anúncios, fotos, reservas, vendas, pedidos e frete ficam de fora", async () => {
    const loja = await abrirLojaBanco(db, SEMENTE, schema);
    expect(loja.peca(cenario.anuncioId)).toBeUndefined();
    expect(loja.foto(cenario.fotos[0])).toBeUndefined();
    expect(loja.peca(cenario.reservadaAtiva)!.status).toBe("disponivel");
    expect(loja.peca(cenario.vendida)!.status).toBe("disponivel");
    expect(loja.listarPedidos()).toHaveLength(0);
    expect(loja.configuracao().freteCentavos).toBeUndefined();

    // o relatório da migração mostra exatamente o que se perderia
    const { relatorio } = planejarMigracao(comoDbJson(), semente(), AGORA);
    expect(relatorio.pecas).toMatchObject({ anuncios: 1, sementeAlteradas: 3 });
    expect(relatorio.reservas.ativas.map((r) => r.pecaId)).toEqual([cenario.reservadaAtiva]);
    expect(relatorio.reservas.vencidas).toBe(1);
    expect(relatorio).toMatchObject({ vendidas: 1, pedidos: { aguardando_pagamento: 1 }, fotos: { vinculadas: 2, reconstruidas: 0, enviosDescartados: 1 }, configuracao: true, problemas: [] });
  });
});

describe("migração: exportar da produção, conferir e aplicar", () => {
  it("leva anúncio, fotos (para o Supabase), vínculos, reservas, vendas, pedidos e frete", async () => {
    const { dados, fotos } = await exportarCatalogo({ base, token: await token("conta-lucy", "ADMIN_MASTER"), apiKey: API_KEY });
    expect([...fotos.keys()].sort()).toEqual([...cenario.fotos].sort());
    const plano = planejarMigracao(dados, semente(), AGORA);
    // a exportação não traz o registro de envios: é reconstruído das fotos do anúncio; o envio solto não vem
    expect(plano.relatorio.fotos).toEqual({ vinculadas: 2, reconstruidas: 2, enviosDescartados: 0 });
    expect(plano.relatorio.problemas).toEqual([]);

    const feito = await aplicarMigracao({ db, schema, semente: SEMENTE, plano, armazenamento: armazenamento(), lerFoto: async (c) => fotos.get(c) ?? null });
    expect(feito).toMatchObject({ fotos: 2, pedidos: 1 });

    // "deploy": a loja nova abre do banco
    const loja = await abrirLojaBanco(db, SEMENTE, schema);
    const anuncio = loja.peca(cenario.anuncioId)!;
    const urlPublica = (c: string) => `${storage.url}/storage/v1/object/public/${BUCKET_FOTOS}/${c}`;
    expect(anuncio.fotos).toEqual(cenario.fotos.map((c) => ({ chave: c, url: urlPublica(c) })));
    expect(anuncio.fotoUrl).toBe(urlPublica(cenario.fotos[0]));
    expect(Buffer.from(await (await fetch(urlPublica(cenario.fotos[0]))).arrayBuffer()).equals(PNG)).toBe(true);
    expect(loja.foto(cenario.fotos[1])).toMatchObject({ usuariaId: "conta-ana", pecaId: cenario.anuncioId, tipo: "image/jpeg" });
    expect(loja.foto(cenario.abandonada)).toBeUndefined();
    expect(loja.peca(cenario.vendida)!.status).toBe("vendida");
    expect(loja.pedido(cenario.pedidoId)!.status).toBe("aguardando_pagamento");
    expect(loja.configuracao().freteCentavos).toBe(2490);

    // a reserva da Bia continua valendo (e no nome dela) e a vencida volta a ficar disponível
    const app = criarAppCatalogo(loja, {
      origens: ["http://localhost:3000"],
      apiKeys: [],
      trustProxy: "loopback",
      reservaMinutos: 15,
      freteCentavos: 1990,
      jwtSegredo: SEGREDO,
      anuncios: { armazenamento: armazenamento(), perfis: { buscar: async (id) => ({ nomePublico: id, cidade: null }) }, fotoMaxBytes: 5 * 1024 * 1024 },
    });
    await request(app).post(`/pecas/${cenario.reservadaAtiva}/reservar`).set(await conta("conta-cris")).expect(409);
    await request(app).post(`/pecas/${cenario.reservadaAtiva}/liberar`).set(await conta("conta-cris")).expect(403);
    await request(app).post(`/pecas/${cenario.reservadaVencida}/reservar`).set(await conta("conta-cris")).expect(200);
    // e a vendedora continua dona do anúncio e das fotos
    const meus = (await request(app).get("/anuncios/meus").set(await conta("conta-ana")).expect(200)).body.anuncios;
    expect(meus.map((a: { id: string }) => a.id)).toEqual([cenario.anuncioId]);
  });

  it("migra direto de um db.json com o registro de fotos (o envio solto fica de fora)", async () => {
    const plano = planejarMigracao(comoDbJson(), semente(), AGORA);
    expect(plano.relatorio.fotos).toEqual({ vinculadas: 2, reconstruidas: 0, enviosDescartados: 1 });
    await aplicarMigracao({ db, schema, semente: SEMENTE, plano, armazenamento: armazenamento(), lerFoto: lerDaPasta });
    const loja = await abrirLojaBanco(db, SEMENTE, schema);
    expect(loja.foto(cenario.fotos[0])?.pecaId).toBe(cenario.anuncioId);
    expect(loja.foto(cenario.abandonada)).toBeUndefined();
  });

  it("não roda de novo nem por cima de dados novos (nada é alterado)", async () => {
    const plano = planejarMigracao({ pecas: producao.listarPecas(), pedidos: producao.listarPedidos(), configuracao: producao.configuracao() }, semente(), AGORA);
    // catálogo já em uso depois do deploy: uma peça vendida
    const loja = await abrirLojaBanco(db, SEMENTE, schema);
    await loja.alterarEmFila((d) => {
      d.pecas[0].status = "vendida";
    });
    await expect(aplicarMigracao({ db, schema, semente: SEMENTE, plano, armazenamento: armazenamento(), lerFoto: lerDaPasta })).rejects.toThrow(/já tem dados além da semente/);
    expect(storage.objetos.size).toBe(0);
    expect((await abrirLojaBanco(db, SEMENTE, schema)).peca(cenario.anuncioId)).toBeUndefined();
  });

  it("aceita rodar depois do primeiro deploy se ninguém mexeu na semente; e só uma vez", async () => {
    await abrirLojaBanco(db, SEMENTE, schema);
    const plano = planejarMigracao({ pecas: producao.listarPecas(), pedidos: producao.listarPedidos(), configuracao: producao.configuracao() }, semente(), AGORA);
    await aplicarMigracao({ db, schema, semente: SEMENTE, plano, armazenamento: armazenamento(), lerFoto: lerDaPasta });
    await expect(aplicarMigracao({ db, schema, semente: SEMENTE, plano, armazenamento: armazenamento(), lerFoto: lerDaPasta })).rejects.toThrow(/já tem dados/);
  });

  it("semente com as chaves em outra ordem (como o JSONB do Postgres devolve) conta como intocada", async () => {
    await abrirLojaBanco(db, SEMENTE, schema);
    // reescreve cada peça com as chaves invertidas, como um Postgres real pode devolver
    const linhas = await db.query<{ id: string; dados: Record<string, unknown> }>(`SELECT id, dados FROM ${schema}.pecas`);
    for (const { id, dados } of linhas.rows) {
      const invertido = Object.fromEntries(Object.entries(dados).reverse());
      expect(JSON.stringify(invertido)).not.toBe(JSON.stringify(dados));
      await db.query(`UPDATE ${schema}.pecas SET dados = $1::jsonb WHERE id = $2`, [JSON.stringify(invertido), id]);
    }
    const plano = planejarMigracao(comoDbJson(), semente(), AGORA);
    await expect(aplicarMigracao({ db, schema, semente: SEMENTE, plano, armazenamento: armazenamento(), lerFoto: lerDaPasta })).resolves.toMatchObject({ fotos: 2 });
  });

  it.each([
    ["um campo a mais numa peça da semente", async () => {
      const [{ id, dados }] = (await db.query<{ id: string; dados: Record<string, unknown> }>(`SELECT id, dados FROM ${schema}.pecas ORDER BY ordem LIMIT 1`)).rows;
      await db.query(`UPDATE ${schema}.pecas SET dados = $1::jsonb WHERE id = $2`, [JSON.stringify({ ...dados, pausada: true }), id]);
    }],
    ["frete alterado no painel", async () => {
      await db.query(`UPDATE ${schema}.configuracao SET dados = $1::jsonb WHERE id = 1`, [JSON.stringify({ freteCentavos: 2490 })]);
    }],
  ])("continua bloqueando catálogo com dados extras: %s", async (_caso, mexer) => {
    await abrirLojaBanco(db, SEMENTE, schema);
    await mexer();
    const plano = planejarMigracao(comoDbJson(), semente(), AGORA);
    await expect(aplicarMigracao({ db, schema, semente: SEMENTE, plano, armazenamento: armazenamento(), lerFoto: lerDaPasta })).rejects.toThrow(/já tem dados além da semente/);
    expect(storage.objetos.size).toBe(0);
  });

  it("jsonCanonico ignora a ordem das chaves, mas não a dos itens", () => {
    expect(jsonCanonico({ b: 1, a: { d: [2, 1], c: null } })).toBe(jsonCanonico({ a: { c: null, d: [2, 1] }, b: 1 }));
    expect(jsonCanonico([{ a: 1 }, { b: 2 }])).not.toBe(jsonCanonico([{ b: 2 }, { a: 1 }]));
  });

  it("foto faltando ou falsa: para antes de gravar qualquer coisa", async () => {
    const plano = planejarMigracao({ pecas: producao.listarPecas(), pedidos: producao.listarPedidos() }, semente(), AGORA);
    rmSync(join(pasta, cenario.fotos[1]));
    await expect(aplicarMigracao({ db, schema, semente: SEMENTE, plano, armazenamento: armazenamento(), lerFoto: lerDaPasta })).rejects.toThrow(/não foi encontrada/);
    await expect(
      aplicarMigracao({ db, schema, semente: SEMENTE, plano, armazenamento: armazenamento(), lerFoto: async () => Buffer.from("não sou imagem") }),
    ).rejects.toThrow(/não é uma imagem/);
    expect(storage.objetos.size).toBe(0);
    expect((await abrirLojaBanco(db, SEMENTE, schema)).peca(cenario.anuncioId)).toBeUndefined();
  });

  it("aponta inconsistências do db.json (foto de outra conta) e não aplica", async () => {
    const fotos = [...cenario.fotos].map((c) => ({ ...producao.foto(c)! }));
    fotos[0].usuariaId = "conta-bia";
    const plano = planejarMigracao({ pecas: producao.listarPecas(), pedidos: [], fotos }, semente(), AGORA);
    expect(plano.relatorio.problemas.join()).toMatch(/envio é de outra conta/);
    await expect(aplicarMigracao({ db, schema, semente: SEMENTE, plano, armazenamento: armazenamento(), lerFoto: lerDaPasta })).rejects.toThrow(/problemas/);
  });
});
