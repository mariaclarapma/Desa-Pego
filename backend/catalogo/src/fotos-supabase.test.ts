import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PerfisVendedoras } from "./anuncios.js";
import { criarAppCatalogo } from "./app.js";
import { FotoInvalida } from "./fotos.js";
import { armazenamentoSupabaseDoAmbiente, ArmazenamentoSupabase, BUCKET_ENVIOS, BUCKET_FOTOS } from "./fotos-supabase.js";
import { abrirLoja } from "./loja.js";
import { StorageSimulado } from "./storage-simulado.js";

/*
 * Etapa 1 (fotos no Supabase Storage), testada contra um Storage simulado com as regras dos
 * buckets: o navegador envia com a URL assinada, a API confere e publica, a vitrine lê do bucket
 * público, e troca e exclusão apagam os arquivos certos. A vendedora só usa as próprias fotos.
 */

const SEMENTE = fileURLToPath(new URL("../../db.seed.json", import.meta.url));
const SEGREDO = new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres");
const CHAVE_SECRETA = "sb_secret_ficticia_so_para_teste";
const LIMITE = 5 * 1024 * 1024;
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a1e5a0a10000000049454e44ae426082", "hex");
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

const storage = new StorageSimulado(CHAVE_SECRETA, {
  [BUCKET_ENVIOS]: { publico: false, tiposAceitos: ["image/jpeg", "image/png", "image/webp"], limiteBytes: LIMITE },
  [BUCKET_FOTOS]: { publico: true },
});
const loja = abrirLoja(null, SEMENTE);
let app: ReturnType<typeof criarAppCatalogo>;

beforeAll(() => storage.iniciar());
afterAll(() => storage.parar());

beforeEach(() => {
  loja.restaurar();
  storage.objetos.clear();
  const perfis: PerfisVendedoras = { buscar: async (id) => ({ nomePublico: id, cidade: "Brasília/DF" }) };
  app = criarAppCatalogo(loja, {
    origens: ["http://localhost:3000"],
    apiKeys: [],
    trustProxy: "loopback",
    reservaMinutos: 15,
    freteCentavos: 1990,
    jwtSegredo: SEGREDO,
    anuncios: { armazenamento: new ArmazenamentoSupabase(new URL(storage.url), CHAVE_SECRETA), perfis, fotoMaxBytes: LIMITE },
  });
});

const conta = async (sub: string) => ({
  Authorization: `Bearer ${await new SignJWT({ nome: sub, perfil: "USUARIO", temChavePix: true }).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setExpirationTime("15m").sign(SEGREDO)}`,
});

const anuncio = (fotos: string[]) => ({
  titulo: "Bolsa de palha com alça",
  descricao: "Palha trançada à mão, alça de couro.",
  categoria: "bolsas",
  tamanho: "único",
  marca: null,
  condicao: "otimo_estado",
  precoCentavos: 8990,
  fotos,
});

/** Pede o envio à API e sobe no Storage como o navegador (PUT na URL assinada, sem token de login). */
async function enviar(cabecalho: Record<string, string>, arquivos: { tipo: string; dados: Buffer }[], status = 200) {
  const pedido = await request(app)
    .post("/anuncios/fotos")
    .set(cabecalho)
    .send({ arquivos: arquivos.map((a) => ({ tipo: a.tipo, tamanhoBytes: Math.min(a.dados.length, LIMITE) })) })
    .expect(201);
  for (const [i, f] of pedido.body.fotos.entries()) {
    expect(f.metodo).toBe("PUT");
    expect(f.urlUpload).toMatch(new RegExp(`^${storage.url}/storage/v1/object/upload/sign/${BUCKET_ENVIOS}/${f.chave}\\?token=`));
    const resposta = await fetch(f.urlUpload, { method: "PUT", headers: { "Content-Type": arquivos[i].tipo }, body: new Uint8Array(arquivos[i].dados) });
    expect(resposta.status).toBe(status);
  }
  return pedido.body.fotos.map((f: { chave: string }) => f.chave) as string[];
}

describe("fotos no Supabase Storage (simulado)", () => {
  it("envio, conferência, publicação e exibição pelo bucket público", async () => {
    const ana = await conta("conta-ana");
    const [png, jpg] = await enviar(ana, [
      { tipo: "image/png", dados: PNG },
      { tipo: "image/jpeg", dados: JPG },
    ]);
    // antes de publicar, a foto não aparece no bucket público
    expect((await fetch(`${storage.url}/storage/v1/object/public/${BUCKET_ENVIOS}/${png}`)).status).toBe(400);

    const criado = (await request(app).post("/anuncios").set(ana).send(anuncio([png, jpg])).expect(201)).body;
    const urlCapa = `${storage.url}/storage/v1/object/public/${BUCKET_FOTOS}/${png}`;
    expect(criado.fotos.map((f: { url: string }) => f.url)).toEqual([urlCapa, `${storage.url}/storage/v1/object/public/${BUCKET_FOTOS}/${jpg}`]);
    expect((await request(app).get(`/pecas/${criado.id}`).expect(200)).body.fotoUrl).toBe(urlCapa);

    const capa = await fetch(urlCapa);
    expect(capa.status).toBe(200);
    expect(Buffer.from(await capa.arrayBuffer()).equals(PNG)).toBe(true);
    // a cópia do envio sai depois de publicada
    expect(storage.objetos.has(`${BUCKET_ENVIOS}/${png}`)).toBe(false);
  });

  it("o próprio bucket recusa arquivo de outro tipo e acima de 5 MB, e a API não publica", async () => {
    const ana = await conta("conta-ana");
    const pedido = await request(app).post("/anuncios/fotos").set(ana).send({ arquivos: [{ tipo: "image/png", tamanhoBytes: 100 }] }).expect(201);
    const { urlUpload, chave } = pedido.body.fotos[0];
    expect((await fetch(urlUpload, { method: "PUT", headers: { "Content-Type": "text/html" }, body: "<script>" })).status).toBe(415);
    expect((await fetch(urlUpload, { method: "PUT", headers: { "Content-Type": "image/png" }, body: new Uint8Array(LIMITE + 1) })).status).toBe(413);
    await request(app).post("/anuncios").set(ana).send(anuncio([chave])).expect(400);
  });

  it("um texto com tipo de imagem chega ao bucket mas não entra no anúncio", async () => {
    const ana = await conta("conta-ana");
    const [falsa] = await enviar(ana, [{ tipo: "image/png", dados: Buffer.from("não sou uma imagem") }]);
    const res = await request(app).post("/anuncios").set(ana).send(anuncio([falsa])).expect(400);
    expect(res.body.erro).toMatch(/JPG, PNG ou WebP/);
    expect(storage.objetos.has(`${BUCKET_FOTOS}/${falsa}`)).toBe(false);
  });

  it("a URL assinada não sobrescreve um envio já feito", async () => {
    const ana = await conta("conta-ana");
    const pedido = await request(app).post("/anuncios/fotos").set(ana).send({ arquivos: [{ tipo: "image/png", tamanhoBytes: PNG.length }] }).expect(201);
    const { urlUpload } = pedido.body.fotos[0];
    expect((await fetch(urlUpload, { method: "PUT", headers: { "Content-Type": "image/png" }, body: new Uint8Array(PNG) })).status).toBe(200);
    expect((await fetch(urlUpload, { method: "PUT", headers: { "Content-Type": "image/png" }, body: new Uint8Array(JPG) })).status).toBe(409);
  });

  it("outra vendedora não usa, troca nem apaga as fotos da Ana", async () => {
    const ana = await conta("conta-ana");
    const bia = await conta("conta-bia");
    const [daAna] = await enviar(ana, [{ tipo: "image/png", dados: PNG }]);
    const chamadasAntes = storage.chamadas.length;
    await request(app).post("/anuncios").set(bia).send(anuncio([daAna])).expect(400);
    // recusado antes de qualquer acesso ao Storage
    expect(storage.chamadas.length).toBe(chamadasAntes);

    const criado = (await request(app).post("/anuncios").set(ana).send(anuncio([daAna])).expect(201)).body;
    const [daBia] = await enviar(bia, [{ tipo: "image/png", dados: PNG }]);
    await request(app).put(`/anuncios/${criado.id}`).set(bia).send(anuncio([daBia])).expect(403);
    await request(app).delete(`/anuncios/${criado.id}`).set(bia).expect(403);
    expect(storage.objetos.has(`${BUCKET_FOTOS}/${daAna}`)).toBe(true);
  });

  it("troca: a nova é publicada e a antiga só sai do bucket depois de salvo; exclusão apaga as fotos", async () => {
    const ana = await conta("conta-ana");
    const [antiga] = await enviar(ana, [{ tipo: "image/png", dados: PNG }]);
    const criado = (await request(app).post("/anuncios").set(ana).send(anuncio([antiga])).expect(201)).body;

    // troca por uma foto inválida: recusada, a antiga continua
    const [invalida] = await enviar(ana, [{ tipo: "image/jpeg", dados: PNG }]);
    await request(app).put(`/anuncios/${criado.id}`).set(ana).send(anuncio([invalida])).expect(400);
    expect(storage.objetos.has(`${BUCKET_FOTOS}/${antiga}`)).toBe(true);
    expect((await request(app).get(`/anuncios/${criado.id}`).set(ana).expect(200)).body.fotos[0].chave).toBe(antiga);

    const [nova] = await enviar(ana, [{ tipo: "image/jpeg", dados: JPG }]);
    const editado = (await request(app).put(`/anuncios/${criado.id}`).set(ana).send(anuncio([nova])).expect(200)).body;
    expect(editado.fotos.map((f: { chave: string }) => f.chave)).toEqual([nova]);
    expect(storage.objetos.has(`${BUCKET_FOTOS}/${antiga}`)).toBe(false);
    expect(storage.objetos.has(`${BUCKET_FOTOS}/${nova}`)).toBe(true);

    await request(app).delete(`/anuncios/${criado.id}`).set(ana).expect(204);
    expect(storage.objetos.has(`${BUCKET_FOTOS}/${nova}`)).toBe(false);
    expect((await fetch(`${storage.url}/storage/v1/object/public/${BUCKET_FOTOS}/${nova}`)).status).toBe(400);
  });
});

describe("ArmazenamentoSupabase", () => {
  it("recusa chave fora do padrão sem chamar o Storage", async () => {
    const armazenamento = new ArmazenamentoSupabase(new URL(storage.url), CHAVE_SECRETA);
    const antes = storage.chamadas.length;
    await expect(armazenamento.gerarUrlUpload("../anuncios-fotos/x.png", "image/png")).rejects.toBeInstanceOf(FotoInvalida);
    await expect(armazenamento.remover("../../x")).rejects.toBeInstanceOf(FotoInvalida);
    expect(storage.chamadas.length).toBe(antes);
  });

  it("chave secreta errada vira erro do servidor (não foto inválida)", async () => {
    const errada = new ArmazenamentoSupabase(new URL(storage.url), "outra-chave");
    await expect(errada.gerarUrlUpload("1b40590a-d80d-4b07-8d1a-25bbfa043023.png", "image/png")).rejects.toThrow(/403/);
  });

  it("configuração pelo ambiente: nada = local; as duas juntas; só HTTPS fora do localhost", () => {
    expect(armazenamentoSupabaseDoAmbiente({})).toBeNull();
    expect(() => armazenamentoSupabaseDoAmbiente({ SUPABASE_URL: "https://abc.supabase.co" })).toThrow(/juntos/);
    expect(() => armazenamentoSupabaseDoAmbiente({ SUPABASE_URL: "http://abc.supabase.co", SUPABASE_SECRET_KEY: "x" })).toThrow(/HTTPS/);
    expect(armazenamentoSupabaseDoAmbiente({ SUPABASE_URL: "https://abc.supabase.co", SUPABASE_SECRET_KEY: "x" })!.urlPublica("1b40590a-d80d-4b07-8d1a-25bbfa043023.png")).toBe(
      `https://abc.supabase.co/storage/v1/object/public/${BUCKET_FOTOS}/1b40590a-d80d-4b07-8d1a-25bbfa043023.png`,
    );
  });
});
