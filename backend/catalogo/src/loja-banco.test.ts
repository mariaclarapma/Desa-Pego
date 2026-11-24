import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { conectar } from "../../comum/postgres.js";
import type { PerfisVendedoras } from "./anuncios.js";
import { criarAppCatalogo } from "./app.js";
import { ArmazenamentoSupabase, BUCKET_ENVIOS, BUCKET_FOTOS } from "./fotos-supabase.js";
import { abrirLojaBanco, type BancoCatalogo, type Loja } from "./loja.js";
import { StorageSimulado } from "./storage-simulado.js";

/*
 * Etapa 2 (catálogo no PostgreSQL). Por padrão roda no pg-mem; com TEST_DATABASE_URL (a CI), num
 * Postgres de verdade, num schema próprio apagado no fim. "Reiniciar o serviço" = abrir a loja de
 * novo no mesmo banco, como acontece num deploy ou reinício no Render.
 */

const SEMENTE = fileURLToPath(new URL("../../db.seed.json", import.meta.url));
const SEGREDO = new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres");
const CHAVE = "sb_secret_ficticia_so_para_teste";
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a1e5a0a10000000049454e44ae426082", "hex");
const URL_TESTE = process.env.TEST_DATABASE_URL || undefined;

let db: BancoCatalogo;
let schema: string;
const storage = new StorageSimulado(CHAVE, {
  [BUCKET_ENVIOS]: { publico: false, tiposAceitos: ["image/jpeg", "image/png", "image/webp"], limiteBytes: 5 * 1024 * 1024 },
  [BUCKET_FOTOS]: { publico: true },
});

beforeAll(async () => {
  await storage.iniciar();
});
afterAll(async () => {
  await storage.parar();
});

// cada teste começa com um banco novo (pg-mem) ou um schema novo (Postgres real)
beforeEach(async () => {
  if (db) {
    if (URL_TESTE) await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await db.end();
  }
  db = (await conectar(URL_TESTE)).db as BancoCatalogo;
  schema = URL_TESTE ? `teste_catalogo_${randomBytes(5).toString("hex")}` : "catalogo";
  storage.objetos.clear();
});
afterAll(async () => {
  if (URL_TESTE) await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await db.end();
});

function criarApp(loja: Loja, agora: () => number = Date.now) {
  const perfis: PerfisVendedoras = { buscar: async (id) => ({ nomePublico: id, cidade: "Brasília/DF" }) };
  return criarAppCatalogo(
    loja,
    {
      origens: ["http://localhost:3000"],
      apiKeys: [],
      trustProxy: "loopback",
      reservaMinutos: 15,
      freteCentavos: 1990,
      jwtSegredo: SEGREDO,
      anuncios: { armazenamento: new ArmazenamentoSupabase(new URL(storage.url), CHAVE), perfis, fotoMaxBytes: 5 * 1024 * 1024 },
    },
    agora,
  );
}

const conta = async (sub: string) => ({
  Authorization: `Bearer ${await new SignJWT({ nome: sub, perfil: "USUARIO", temChavePix: true }).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setExpirationTime("15m").sign(SEGREDO)}`,
});

async function publicar(app: ReturnType<typeof criarApp>, cabecalho: Record<string, string>) {
  const pedido = await request(app).post("/anuncios/fotos").set(cabecalho).send({ arquivos: [{ tipo: "image/png", tamanhoBytes: PNG.length }] }).expect(201);
  const { urlUpload, chave } = pedido.body.fotos[0];
  expect((await fetch(urlUpload, { method: "PUT", headers: { "Content-Type": "image/png" }, body: new Uint8Array(PNG) })).status).toBe(200);
  const criado = await request(app)
    .post("/anuncios")
    .set(cabecalho)
    .send({ titulo: "Jaqueta jeans", descricao: "Lavagem clara.", categoria: "feminino", tamanho: "M", marca: null, condicao: "otimo_estado", precoCentavos: 12000, fotos: [chave] })
    .expect(201);
  return { anuncio: criado.body, chave };
}

describe("catálogo no PostgreSQL", () => {
  it("na primeira vez copia a semente; depois, não copia de novo", async () => {
    const loja = await abrirLojaBanco(db, SEMENTE, schema);
    const semente = loja.listarPecas().length;
    expect(semente).toBeGreaterThan(0);
    const primeira = loja.listarPecas()[0].id;
    await loja.alterarEmFila((d) => {
      d.pecas = d.pecas.filter((p) => p.id !== primeira);
    });

    const reaberta = await abrirLojaBanco(db, SEMENTE, schema);
    expect(reaberta.listarPecas()).toHaveLength(semente - 1);
    expect(reaberta.peca(primeira)).toBeUndefined();
  });

  it("anúncio, fotos e o vínculo com a peça sobrevivem à reinicialização do serviço", async () => {
    const ana = await conta("conta-ana");
    const { anuncio, chave } = await publicar(criarApp(await abrirLojaBanco(db, SEMENTE, schema)), ana);

    // "reinício": loja nova lida do banco
    const loja = await abrirLojaBanco(db, SEMENTE, schema);
    const app = criarApp(loja);
    const meus = (await request(app).get("/anuncios/meus").set(ana).expect(200)).body.anuncios;
    expect(meus.map((a: { id: string }) => a.id)).toEqual([anuncio.id]);
    expect(meus[0].fotos).toEqual(anuncio.fotos);
    expect(loja.foto(chave)).toMatchObject({ usuariaId: "conta-ana", pecaId: anuncio.id, tipo: "image/png" });
    expect(loja.foto(chave)?.enviadaEm).toBeTruthy();
    const rows = (await db.query<{ peca_id: string }>(`SELECT peca_id FROM ${schema}.fotos WHERE chave = $1`, [chave])).rows;
    expect(rows).toEqual([{ peca_id: anuncio.id }]);
    // a foto continua no bucket público e a vitrine mostra a peça
    expect((await fetch(anuncio.fotos[0].url)).status).toBe(200);
    expect((await request(app).get(`/pecas/${anuncio.id}`).expect(200)).body.fotoUrl).toBe(anuncio.fotos[0].url);

    // e o vínculo continua valendo: outra vendedora não usa a foto
    await request(app)
      .post("/anuncios")
      .set(await conta("conta-bia"))
      .send({ titulo: "x", descricao: "x", categoria: "feminino", tamanho: "M", marca: null, condicao: "otimo_estado", precoCentavos: 5000, fotos: [chave] })
      .expect(400);

    // excluir depois do reinício tira peça e foto do banco
    await request(app).delete(`/anuncios/${anuncio.id}`).set(ana).expect(204);
    const depois = await abrirLojaBanco(db, SEMENTE, schema);
    expect(depois.peca(anuncio.id)).toBeUndefined();
    expect(depois.foto(chave)).toBeUndefined();
  });

  it("reserva: continua no nome de quem reservou depois do reinício e vence em 15 minutos", async () => {
    let agora = Date.parse("2026-11-23T12:00:00Z");
    const relogio = () => agora;
    const peca = (await abrirLojaBanco(db, SEMENTE, schema)).listarPecas().find((p) => p.status === "disponivel" && p.vendedoraId)!;
    const app1 = criarApp(await abrirLojaBanco(db, SEMENTE, schema), relogio);
    await request(app1).post(`/pecas/${peca.id}/reservar`).set(await conta("conta-bia")).expect(200);

    const app2 = criarApp(await abrirLojaBanco(db, SEMENTE, schema), relogio);
    expect((await request(app2).get(`/pecas/${peca.id}`).expect(200)).body.status).toBe("reservada");
    await request(app2).post(`/pecas/${peca.id}/reservar`).set(await conta("conta-cris")).expect(409);
    await request(app2).post(`/pecas/${peca.id}/liberar`).set(await conta("conta-cris")).expect(403);

    agora += 15 * 60_000 + 1;
    const app3 = criarApp(await abrirLojaBanco(db, SEMENTE, schema), relogio);
    expect((await request(app3).get(`/pecas/${peca.id}`).expect(200)).body.status).toBe("disponivel");
    await request(app3).post(`/pecas/${peca.id}/reservar`).set(await conta("conta-cris")).expect(200);
  });

  it("duas pessoas reservando ao mesmo tempo: só uma consegue", async () => {
    const loja = await abrirLojaBanco(db, SEMENTE, schema);
    const app = criarApp(loja);
    const peca = loja.listarPecas().find((p) => p.status === "disponivel" && p.vendedoraId)!;
    const [a, b] = await Promise.all([
      request(app).post(`/pecas/${peca.id}/reservar`).set(await conta("conta-bia")),
      request(app).post(`/pecas/${peca.id}/reservar`).set(await conta("conta-cris")),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const gravada = (await db.query<{ status: string }>(`SELECT status FROM ${schema}.pecas WHERE id = $1`, [peca.id])).rows[0];
    expect(gravada.status).toBe("reservada");
  });

  it("um catálogo esvaziado não volta à semente no reinício", async () => {
    const loja = await abrirLojaBanco(db, SEMENTE, schema);
    await loja.alterarEmFila((d) => {
      d.pecas = [];
    });
    expect((await abrirLojaBanco(db, SEMENTE, schema)).listarPecas()).toHaveLength(0);
  });

  it("alteração recusada no meio não deixa nada pela metade (nem para a próxima gravação)", async () => {
    const loja = await abrirLojaBanco(db, SEMENTE, schema);
    const [a, b] = loja.listarPecas();
    await expect(
      loja.alterarEmFila(() => {
        loja.peca(a.id)!.status = "vendida";
        throw new Error("recusada");
      }),
    ).rejects.toThrow("recusada");
    expect(loja.peca(a.id)!.status).toBe("disponivel");
    await loja.alterarEmFila(() => {
      loja.peca(b.id)!.titulo = "outro título";
    });
    const reaberta = await abrirLojaBanco(db, SEMENTE, schema);
    expect(reaberta.peca(a.id)!.status).toBe("disponivel");
    expect(reaberta.peca(b.id)!.titulo).toBe("outro título");
  });

  it("se o banco falhar ao gravar, a alteração não vale (nem em memória)", async () => {
    const loja = await abrirLojaBanco(db, SEMENTE, schema);
    const peca = loja.listarPecas().find((p) => p.status === "disponivel")!;
    const original = db.connect.bind(db);
    // um cliente que falha em todo INSERT (sem mexer no cliente de verdade, que volta ao pool)
    db.connect = (async () => {
      const cliente = await original();
      return {
        query: (sql: string, valores?: unknown[]) => (sql.startsWith("INSERT") ? Promise.reject(new Error("banco fora do ar")) : cliente.query(sql, valores)),
        release: () => cliente.release(),
      };
    }) as unknown as typeof db.connect;
    try {
      await expect(
        loja.alterarEmFila(() => {
          loja.peca(peca.id)!.status = "reservada";
        }),
      ).rejects.toThrow("banco fora do ar");
    } finally {
      db.connect = original;
    }
    expect(loja.peca(peca.id)!.status).toBe("disponivel");
    // a próxima alteração funciona normalmente
    await loja.alterarEmFila(() => {
      loja.peca(peca.id)!.status = "vendida";
    });
    expect((await abrirLojaBanco(db, SEMENTE, schema)).peca(peca.id)!.status).toBe("vendida");
  });
});
