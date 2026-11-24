import { validarPreco } from "@desapego/core/pricing";
import express, { type Response } from "express";
import { z } from "zod";
import { exigirChavePix, exigirLogin, type Autenticada } from "../../comum/autenticacao.js";
import { categoriaPermitida, CONDICOES } from "../../comum/categorias.js";
import {
  ArmazenamentoLocal,
  CHAVE_FOTO,
  conteudoEhDoTipo,
  FOTOS_MAX,
  FOTOS_MIN,
  FotoInvalida,
  novaChaveFoto,
  TIPOS_FOTO,
  tipoAceito,
  type ArmazenamentoFotos,
} from "./fotos.js";
import type { Dados, Loja, Peca } from "./loja.js";
import { Recusa, statusAtual } from "./regras.js";

/** Perfil público da vendedora (nome na vitrine e cidade), do serviço de contas. */
export interface PerfisVendedoras {
  buscar(vendedoraId: string): Promise<{ nomePublico: string; cidade: string | null } | null>;
}

/** Lê o perfil público em GET {contas}/auth/vendedoras/:id (Req. 002). */
export function perfisPorHttp(opcoes: { baseUrl: string; timeoutMs?: number; fetch?: typeof fetch }): PerfisVendedoras {
  const buscar = opcoes.fetch ?? fetch;
  const base = opcoes.baseUrl.replace(/\/+$/, "");
  return {
    async buscar(vendedoraId) {
      let resposta: globalThis.Response;
      try {
        resposta = await buscar(`${base}/auth/vendedoras/${encodeURIComponent(vendedoraId)}`, {
          signal: AbortSignal.timeout(opcoes.timeoutMs ?? 5000),
        });
      } catch {
        throw new Recusa(503, "o serviço de contas não respondeu. tente de novo em instantes.");
      }
      if (resposta.status === 404) return null;
      if (!resposta.ok) throw new Recusa(503, "o serviço de contas não respondeu. tente de novo em instantes.");
      const { vendedora } = (await resposta.json()) as { vendedora: { nomePublico: string; cidade: string | null } };
      return { nomePublico: vendedora.nomePublico, cidade: vendedora.cidade };
    },
  };
}

export interface ConfigAnuncios {
  armazenamento: ArmazenamentoFotos;
  perfis: PerfisVendedoras;
  /** Limite de cada foto, em bytes. */
  fotoMaxBytes: number;
}

const texto = (rotulo: string, max: number) =>
  z
    .string({ error: `informe ${rotulo}.` })
    .trim()
    .min(1, `informe ${rotulo}.`)
    .max(max, `${rotulo} pode ter no máximo ${max} caracteres.`);

/** Campos do anúncio (Req. 004). O formulário valida antes, mas a barreira é aqui. */
const esquemaAnuncio = z.object({
  titulo: texto("o título", 100),
  descricao: texto("a descrição", 2000),
  categoria: z
    .string({ error: "escolha uma categoria." })
    .refine(categoriaPermitida, "categoria não permitida: o desaPego aceita só roupas, calçados, bolsas e acessórios."),
  tamanho: texto("o tamanho", 20),
  marca: z
    .string()
    .trim()
    .max(60, "a marca pode ter no máximo 60 caracteres.")
    .nullish()
    .transform((v) => v || null),
  condicao: z.enum(CONDICOES, { error: "escolha a condição da peça." }),
  precoCentavos: z.unknown().superRefine((v, ctx) => {
    const erro = validarPreco(v);
    if (erro) ctx.addIssue({ code: "custom", message: erro });
  }) as z.ZodType<number>,
  fotos: z
    .array(z.string().regex(CHAVE_FOTO, "foto inválida."), { error: `envie de ${FOTOS_MIN} a ${FOTOS_MAX} fotos.` })
    .min(FOTOS_MIN, `envie pelo menos ${FOTOS_MIN} foto.`)
    .max(FOTOS_MAX, `envie no máximo ${FOTOS_MAX} fotos.`)
    .refine((f) => new Set(f).size === f.length, "a mesma foto foi enviada duas vezes."),
});

const idAnuncio = z.string().trim().min(1).max(80).regex(/^[\w-]+$/, "id inválido.");

const quem = (res: Response) => res.locals.usuaria as Autenticada;

/**
 * Anúncios (Módulo 02, Req. 004), montados em /anuncios. O anúncio publicado é uma peça do catálogo
 * com `vendedoraId`: aparece na vitrine e segue o caminho normal da sacola, do checkout e da carteira.
 * Publicar e enviar fotos exigem chave Pix (Req. 002). Cada vendedora só mexe nos próprios anúncios,
 * e peça reservada, vendida ou num pedido esperando o Pix não é editada, pausada nem excluída.
 */
export function rotasAnuncios(
  loja: Loja,
  config: ConfigAnuncios & { jwtSegredo: Uint8Array },
  regras: { agora: () => number; emPedidoAberto: (pecaId: string) => boolean; escrita: express.RequestHandler },
) {
  const { armazenamento, perfis } = config;
  const rotas = express.Router();
  rotas.use(exigirLogin(config.jwtSegredo));

  /** Anúncio da usuária logada: 404 se não existe, 403 se é de outra pessoa. */
  function meuAnuncio(pecaId: string, usuaria: Autenticada): Peca {
    const peca = loja.peca(pecaId);
    if (!peca) throw new Recusa(404, "anúncio não encontrado.");
    if (peca.vendedoraId !== usuaria.id) throw new Recusa(403, "esse anúncio é de outra pessoa.");
    return peca;
  }

  /** Reservada, vendida ou num pedido aberto: está num pedido e não pode mudar. */
  function exigirAlteravel(peca: Peca) {
    const status = statusAtual(peca, regras.agora());
    if (status !== "disponivel" || regras.emPedidoAberto(peca.id)) {
      throw new Recusa(409, "peça reservada ou vendida está num pedido e não pode ser alterada.");
    }
  }

  /** O anúncio como a própria vendedora vê (inclui pausa e ocultação pela administração). */
  const paraVendedora = (p: Peca) => ({
    id: p.id,
    titulo: p.titulo,
    descricao: p.descricao,
    categoria: p.categoria,
    tamanho: p.tamanho,
    marca: p.marca ?? null,
    condicao: p.condicao,
    precoCentavos: p.precoCentavos,
    fotos: p.fotos ?? [],
    status: statusAtual(p, regras.agora()),
    pausada: !!p.pausada,
    oculta: !!p.oculta,
    motivoOculta: p.oculta ? (p.motivoOculta ?? null) : null,
    emPedido: regras.emPedidoAberto(p.id),
    criadoEm: p.criadoEm,
    atualizadoEm: p.atualizadoEm ?? p.criadoEm,
  });

  /** A foto precisa ter sido pedida por quem anuncia (envio autorizado) e não pode estar em outro anúncio. */
  function conferirDona(chaves: string[], usuariaId: string, pecaId: string | null) {
    for (const chave of chaves) {
      const foto = loja.foto(chave);
      if (!foto || foto.usuariaId !== usuariaId) throw new Recusa(400, "uma das fotos não foi encontrada. envie de novo.");
      if (foto.pecaId && foto.pecaId !== pecaId) throw new Recusa(400, "uma das fotos já está em outro anúncio.");
    }
  }

  /**
   * Antes de vincular: confere a dona e, no armazenamento, o tamanho e os primeiros bytes das fotos
   * ainda não confirmadas. Só depois disso a foto pode entrar no anúncio. Devolve as que foram
   * confirmadas agora (para marcar dentro da fila).
   */
  async function confirmarFotos(chaves: string[], usuariaId: string, pecaId: string | null) {
    conferirDona(chaves, usuariaId, pecaId);
    const confirmadas: string[] = [];
    for (const chave of chaves) {
      const foto = loja.foto(chave)!;
      if (foto.enviadaEm) continue;
      if (!tipoAceito(foto.tipo)) throw new Recusa(400, "uma das fotos não foi encontrada. envie de novo.");
      try {
        await armazenamento.confirmarEnvio(chave, foto.tipo, config.fotoMaxBytes);
      } catch (erro) {
        if (erro instanceof FotoInvalida) {
          const mb = Math.round(config.fotoMaxBytes / 1024 / 1024);
          throw new Recusa(400, `uma das fotos ainda não terminou de subir ou não é uma imagem JPG, PNG ou WebP de até ${mb} MB. envie de novo.`);
        }
        throw erro;
      }
      confirmadas.push(chave);
    }
    return confirmadas;
  }

  /** Dentro da fila: confere de novo (outra requisição pode ter usado a foto) e vincula ao anúncio. */
  function vincularFotos(d: Dados, chaves: string[], confirmadas: string[], usuariaId: string, pecaId: string) {
    conferirDona(chaves, usuariaId, pecaId);
    const agora = new Date(regras.agora()).toISOString();
    for (const f of d.fotos ?? []) {
      if (!chaves.includes(f.chave)) continue;
      if (confirmadas.includes(f.chave)) f.enviadaEm ??= agora;
      if (!f.enviadaEm) throw new Recusa(400, "uma das fotos ainda não terminou de subir.");
      f.pecaId = pecaId;
    }
  }

  /** Apaga do armazenamento depois que o anúncio já foi salvo; uma falha aqui não desfaz a alteração. */
  async function apagarDepois(chaves: string[]) {
    for (const chave of chaves) {
      await armazenamento.remover(chave).catch((erro) => console.error(`[catalogo] não apagou a foto ${chave}:`, erro));
    }
  }

  /** Depois de salvo, a cópia do envio das fotos publicadas agora não serve mais. */
  async function descartarEnviosDepois(chaves: string[]) {
    await Promise.all(
      chaves.map((chave) => armazenamento.descartarEnvio(chave).catch((erro) => console.error(`[catalogo] não descartou o envio ${chave}:`, erro))),
    );
  }

  async function vitrineDaVendedora(usuaria: Autenticada) {
    const perfil = await perfis.buscar(usuaria.id);
    if (!perfil) throw new Recusa(403, "complete seu perfil de vendedora (nome na vitrine e cidade) antes de anunciar.");
    return { nomePublico: perfil.nomePublico, cidade: perfil.cidade ?? "" };
  }

  // URLs pré-assinadas para o navegador subir as fotos direto no armazenamento
  rotas.post("/fotos", regras.escrita, exigirChavePix, async (req, res) => {
    const mb = Math.round(config.fotoMaxBytes / 1024 / 1024);
    const { arquivos } = z
      .object({
        arquivos: z
          .array(
            z.object({
              tipo: z.enum(TIPOS_FOTO, { error: "envie só imagens JPG, PNG ou WebP." }),
              tamanhoBytes: z.number().int().positive("arquivo vazio.").max(config.fotoMaxBytes, `cada foto pode ter no máximo ${mb} MB.`),
            }),
          )
          .min(FOTOS_MIN, `envie pelo menos ${FOTOS_MIN} foto.`)
          .max(FOTOS_MAX, `envie no máximo ${FOTOS_MAX} fotos.`),
      })
      .parse(req.body);
    const usuaria = quem(res);
    // assina antes (fora da fila) e só registra o envio autorizado depois
    const preparadas = await Promise.all(
      arquivos.map(async ({ tipo }) => {
        const chave = novaChaveFoto(tipo);
        return { tipo, chave, envio: await armazenamento.gerarUrlUpload(chave, tipo, config.fotoMaxBytes) };
      }),
    );
    await loja.alterarEmFila((d) => {
      d.fotos ??= [];
      const criadaEm = new Date(regras.agora()).toISOString();
      for (const { chave, tipo } of preparadas) d.fotos.push({ chave, usuariaId: usuaria.id, tipo, criadaEm, enviadaEm: null, pecaId: null });
    });
    res.status(201).json({ fotos: preparadas.map(({ chave, envio }) => ({ chave, ...envio, url: armazenamento.urlPublica(chave) })) });
  });

  // CREATE: publicar
  rotas.post("/", regras.escrita, exigirChavePix, async (req, res) => {
    const dados = esquemaAnuncio.parse(req.body);
    const usuaria = quem(res);
    const vendedor = await vitrineDaVendedora(usuaria);
    const confirmadas = await confirmarFotos(dados.fotos, usuaria.id, null);
    const peca = await loja.alterarEmFila((d) => {
      const pecaId = loja.novoId();
      vincularFotos(d, dados.fotos, confirmadas, usuaria.id, pecaId);
      const agora = new Date(regras.agora()).toISOString();
      const { fotos: chaves, ...campos } = dados;
      const fotos = chaves.map((chave) => ({ chave, url: armazenamento.urlPublica(chave) }));
      const nova: Peca = {
        id: pecaId,
        ...campos,
        fotos,
        fotoUrl: fotos[0].url,
        fotoAlt: `foto de ${campos.titulo}`,
        vendedor,
        vendedoraId: usuaria.id,
        status: "disponivel",
        reservadaAte: null,
        criadoEm: agora,
        atualizadoEm: agora,
      };
      d.pecas.push(nova);
      return nova;
    });
    await descartarEnviosDepois(confirmadas);
    res.status(201).json(paraVendedora(peca));
  });

  // READ: os meus anúncios (mais recentes primeiro) e um anúncio
  rotas.get("/meus", (_req, res) => {
    const usuaria = quem(res);
    const meus = loja
      .listarPecas()
      .filter((p) => p.vendedoraId === usuaria.id)
      .toSorted((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
    res.json({ anuncios: meus.map(paraVendedora) });
  });

  rotas.get("/:id", (req, res) => {
    res.json(paraVendedora(meuAnuncio(idAnuncio.parse(req.params.id), quem(res))));
  });

  // UPDATE: editar (os mesmos campos da publicação)
  rotas.put("/:id", regras.escrita, exigirChavePix, async (req, res) => {
    const pecaId = idAnuncio.parse(req.params.id);
    const usuaria = quem(res);
    meuAnuncio(pecaId, usuaria);
    const dados = esquemaAnuncio.parse(req.body);
    const vendedor = await vitrineDaVendedora(usuaria);
    exigirAlteravel(meuAnuncio(pecaId, usuaria));
    // as fotos novas são conferidas antes; as antigas só saem depois que o anúncio for salvo
    const confirmadas = await confirmarFotos(dados.fotos, usuaria.id, pecaId);
    const { peca, removidas } = await loja.alterarEmFila((d) => {
      const p = meuAnuncio(pecaId, usuaria);
      exigirAlteravel(p);
      vincularFotos(d, dados.fotos, confirmadas, usuaria.id, p.id);
      const { fotos: chaves, ...campos } = dados;
      const antes = (p.fotos ?? []).flatMap((f) => (f.chave ? [f.chave] : []));
      const fotos = chaves.map((chave) => ({ chave, url: armazenamento.urlPublica(chave) }));
      Object.assign(p, campos, { fotos, fotoUrl: fotos[0].url, fotoAlt: `foto de ${campos.titulo}`, vendedor, atualizadoEm: new Date(regras.agora()).toISOString() });
      // fotos que saíram do anúncio deixam de existir
      const removidas = antes.filter((c) => !chaves.includes(c));
      d.fotos = (d.fotos ?? []).filter((f) => !removidas.includes(f.chave));
      return { peca: p, removidas };
    });
    await apagarDepois(removidas);
    await descartarEnviosDepois(confirmadas);
    res.json(paraVendedora(peca));
  });

  // UPDATE: pausar e reativar (some da vitrine e volta; a administração continua podendo ocultar)
  for (const [acao, pausada] of [
    ["pausar", true],
    ["reativar", false],
  ] as const) {
    rotas.post(`/:id/${acao}`, regras.escrita, async (req, res) => {
      const pecaId = idAnuncio.parse(req.params.id);
      const usuaria = quem(res);
      const peca = await loja.alterarEmFila(() => {
        const p = meuAnuncio(pecaId, usuaria);
        exigirAlteravel(p);
        if (!!p.pausada === pausada) throw new Recusa(409, pausada ? "esse anúncio já está pausado." : "esse anúncio não está pausado.");
        p.pausada = pausada;
        p.atualizadoEm = new Date(regras.agora()).toISOString();
        return p;
      });
      res.json(paraVendedora(peca));
    });
  }

  // DELETE: excluir (e apagar as fotos)
  rotas.delete("/:id", regras.escrita, async (req, res) => {
    const pecaId = idAnuncio.parse(req.params.id);
    const usuaria = quem(res);
    const chaves = await loja.alterarEmFila((d) => {
      const p = meuAnuncio(pecaId, usuaria);
      exigirAlteravel(p);
      d.pecas = d.pecas.filter((x) => x.id !== p.id);
      const fotos = (p.fotos ?? []).flatMap((f) => (f.chave ? [f.chave] : []));
      d.fotos = (d.fotos ?? []).filter((f) => !fotos.includes(f.chave));
      return fotos;
    });
    await apagarDepois(chaves);
    res.status(204).end();
  });

  return rotas;
}

/** Envios de foto que não entraram em nenhum anúncio somem depois deste prazo. */
export const PRAZO_ENVIO_ABANDONADO_MS = 24 * 60 * 60_000;

/**
 * Apaga os envios abandonados (pedidos há mais de 24 horas e que não entraram em anúncio): o
 * registro e o arquivo. Roda de tempos em tempos (servidor.ts). Devolve quantos apagou.
 */
export async function limparEnviosAbandonados(loja: Loja, armazenamento: ArmazenamentoFotos, agora: () => number) {
  const limite = agora() - PRAZO_ENVIO_ABANDONADO_MS;
  const chaves = await loja.alterarEmFila((d) => {
    const velhos = (d.fotos ?? []).filter((f) => !f.pecaId && Date.parse(f.criadaEm) < limite).map((f) => f.chave);
    if (velhos.length) d.fotos = (d.fotos ?? []).filter((f) => !velhos.includes(f.chave));
    return velhos;
  });
  for (const chave of chaves) {
    // pode ter sido publicado no armazenamento e o anúncio não ter sido salvo: apaga os dois
    await Promise.allSettled([armazenamento.descartarEnvio(chave), armazenamento.remover(chave)]).then((r) =>
      r.forEach((x) => x.status === "rejected" && console.error(`[catalogo] não apagou o envio abandonado ${chave}:`, x.reason)),
    );
  }
  return chaves.length;
}

/**
 * /fotos, só no armazenamento local: recebe a foto pela URL pré-assinada (PUT) e serve as fotos já
 * enviadas (GET). No Supabase Storage o navegador envia direto ao bucket e a foto é servida por ele.
 * Aceita só JPG, PNG e WebP de verdade (confere os primeiros bytes) e respeita o limite de tamanho.
 */
export function rotasFotos(loja: Loja, armazenamento: ArmazenamentoLocal, maxBytes: number, agora: () => number) {
  const rotas = express.Router();

  rotas.put("/:chave", express.raw({ type: () => true, limit: maxBytes }), async (req, res) => {
    const chave = String(req.params.chave);
    const foto = CHAVE_FOTO.test(chave) ? loja.foto(chave) : undefined;
    if (!foto) throw new Recusa(404, "envio não encontrado.");
    const assinado = armazenamento.validarEnvio(chave, req.query);
    if (!assinado || assinado.tipo !== foto.tipo) throw new Recusa(403, "link de envio inválido ou vencido.");
    if (foto.enviadaEm) throw new Recusa(409, "essa foto já foi enviada.");

    const dados = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (req.get("content-type") !== assinado.tipo) throw new Recusa(415, "o tipo do arquivo não confere.");
    if (dados.length === 0) throw new Recusa(400, "arquivo vazio.");
    if (dados.length > assinado.max) throw new Recusa(413, "a foto passou do tamanho máximo.");
    if (!conteudoEhDoTipo(dados, assinado.tipo)) throw new Recusa(415, "o arquivo não é uma imagem JPG, PNG ou WebP.");

    armazenamento.gravar(chave, dados);
    await loja.alterarEmFila(() => {
      foto.enviadaEm = new Date(agora()).toISOString();
    });
    res.status(204).end();
  });

  rotas.get("/:chave", (req, res) => {
    const chave = String(req.params.chave);
    const foto = CHAVE_FOTO.test(chave) ? loja.foto(chave) : undefined;
    if (!foto?.enviadaEm || !armazenamento.existe(chave)) throw new Recusa(404, "foto não encontrada.");
    res.type(foto.tipo).set("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(armazenamento.caminho(chave));
  });

  return rotas;
}
