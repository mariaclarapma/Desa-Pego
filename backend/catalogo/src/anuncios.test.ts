import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ERRO_SEM_CHAVE_PIX } from "../../comum/autenticacao.js";
import { limparEnviosAbandonados, type PerfisVendedoras } from "./anuncios.js";
import { criarAppCatalogo } from "./app.js";
import { ArmazenamentoLocal, conteudoEhDoTipo, FotoInvalida, type ArmazenamentoFotos, type EnvioFoto, type TipoFoto } from "./fotos.js";
import { abrirLoja } from "./loja.js";

/* Testes do Req. 006 (anúncios) e da integração do Módulo 02 com o catálogo. */

const SEMENTE = fileURLToPath(new URL("../../db.seed.json", import.meta.url));
const SEGREDO = new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres");
const ORIGEM = "http://localhost:3000";
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a1e5a0a10000000049454e44ae426082", "hex");
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

const loja = abrirLoja(null, SEMENTE);
let pasta: string;
let app: ReturnType<typeof criarAppCatalogo>;
let perfis: Map<string, { nomePublico: string; cidade: string | null }>;

beforeEach(() => {
  loja.restaurar();
  pasta = mkdtempSync(join(tmpdir(), "desapego-fotos-"));
  perfis = new Map([
    ["conta-ana", { nomePublico: "Ana", cidade: "Brasília/DF" }],
    ["conta-bia", { nomePublico: "Bia", cidade: "Recife/PE" }],
  ]);
  const perfisFalsos: PerfisVendedoras = { buscar: async (id) => perfis.get(id) ?? null };
  app = criarAppCatalogo(loja, {
    origens: [ORIGEM],
    apiKeys: [],
    trustProxy: "loopback",
    reservaMinutos: 15,
    freteCentavos: 1990,
    jwtSegredo: SEGREDO,
    anuncios: { armazenamento: new ArmazenamentoLocal(pasta, "/fotos", SEGREDO), perfis: perfisFalsos, fotoMaxBytes: 1024 },
  });
});

afterEach(() => rmSync(pasta, { recursive: true, force: true }));

/** Token como o serviço de contas emite (com ou sem chave Pix cadastrada). */
const conta = async (sub: string, temChavePix = true) => ({
  Authorization: `Bearer ${await new SignJWT({ nome: sub, perfil: "USUARIO", temChavePix }).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setExpirationTime("15m").sign(SEGREDO)}`,
});

/** Pede URLs pré-assinadas e sobe cada arquivo, como o navegador faz. */
async function subirFotos(cabecalho: Record<string, string>, arquivos: { tipo: string; dados: Buffer }[]) {
  const pedido = await request(app)
    .post("/anuncios/fotos")
    .set(cabecalho)
    .send({ arquivos: arquivos.map((a) => ({ tipo: a.tipo, tamanhoBytes: a.dados.length })) })
    .expect(201);
  for (const [i, foto] of pedido.body.fotos.entries()) {
    await request(app).put(foto.urlUpload).set("Content-Type", arquivos[i].tipo).send(arquivos[i].dados).expect(204);
  }
  return pedido.body.fotos.map((f: { chave: string }) => f.chave) as string[];
}

const anuncioValido = (fotos: string[]) => ({
  titulo: "Bolsa de palha com alça",
  descricao: "Palha trançada à mão, alça de couro.",
  categoria: "bolsas",
  tamanho: "único",
  marca: "feito à mão",
  condicao: "otimo_estado",
  precoCentavos: 8990,
  fotos,
});

async function publicar(cabecalho: Record<string, string>, extra: Record<string, unknown> = {}) {
  const fotos = await subirFotos(cabecalho, [{ tipo: "image/png", dados: PNG }]);
  return (await request(app).post("/anuncios").set(cabecalho).send({ ...anuncioValido(fotos), ...extra }).expect(201)).body;
}

describe("publicar anúncio (Req. 004)", () => {
  it("anúncio válido vira peça do catálogo, da vendedora, e aparece na vitrine", async () => {
    const ana = await conta("conta-ana");
    const anuncio = await publicar(ana);

    expect(anuncio).toMatchObject({ titulo: "Bolsa de palha com alça", precoCentavos: 8990, condicao: "otimo_estado", status: "disponivel", pausada: false });
    const peca = loja.peca(anuncio.id)!;
    expect(peca).toMatchObject({ vendedoraId: "conta-ana", vendedor: { nomePublico: "Ana", cidade: "Brasília/DF" } });
    expect(peca.fotoUrl).toBe(anuncio.fotos[0].url);

    const vitrine = await request(app).get("/pecas?busca=palha com alça").expect(200);
    expect(vitrine.body.itens.map((p: { id: string }) => p.id)).toContain(anuncio.id);
    const foto = await request(app).get(anuncio.fotos[0].url).expect(200);
    expect(foto.headers["content-type"]).toBe("image/png");
  });

  it("aceita de 1 a 5 fotos JPG e PNG, na ordem enviada (a primeira é a capa)", async () => {
    const ana = await conta("conta-ana");
    const fotos = await subirFotos(ana, Array.from({ length: 5 }, (_, i) => (i % 2 ? { tipo: "image/jpeg", dados: JPG } : { tipo: "image/png", dados: PNG })));
    const res = await request(app).post("/anuncios").set(ana).send(anuncioValido(fotos)).expect(201);
    expect(res.body.fotos.map((f: { chave: string }) => f.chave)).toEqual(fotos);
  });

  it("recusa campos obrigatórios ausentes, avisando cada um", async () => {
    const res = await request(app).post("/anuncios").set(await conta("conta-ana")).send({ marca: "x" }).expect(400);
    expect(Object.keys(res.body.campos).sort()).toEqual(["categoria", "condicao", "descricao", "fotos", "precoCentavos", "tamanho", "titulo"]);
  });

  it("recusa 0 fotos e 6 fotos", async () => {
    const ana = await conta("conta-ana");
    const zero = await request(app).post("/anuncios").set(ana).send(anuncioValido([])).expect(400);
    expect(zero.body.campos.fotos).toBe("envie pelo menos 1 foto.");

    const seisUrls = await request(app)
      .post("/anuncios/fotos")
      .set(ana)
      .send({ arquivos: Array.from({ length: 6 }, () => ({ tipo: "image/png", tamanhoBytes: 100 })) })
      .expect(400);
    expect(seisUrls.body.campos.arquivos).toBe("envie no máximo 5 fotos.");

    const seis = [...(await subirFotos(ana, Array.from({ length: 5 }, () => ({ tipo: "image/png", dados: PNG })))), ...(await subirFotos(ana, [{ tipo: "image/png", dados: PNG }]))];
    const res = await request(app).post("/anuncios").set(ana).send(anuncioValido(seis)).expect(400);
    expect(res.body.campos.fotos).toBe("envie no máximo 5 fotos.");
  });

  it("recusa arquivo que não é imagem: tipo errado no pedido e conteúdo falso no envio", async () => {
    const ana = await conta("conta-ana");
    const pdf = await request(app).post("/anuncios/fotos").set(ana).send({ arquivos: [{ tipo: "application/pdf", tamanhoBytes: 100 }] }).expect(400);
    expect(pdf.body.campos["arquivos.0.tipo"]).toBe("envie só imagens JPG, PNG ou WebP.");

    // pede URL como PNG, mas manda um texto: o servidor confere os primeiros bytes
    const pedido = await request(app).post("/anuncios/fotos").set(ana).send({ arquivos: [{ tipo: "image/png", tamanhoBytes: 20 }] }).expect(201);
    const falso = await request(app).put(pedido.body.fotos[0].urlUpload).set("Content-Type", "image/png").send(Buffer.from("isto não é imagem")).expect(415);
    expect(falso.body.erro).toMatch(/não é uma imagem/);

    // a foto que não subiu não entra no anúncio
    const res = await request(app).post("/anuncios").set(ana).send(anuncioValido([pedido.body.fotos[0].chave])).expect(400);
    expect(res.body.erro).toMatch(/não terminou de subir/);
  });

  it("respeita o limite de tamanho e a assinatura da URL de envio", async () => {
    const ana = await conta("conta-ana");
    await request(app).post("/anuncios/fotos").set(ana).send({ arquivos: [{ tipo: "image/png", tamanhoBytes: 5000 }] }).expect(400);
    const pedido = await request(app).post("/anuncios/fotos").set(ana).send({ arquivos: [{ tipo: "image/png", tamanhoBytes: 10 }] }).expect(201);
    await request(app).put(pedido.body.fotos[0].urlUpload).set("Content-Type", "image/png").send(Buffer.concat([PNG, Buffer.alloc(2000)])).expect(413);
    const adulterada = pedido.body.fotos[0].urlUpload.replace(/sig=[^&]+/, "sig=assinatura-falsa");
    await request(app).put(adulterada).set("Content-Type", "image/png").send(PNG).expect(403);
  });

  it("preço em centavos inteiros e maior que zero (recusa zero, negativo e quebrado)", async () => {
    const ana = await conta("conta-ana");
    const fotos = await subirFotos(ana, [{ tipo: "image/png", dados: PNG }]);
    for (const [preco, msg] of [
      [0, "maior que zero"],
      [-500, "maior que zero"],
      [89.9, "centavos inteiros"],
      ["8990", "centavos inteiros"],
    ] as const) {
      const res = await request(app).post("/anuncios").set(ana).send({ ...anuncioValido(fotos), precoCentavos: preco }).expect(400);
      expect(res.body.campos.precoCentavos).toMatch(msg);
    }
  });

  it("aceita só os selos de condição e as categorias de moda", async () => {
    const ana = await conta("conta-ana");
    const fotos = await subirFotos(ana, [{ tipo: "image/png", dados: PNG }]);
    const condicao = await request(app).post("/anuncios").set(ana).send({ ...anuncioValido(fotos), condicao: "seminova" }).expect(400);
    expect(condicao.body.campos.condicao).toBe("escolha a condição da peça.");
    const categoria = await request(app).post("/anuncios").set(ana).send({ ...anuncioValido(fotos), categoria: "eletronicos" }).expect(400);
    expect(categoria.body.campos.categoria).toMatch(/categoria não permitida/);
  });

  it("exige login, chave Pix (Req. 002) e perfil de vendedora", async () => {
    await request(app).post("/anuncios").send({}).expect(401);
    const semPix = await conta("conta-ana", false);
    expect((await request(app).post("/anuncios").set(semPix).send({}).expect(403)).body.erro).toBe(ERRO_SEM_CHAVE_PIX);
    await request(app).post("/anuncios/fotos").set(semPix).send({ arquivos: [{ tipo: "image/png", tamanhoBytes: 10 }] }).expect(403);

    const ana = await conta("conta-ana");
    const fotos = await subirFotos(ana, [{ tipo: "image/png", dados: PNG }]);
    perfis.delete("conta-ana");
    const semPerfil = await request(app).post("/anuncios").set(ana).send(anuncioValido(fotos)).expect(403);
    expect(semPerfil.body.erro).toMatch(/perfil de vendedora/);
  });

  it("não deixa usar foto enviada por outra pessoa", async () => {
    const fotosDaAna = await subirFotos(await conta("conta-ana"), [{ tipo: "image/png", dados: PNG }]);
    await request(app).post("/anuncios").set(await conta("conta-bia")).send(anuncioValido(fotosDaAna)).expect(400);
  });
});

describe("gerenciar anúncio (Req. 004)", () => {
  it("a vendedora lista, edita, pausa, reativa e exclui os próprios anúncios", async () => {
    const ana = await conta("conta-ana");
    const anuncio = await publicar(ana);

    const meus = await request(app).get("/anuncios/meus").set(ana).expect(200);
    expect(meus.body.anuncios.map((a: { id: string }) => a.id)).toEqual([anuncio.id]);

    const novas = await subirFotos(ana, [{ tipo: "image/jpeg", dados: JPG }]);
    const editado = await request(app).put(`/anuncios/${anuncio.id}`).set(ana).send({ ...anuncioValido(novas), titulo: "Bolsa de palha", precoCentavos: 7990 }).expect(200);
    expect(editado.body).toMatchObject({ titulo: "Bolsa de palha", precoCentavos: 7990 });
    await request(app).get(anuncio.fotos[0].url).expect(404); // a foto que saiu foi apagada

    // pausada: some da vitrine e da página pública
    expect((await request(app).post(`/anuncios/${anuncio.id}/pausar`).set(ana).expect(200)).body.pausada).toBe(true);
    expect((await request(app).get("/pecas?porPagina=48").expect(200)).body.itens.map((p: { id: string }) => p.id)).not.toContain(anuncio.id);
    await request(app).get(`/pecas/${anuncio.id}`).expect(404);
    await request(app).post(`/anuncios/${anuncio.id}/pausar`).set(ana).expect(409);

    expect((await request(app).post(`/anuncios/${anuncio.id}/reativar`).set(ana).expect(200)).body.pausada).toBe(false);
    await request(app).get(`/pecas/${anuncio.id}`).expect(200);

    await request(app).delete(`/anuncios/${anuncio.id}`).set(ana).expect(204);
    expect(loja.peca(anuncio.id)).toBeUndefined();
    await request(app).get(editado.body.fotos[0].url).expect(404);
  });

  it("bloqueia ver, editar, pausar e excluir anúncio de outra vendedora", async () => {
    const anuncio = await publicar(await conta("conta-ana"));
    const bia = await conta("conta-bia");
    const fotos = await subirFotos(bia, [{ tipo: "image/png", dados: PNG }]);

    const edicao = await request(app).put(`/anuncios/${anuncio.id}`).set(bia).send(anuncioValido(fotos)).expect(403);
    expect(edicao.body.erro).toBe("esse anúncio é de outra pessoa.");
    await request(app).get(`/anuncios/${anuncio.id}`).set(bia).expect(403);
    await request(app).post(`/anuncios/${anuncio.id}/pausar`).set(bia).expect(403);
    await request(app).delete(`/anuncios/${anuncio.id}`).set(bia).expect(403);
    expect(loja.peca(anuncio.id)).toMatchObject({ titulo: "Bolsa de palha com alça" });
    expect(loja.peca(anuncio.id)!.pausada).toBeFalsy();
  });

  it("bloqueia excluir, editar e pausar peça vendida ou reservada", async () => {
    const ana = await conta("conta-ana");
    const bia = await conta("conta-bia");

    // reservada de verdade, pela sacola de outra conta
    const reservada = await publicar(ana);
    await request(app).post(`/pecas/${reservada.id}/reservar`).set(bia).expect(200);
    // vendida (quem marca é o webhook do Pix, no Módulo 04)
    const vendida = await publicar(ana);
    await loja.alterarEmFila(() => {
      loja.peca(vendida.id)!.status = "vendida";
    });

    for (const anuncio of [reservada, vendida]) {
      const exclusao = await request(app).delete(`/anuncios/${anuncio.id}`).set(ana).expect(409);
      expect(exclusao.body.erro).toMatch(/reservada ou vendida/);
      await request(app).put(`/anuncios/${anuncio.id}`).set(ana).send(anuncioValido(anuncio.fotos.map((f: { chave: string }) => f.chave))).expect(409);
      await request(app).post(`/anuncios/${anuncio.id}/pausar`).set(ana).expect(409);
      expect(loja.peca(anuncio.id)).toBeDefined();
    }
  });

  it("a vendedora não reserva a própria peça (regra do catálogo vale para anúncios)", async () => {
    const ana = await conta("conta-ana");
    const anuncio = await publicar(ana);
    await request(app).post(`/pecas/${anuncio.id}/reservar`).set(ana).expect(403);
  });
});

/**
 * Bucket simulado com o mesmo contrato do ArmazenamentoSupabase: o navegador envia para o bucket
 * de envios (aqui, `enviar`) e a API só publica depois de conferir tamanho e primeiros bytes.
 */
class BucketFalso implements ArmazenamentoFotos {
  temporarias = new Map<string, Buffer>();
  publicadas = new Set<string>();
  conferidas: string[] = [];
  removidas: string[] = [];
  aoRemover: (chave: string) => void = () => {};

  async gerarUrlUpload(chave: string, tipo: TipoFoto): Promise<EnvioFoto> {
    return { urlUpload: `https://bucket-falso.example.test/envios/${chave}`, metodo: "PUT", campos: {}, expiraEm: new Date(0).toISOString() };
  }
  /** O que o bucket faz ao receber o envio do navegador (o bucket já barra tipo e tamanho). */
  enviar(chave: string, dados: Buffer) {
    this.temporarias.set(chave, dados);
  }
  async confirmarEnvio(chave: string, tipo: TipoFoto, maxBytes: number) {
    this.conferidas.push(chave);
    const dados = this.temporarias.get(chave);
    if (!dados || dados.length > maxBytes || !conteudoEhDoTipo(dados, tipo)) throw new FotoInvalida();
    this.publicadas.add(chave);
  }
  urlPublica(chave: string) {
    return `https://fotos.example.test/anuncios/${chave}`;
  }
  async remover(chave: string) {
    this.aoRemover(chave);
    this.removidas.push(chave);
    this.publicadas.delete(chave);
  }
  async descartarEnvio(chave: string) {
    this.temporarias.delete(chave);
  }
}

describe("fotos num armazenamento externo (bucket simulado)", () => {
  let bucket: BucketFalso;
  let appExterno: ReturnType<typeof criarAppCatalogo>;

  beforeEach(() => {
    bucket = new BucketFalso();
    const perfisFalsos: PerfisVendedoras = { buscar: async (id) => perfis.get(id) ?? null };
    appExterno = criarAppCatalogo(loja, {
      origens: [ORIGEM],
      apiKeys: [],
      trustProxy: "loopback",
      reservaMinutos: 15,
      freteCentavos: 1990,
      jwtSegredo: SEGREDO,
      anuncios: { armazenamento: bucket, perfis: perfisFalsos, fotoMaxBytes: 1024 },
    });
  });

  /** Pede o envio autorizado e "sobe" no bucket, como o navegador faz com a URL assinada. */
  async function enviarAoBucket(cabecalho: Record<string, string>, arquivos: { tipo: string; dados: Buffer }[]) {
    const pedido = await request(appExterno)
      .post("/anuncios/fotos")
      .set(cabecalho)
      .send({ arquivos: arquivos.map((a) => ({ tipo: a.tipo, tamanhoBytes: a.dados.length })) })
      .expect(201);
    return pedido.body.fotos.map((f: { chave: string; metodo: string; campos: Record<string, string>; urlUpload: string }, i: number) => {
      expect(f).toMatchObject({ metodo: "PUT", urlUpload: `https://bucket-falso.example.test/envios/${f.chave}`, campos: {} });
      bucket.enviar(f.chave, arquivos[i].dados);
      return f.chave;
    }) as string[];
  }

  it("confere tamanho e primeiros bytes antes de vincular: arquivo falso não entra no anúncio", async () => {
    const ana = await conta("conta-ana");
    const [falsa] = await enviarAoBucket(ana, [{ tipo: "image/png", dados: Buffer.from("isto não é imagem") }]);
    const recusa = await request(appExterno).post("/anuncios").set(ana).send(anuncioValido([falsa])).expect(400);
    expect(recusa.body.erro).toMatch(/não é uma imagem JPG, PNG ou WebP de até/);
    expect(bucket.publicadas.size).toBe(0);
    expect(loja.foto(falsa)).toMatchObject({ enviadaEm: null, pecaId: null });

    const [boa] = await enviarAoBucket(ana, [{ tipo: "image/png", dados: PNG }]);
    const anuncio = (await request(appExterno).post("/anuncios").set(ana).send(anuncioValido([boa])).expect(201)).body;
    expect(anuncio.fotos).toEqual([{ chave: boa, url: `https://fotos.example.test/anuncios/${boa}` }]);
    expect(loja.foto(boa)).toMatchObject({ pecaId: anuncio.id });
    expect(loja.foto(boa)!.enviadaEm).not.toBeNull();
    // a vitrine mostra a URL do bucket (ou da CDN)
    expect((await request(appExterno).get(`/pecas/${anuncio.id}`).expect(200)).body.fotoUrl).toBe(`https://fotos.example.test/anuncios/${boa}`);
  });

  it("foto que não chegou ao bucket é recusada", async () => {
    const ana = await conta("conta-ana");
    const pedido = await request(appExterno).post("/anuncios/fotos").set(ana).send({ arquivos: [{ tipo: "image/png", tamanhoBytes: 100 }] }).expect(201);
    const res = await request(appExterno).post("/anuncios").set(ana).send(anuncioValido([pedido.body.fotos[0].chave])).expect(400);
    expect(res.body.erro).toMatch(/não terminou de subir/);
  });

  it("só consulta o bucket depois de conferir que o envio é da vendedora", async () => {
    const [daAna] = await enviarAoBucket(await conta("conta-ana"), [{ tipo: "image/png", dados: PNG }]);
    await request(appExterno).post("/anuncios").set(await conta("conta-bia")).send(anuncioValido([daAna])).expect(400);
    await request(appExterno).post("/anuncios").set(await conta("conta-bia")).send(anuncioValido(["1b40590a-d80d-4b07-8d1a-25bbfa043023.png"])).expect(400);
    expect(bucket.conferidas).toEqual([]);
  });

  it("na troca, a foto antiga só sai depois que a nova é conferida e o anúncio é salvo", async () => {
    const ana = await conta("conta-ana");
    const [antiga] = await enviarAoBucket(ana, [{ tipo: "image/png", dados: PNG }]);
    const anuncio = (await request(appExterno).post("/anuncios").set(ana).send(anuncioValido([antiga])).expect(201)).body;

    // a nova é inválida: nada muda e a antiga continua
    const [invalida] = await enviarAoBucket(ana, [{ tipo: "image/jpeg", dados: PNG }]);
    await request(appExterno).put(`/anuncios/${anuncio.id}`).set(ana).send(anuncioValido([invalida])).expect(400);
    expect(bucket.removidas).toEqual([]);
    expect(loja.peca(anuncio.id)!.fotos).toEqual([{ chave: antiga, url: bucket.urlPublica(antiga) }]);

    // a nova é válida: quando a antiga é apagada, o anúncio já aponta para a nova
    const [nova] = await enviarAoBucket(ana, [{ tipo: "image/jpeg", dados: JPG }]);
    const naHoraDeApagar: string[][] = [];
    bucket.aoRemover = () => naHoraDeApagar.push((loja.peca(anuncio.id)!.fotos ?? []).map((f) => f.chave ?? ""));
    await request(appExterno).put(`/anuncios/${anuncio.id}`).set(ana).send(anuncioValido([nova])).expect(200);
    expect(bucket.removidas).toEqual([antiga]);
    expect(naHoraDeApagar).toEqual([[nova]]);
    expect(loja.foto(antiga)).toBeUndefined();
  });

  it("se apagar no bucket falhar, a edição continua salva", async () => {
    const ana = await conta("conta-ana");
    const anuncio = (await request(appExterno).post("/anuncios").set(ana).send(anuncioValido(await enviarAoBucket(ana, [{ tipo: "image/png", dados: PNG }]))).expect(201)).body;
    const [nova] = await enviarAoBucket(ana, [{ tipo: "image/png", dados: PNG }]);
    bucket.aoRemover = () => {
      throw new Error("armazenamento fora do ar");
    };
    const erroNoLog = vi.spyOn(console, "error").mockImplementation(() => {});
    await request(appExterno).put(`/anuncios/${anuncio.id}`).set(ana).send(anuncioValido([nova])).expect(200);
    expect(loja.peca(anuncio.id)!.fotos!.map((f) => f.chave)).toEqual([nova]);
    expect(erroNoLog).toHaveBeenCalled();
    erroNoLog.mockRestore();
  });

  it("excluir o anúncio apaga as fotos do bucket; e /fotos não existe com armazenamento externo", async () => {
    const ana = await conta("conta-ana");
    const fotos = await enviarAoBucket(ana, [
      { tipo: "image/png", dados: PNG },
      { tipo: "image/jpeg", dados: JPG },
    ]);
    const anuncio = (await request(appExterno).post("/anuncios").set(ana).send(anuncioValido(fotos)).expect(201)).body;
    await request(appExterno).delete(`/anuncios/${anuncio.id}`).set(ana).expect(204);
    expect(bucket.removidas.sort()).toEqual([...fotos].sort());
    await request(appExterno).put(`/fotos/${fotos[0]}`).set("Content-Type", "image/png").send(PNG).expect(404);
  });

  it("depois de publicar, descarta a cópia do envio (fica só a foto publicada)", async () => {
    const ana = await conta("conta-ana");
    const [chave] = await enviarAoBucket(ana, [{ tipo: "image/png", dados: PNG }]);
    await request(appExterno).post("/anuncios").set(ana).send(anuncioValido([chave])).expect(201);
    expect(bucket.temporarias.has(chave)).toBe(false);
    expect(bucket.publicadas.has(chave)).toBe(true);
  });

  it("apaga, depois de 24 horas, os envios que não entraram em anúncio (e só eles)", async () => {
    const ana = await conta("conta-ana");
    const [usada, abandonada] = await enviarAoBucket(ana, [
      { tipo: "image/png", dados: PNG },
      { tipo: "image/png", dados: PNG },
    ]);
    await request(appExterno).post("/anuncios").set(ana).send(anuncioValido([usada])).expect(201);

    expect(await limparEnviosAbandonados(loja, bucket, Date.now)).toBe(0);
    expect(await limparEnviosAbandonados(loja, bucket, () => Date.now() + 25 * 60 * 60_000)).toBe(1);
    expect(loja.foto(abandonada)).toBeUndefined();
    expect(bucket.temporarias.has(abandonada)).toBe(false);
    expect(loja.foto(usada)?.pecaId).toBeTruthy();
    expect(bucket.publicadas.has(usada)).toBe(true);
  });
});
