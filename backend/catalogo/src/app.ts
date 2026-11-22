import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { z } from "zod";
import { exigirAdminMaster, exigirLogin, type Autenticada } from "../../comum/autenticacao.js";
import { categoriaPermitida, CONDICOES } from "../../comum/categorias.js";
import { cors, exigirApiKey, limiteRequisicoes } from "../../comum/seguranca.js";
import { CompraFacade } from "./compra-facade.js";
import type { GestaoPedidos } from "./gestao.js";
import type { Loja, Peca } from "./loja.js";
import { Recusa, statusAtual } from "./regras.js";

export { statusAtual } from "./regras.js";

export interface ConfigCatalogo {
  origens: string[];
  apiKeys: string[];
  trustProxy: string | number;
  reservaMinutos: number;
  freteCentavos: number;
  /** Segredo do JWT do serviço de contas: o painel do admin (ocultar anúncios) exige login. */
  jwtSegredo: Uint8Array;
  /** Rotas internas do Módulo 05 (sem elas, o checkout responde 503). */
  gestao?: GestaoPedidos | null;
}

const id = z.string().trim().min(1).max(80).regex(/^[\w-]+$/, "id inválido.");
const FRETE_MAXIMO_CENTAVOS = 20_000;
const texto = (max: number) => z.string().trim().min(1).max(max);

/** Corpo do POST /pedidos: preço, frete e total são calculados aqui, nunca vêm do navegador. */
const esquemaPedido = z.object({
  comprador: z.object({ nome: texto(120), email: z.string().trim().toLowerCase().max(254).pipe(z.email()) }),
  endereco: z.object({
    cep: z.string().regex(/^\d{5}-?\d{3}$/, "cep inválido."),
    logradouro: texto(160),
    numero: texto(20),
    complemento: z.string().trim().max(80).optional(),
    bairro: texto(80),
    cidade: texto(80),
    uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "uf inválida."),
  }),
  itens: z.array(id).min(1).max(20),
});

// ---- vitrine (Req. 007): parâmetros do GET /pecas ----

const POR_PAGINA_PADRAO = 12;
const POR_PAGINA_MAXIMO = 48;
const PRECO_MAXIMO_CENTAVOS = 10_000_000; // R$ 100.000,00: só um teto contra valores absurdos

/**
 * Na query string tudo chega como texto, e o formulário GET da vitrine manda os campos
 * vazios (`?busca=&categoria=`). Campo vazio conta como "não informado".
 */
const opcional = <T extends z.ZodType>(esquema: T) => z.preprocess((v) => (v === "" ? undefined : v), esquema.optional());

/** Inteiro sem sinal vindo da URL ("12" → 12). Recusa "-1", "10.5", "abc" e parâmetro repetido. */
const inteiro = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/, "use um número inteiro, sem sinal nem vírgula.")
    .transform(Number)
    .pipe(z.number().min(min, `o mínimo é ${min}.`).max(max, `o máximo é ${max}.`));

const ORDENS =["recentes", "menor-preco", "maior-preco"] as const;

const esquemaVitrine = z
  .object({
    busca: opcional(z.string().trim().max(100, "a busca pode ter até 100 caracteres.")),
    categoria: opcional(z.string().refine(categoriaPermitida, "categoria inválida.")),
    tamanho: opcional(z.string().trim().max(20)),
    condicao: opcional(z.enum(CONDICOES, "condição inválida.")),
    precoMin: opcional(inteiro(0, PRECO_MAXIMO_CENTAVOS)),
    precoMax: opcional(inteiro(0, PRECO_MAXIMO_CENTAVOS)),
    ordem: opcional(z.enum(ORDENS, "use recentes, menor-preco ou maior-preco.")),
    pagina: opcional(inteiro(1, 10_000)),
    porPagina: opcional(inteiro(1, POR_PAGINA_MAXIMO)),
  })
  .refine((f) => f.precoMin === undefined || f.precoMax === undefined || f.precoMin <= f.precoMax, {
    path: ["precoMin"],
    message: "o preço mínimo não pode ser maior que o máximo.",
  });

/** Minúsculas e sem acento, para a busca não diferenciar "Óculos" de "oculos". */
const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/**
 * API do catálogo (substitui o json-server). Só expõe o que o site usa:
 * GET /pecas, GET /pecas/:id (públicas); POST /pecas/:id/reservar, POST /pecas/:id/liberar,
 * POST /pedidos, GET /pedidos/:id (com login). Integração (X-API-Key): /integracao/*.
 * A compra (checkout e Pix) passa pelo CompraFacade, que leva o pedido ao Módulo 05.
 */
export function criarAppCatalogo(loja: Loja, config: ConfigCatalogo, agora: () => number = Date.now) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(helmet());
  app.use(cors(config.origens));
  app.use(limiteRequisicoes({ max: 300, agora })); // leitura geral
  app.use(express.json({ limit: "10kb" }));

  // escrita: limite menor por IP
  const escrita = limiteRequisicoes({ max: 30, agora });

  const achar = (pecaId: string) => {
    const peca = loja.peca(pecaId);
    // anúncio ocultado pela administração conta como inexistente para o público
    if (!peca || peca.oculta) throw new Recusa(404, "essa peça não existe mais.");
    return peca;
  };
  // quem reservou nunca aparece para o público
  const pecaPublica = ({ oculta: _oculta, motivoOculta: _motivo, reservadaPor: _por, ...p }: Peca) => ({ ...p, status: statusAtual(p, agora()) });
  /** Frete fixo: o que a administração definiu no painel ou, se nada, o padrão do servidor. */
  const freteAtual = () => loja.configuracao().freteCentavos ?? config.freteCentavos;
  const compras = new CompraFacade(loja, config.gestao ?? null, { frete: freteAtual, agora });
  const login = exigirLogin(config.jwtSegredo);
  const quem = (res: Response) => res.locals.usuaria as Autenticada;

  /** Regras públicas usadas pela sacola e pelo checkout para mostrar o frete antes do pedido. */
  app.get("/config", (_req, res) => {
    res.json({ freteCentavos: freteAtual(), reservaMinutos: config.reservaMinutos });
  });

  /**
   * Vitrine (Req. 007): só peças ativas (não ocultas, não vendidas; reservadas aparecem com o selo),
   * com busca, filtros, ordenação e paginação. Responde { itens, total, pagina, porPagina }.
   */
  app.get("/pecas", (req, res) => {
    const f = esquemaVitrine.parse(req.query);
    const termo = f.busca ? normalizar(f.busca) : "";
    const ordem = f.ordem ?? "recentes";
    const pagina = f.pagina ?? 1;
    const porPagina = f.porPagina ?? POR_PAGINA_PADRAO;

    const filtradas = loja
      .listarPecas()
      .filter(
        (p) =>
          !p.oculta &&
          statusAtual(p, agora()) !== "vendida" &&
          (!termo || normalizar(`${p.titulo} ${p.marca ?? ""} ${p.descricao ?? ""}`).includes(termo)) &&
          (!f.categoria || p.categoria === f.categoria) &&
          (!f.tamanho || p.tamanho === f.tamanho) &&
          (!f.condicao || p.condicao === f.condicao) &&
          (f.precoMin === undefined || p.precoCentavos >= f.precoMin) &&
          (f.precoMax === undefined || p.precoCentavos <= f.precoMax),
      )
      .sort((a, b) => {
        const porPreco = a.precoCentavos - b.precoCentavos;
        const diferenca =
          ordem === "menor-preco" ? porPreco : ordem === "maior-preco" ? -porPreco : String(b.criadoEm).localeCompare(String(a.criadoEm));
        // desempate pelo id: a ordem fica sempre igual e uma peça não pula de uma página para outra
        return diferenca || a.id.localeCompare(b.id);
      });

    const inicio = (pagina - 1) * porPagina;
    // só as peças da página viram o formato público (sem os campos internos da administração)
    const itens = filtradas.slice(inicio, inicio + porPagina).map(pecaPublica);
    res.json({ itens, total: filtradas.length, pagina, porPagina });
  });

  app.get("/pecas/:id", (req, res) => {
    res.json(pecaPublica(achar(id.parse(req.params.id))));
  });

  // ---- sacola: reservar e liberar exigem login (a reserva fica no nome de quem reservou) ----
  app.post("/pecas/:id/reservar", escrita, login, async (req, res) => {
    const pecaId = id.parse(req.params.id);
    const usuaria = quem(res);
    const peca = await loja.alterarEmFila(() => {
      const p = achar(pecaId);
      if (p.vendedoraId === usuaria.id) throw new Recusa(403, "essa peça é sua: não dá para colocar na sua sacola.");
      if (statusAtual(p, agora()) !== "disponivel" || compras.pecaEmPedidoAberto(p.id)) {
        throw new Recusa(409, "essa peça acabou de ser reservada ou vendida por outra pessoa.");
      }
      p.status = "reservada";
      p.reservadaAte = new Date(agora() + config.reservaMinutos * 60_000).toISOString();
      p.reservadaPor = usuaria.id;
      return pecaPublica(p);
    });
    res.json(peca);
  });

  app.post("/pecas/:id/liberar", escrita, login, async (req, res) => {
    const pecaId = id.parse(req.params.id);
    const usuaria = quem(res);
    const peca = await loja.alterarEmFila(() => {
      const p = achar(pecaId);
      // só desfaz uma reserva em vigor; peça vendida continua vendida
      if (statusAtual(p, agora()) === "reservada") {
        if (p.reservadaPor !== usuaria.id) throw new Recusa(403, "essa reserva não é sua.");
        if (compras.pecaEmPedidoAberto(p.id)) throw new Recusa(409, "essa peça está num pedido esperando o Pix: ela volta à vitrine se o prazo acabar.");
      }
      if (p.status === "reservada") {
        p.status = "disponivel";
        p.reservadaAte = null;
        p.reservadaPor = null;
      }
      return pecaPublica(p);
    });
    res.json(peca);
  });

  // ---- compra: exige login; o CompraFacade leva o pedido ao Módulo 05 (issue #31) ----
  app.post("/pedidos", escrita, login, async (req, res) => {
    const dados = esquemaPedido.parse(req.body);
    res.status(201).json(await compras.criarCompra(quem(res).id, dados));
  });

  /** Só a compradora vê o pedido (tem endereço e e-mail). Para as outras pessoas, ele não existe. */
  app.get("/pedidos/:id", login, (req, res) => {
    const pedido = loja.pedido(id.parse(req.params.id));
    if (!pedido || pedido.compradoraId !== quem(res).id) throw new Recusa(404, "pedido não encontrado.");
    res.json(pedido);
  });

  // ---- integração (sistemas parceiros): exige X-API-Key ----
  const integracao = express.Router();
  integracao.use(exigirApiKey(config.apiKeys));

  /** Webhook do Pix: a venda entra na carteira (Módulo 05) e as peças viram vendidas. Idempotente. */
  integracao.post("/pagamentos/:id/confirmar", async (req, res) => {
    res.json(await compras.confirmarPagamento(id.parse(req.params.id)));
  });

  /** Exporta os pedidos (ex.: para um sistema de gestão), do mais novo ao mais antigo. */
  integracao.get("/pedidos", (req, res) => {
    const status = z.enum(["aguardando_pagamento", "pago", "cancelado"]).optional().parse(req.query.status);
    const pedidos = loja
      .listarPedidos()
      .filter((p) => !status || p.status === status)
      .toSorted((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    res.json({ total: pedidos.length, pedidos });
  });

  app.use("/integracao", integracao);

  // ---- painel do admin (Módulo 05): anúncios. Só a administradora master. ----
  const admin = express.Router();
  admin.use(exigirLogin(config.jwtSegredo), exigirAdminMaster);

  /** Todos os anúncios, inclusive os ocultos; "irregular" = fora das categorias de moda. */
  admin.get("/pecas", (_req, res) => {
    res.json({
      pecas: loja.listarPecas().map((p) => ({
        ...p,
        status: statusAtual(p, agora()),
        oculta: !!p.oculta,
        irregular: !categoriaPermitida(p.categoria),
      })),
    });
  });

  admin.post("/pecas/:id/ocultar", escrita, async (req, res) => {
    const pecaId = id.parse(req.params.id);
    const { motivo } = z.object({ motivo: z.string().trim().max(200).optional() }).parse(req.body ?? {});
    const peca = await loja.alterarEmFila(() => {
      const p = loja.peca(pecaId);
      if (!p) throw new Recusa(404, "anúncio não encontrado.");
      p.oculta = true;
      p.motivoOculta = motivo ?? (categoriaPermitida(p.categoria) ? "anúncio irregular" : "fora das categorias permitidas");
      return { ...p };
    });
    res.json(peca);
  });

  /** Volta a mostrar o anúncio, mas nunca um que esteja fora das categorias permitidas. */
  admin.post("/pecas/:id/reexibir", escrita, async (req, res) => {
    const pecaId = id.parse(req.params.id);
    const peca = await loja.alterarEmFila(() => {
      const p = loja.peca(pecaId);
      if (!p) throw new Recusa(404, "anúncio não encontrado.");
      if (!categoriaPermitida(p.categoria)) throw new Recusa(422, "categoria não permitida: o desaPego aceita só roupas, calçados, bolsas e acessórios.");
      p.oculta = false;
      p.motivoOculta = null;
      return { ...p };
    });
    res.json(peca);
  });

  admin.get("/frete", (_req, res) => {
    res.json({ freteCentavos: freteAtual() });
  });

  /** Novo frete fixo: vale para os pedidos criados daqui em diante (os antigos guardam o deles). */
  admin.put("/frete", escrita, async (req, res) => {
    const { freteCentavos } = z
      .object({ freteCentavos: z.number().int("use centavos inteiros.").min(0).max(FRETE_MAXIMO_CENTAVOS, "o frete pode ir até R$ 200,00.") })
      .parse(req.body);
    await loja.alterarEmFila((d) => {
      d.configuracao = { ...d.configuracao, freteCentavos };
    });
    res.json({ freteCentavos });
  });

  app.use("/admin", admin);

  app.use((_req, res) => {
    res.status(404).json({ erro: "rota não encontrada." });
  });
  app.use((erro: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (erro instanceof Recusa) return res.status(erro.status).json({ erro: erro.message });
    if (erro instanceof z.ZodError) {
      const campos = Object.fromEntries(erro.issues.map((i) => [i.path.join("."), i.message]));
      return res.status(400).json({ erro: "confira os dados enviados.", campos });
    }
    const tipo = (erro as { type?: string }).type;
    if (tipo === "entity.parse.failed") return res.status(400).json({ erro: "JSON inválido." });
    if (tipo === "entity.too.large") return res.status(413).json({ erro: "requisição grande demais." });
    console.error("[catalogo]", erro);
    res.status(500).json({ erro: "erro interno. tente de novo." });
  });
  // o servidor usa `compras` para cancelar os pedidos com o Pix vencido de tempos em tempos
  return Object.assign(app, { compras });
}
