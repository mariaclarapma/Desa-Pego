import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { z } from "zod";
import { exigirAdminMaster, exigirLogin, type Autenticada } from "../../comum/autenticacao.js";
import { CATEGORIAS, CONDICOES, type CategoriaSlug } from "../../comum/categorias.js";
import { dividirValor, PONTOS_BASE_100 } from "../../comum/dinheiro.js";
import { cors, exigirApiKey, limiteRequisicoes } from "../../comum/seguranca.js";
import type { BancoPedidos, Pedido } from "./banco.js";
import { montarDashboard, PERIODOS } from "./dashboard.js";
import { nomeVendedoraDemo, pedidosDemonstracao } from "./dashboard-demo.js";
import { conferirTransicao, STATUS, type Ator, type StatusPedido } from "./estados.js";

export interface ConfigPedidos {
  jwtSegredo: Uint8Array;
  apiKeys: string[];
  origens: string[];
  trustProxy: string | number;
}

/** Recusa de regra de negócio: vira { erro } com o status HTTP dado. */
class Recusa extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

const centavos = z.number().int("use centavos inteiros.").nonnegative();
const idTexto = z.string().trim().min(1).max(80).regex(/^[\w-]+$/, "id inválido.");
const filtroStatus = z.object({ status: z.enum(STATUS).optional() });

/** Pedido vindo do checkout (Módulo 04) pela rota interna. Comissão e divisão são calculadas aqui. */
const esquemaNovoPedido = z
  .object({
    compradoraId: idTexto,
    vendedoraId: idTexto,
    itens: z
      .array(
        z.object({
          id: idTexto,
          titulo: z.string().trim().min(1).max(160),
          precoCentavos: centavos.positive(),
          // opcional: o checkout ainda não manda; quando mandar, o dashboard agrupa por categoria
          categoria: z.enum(CATEGORIAS.map((c) => c.slug) as [CategoriaSlug, ...CategoriaSlug[]]).optional(),
        }),
      )
      .min(1)
      .max(20),
    freteCentavos: centavos,
    endereco: z.record(z.string(), z.string().max(160)),
  })
  .refine((p) => p.compradoraId !== p.vendedoraId, { path: ["compradoraId"], message: "a vendedora não pode comprar a própria peça." });

/** Taxa do Pix: até 10% (1000 pontos-base). */
const TAXA_PIX_MAXIMA = 1000;

/** Tabela de preço sugerido enviada pelo painel do admin. */
const esquemaPrecos = z.object({
  faixas: z
    .array(
      z
        .object({
          categoria: z.enum(CATEGORIAS.map((c) => c.slug) as [CategoriaSlug, ...CategoriaSlug[]]),
          condicao: z.enum(CONDICOES),
          minimoCentavos: centavos.positive("o mínimo precisa ser maior que zero.").max(10_000_000),
          maximoCentavos: centavos.positive().max(10_000_000),
        })
        .refine((f) => f.minimoCentavos <= f.maximoCentavos, { path: ["maximoCentavos"], message: "o máximo não pode ser menor que o mínimo." }),
    )
    .min(1)
    .max(CATEGORIAS.length * CONDICOES.length)
    .refine((faixas) => new Set(faixas.map((f) => `${f.categoria}/${f.condicao}`)).size === faixas.length, {
      message: "cada categoria e condição aparece uma vez só.",
    }),
});

/** Endereço de entrega só aparece para a vendedora do pedido (Req. 013). */
const semEndereco = ({ endereco: _endereco, ...resto }: Pedido) => resto;

/**
 * Serviço do Módulo 05: pedidos (Req. 013), carteira e painel do admin (Req. 014).
 * Toda regra é conferida aqui; o site só esconde opções.
 */
export function criarAppPedidos(banco: BancoPedidos, config: ConfigPedidos, agora: () => number = Date.now) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(helmet());
  app.use(cors(config.origens));
  app.use(limiteRequisicoes({ max: 300, agora }));
  app.use(express.json({ limit: "20kb" }));

  const login = exigirLogin(config.jwtSegredo);
  const quem = (res: Response) => res.locals.usuaria as Autenticada;

  app.get("/saude", (_req, res) => {
    res.json({ ok: true });
  });

  /**
   * Aplica uma transição de status com os efeitos na carteira, tudo na fila:
   * conferir o status e mudar acontecem juntos.
   */
  async function transicionar(pedidoId: string, para: StatusPedido, ator: (p: Pedido) => Ator | null) {
    return banco.emFila(async () => {
      const p = await banco.pedido(pedidoId);
      if (!p) throw new Recusa(404, "pedido não encontrado.");
      const papel = ator(p);
      // quem não participa do pedido não pode nem saber o status dele
      if (!papel) throw new Recusa(403, "este pedido não é seu.");
      // webhook repetido (Pix confirmado ou vencido duas vezes): nada muda e responde 200,
      // senão o provedor de pagamento continuaria reenviando
      if (papel === "sistema" && p.status === para) return p;
      const veredito = conferirTransicao(p.status, para, papel);
      if (!veredito.ok) {
        if (veredito.motivo === "sem-permissao") throw new Recusa(403, "você não pode fazer isso neste pedido.");
        throw new Recusa(409, `não dá para passar de ${p.status} para ${para}.`);
      }
      await banco.mudarStatus(p.id, para);
      const base = { vendedoraId: p.vendedoraId, pedidoId: p.id, repasseId: null };
      if (para === "PAGO") {
        // a venda paga gera os três lançamentos: vendedora + comissão + taxa = total cobrado
        await banco.lancar({ ...base, tipo: "venda", pendenteCentavos: p.vendedoraCentavos, disponivelCentavos: 0 });
        await banco.lancar({ ...base, conta: "comissao", tipo: "venda", pendenteCentavos: 0, disponivelCentavos: p.comissaoCentavos });
        await banco.lancar({ ...base, conta: "taxa_pix", tipo: "venda", pendenteCentavos: 0, disponivelCentavos: p.taxaPixCentavos });
      } else if (para === "ENTREGUE") {
        // só agora o dinheiro da venda fica disponível para saque
        await banco.lancar({ ...base, tipo: "liberacao", pendenteCentavos: -p.vendedoraCentavos, disponivelCentavos: p.vendedoraCentavos });
      } else if (para === "CANCELADO" && p.status === "PAGO") {
        await banco.lancar({ ...base, tipo: "estorno", pendenteCentavos: -p.vendedoraCentavos, disponivelCentavos: 0 });
        await banco.lancar({ ...base, conta: "comissao", tipo: "estorno", pendenteCentavos: 0, disponivelCentavos: -p.comissaoCentavos });
        await banco.lancar({ ...base, conta: "taxa_pix", tipo: "estorno", pendenteCentavos: 0, disponivelCentavos: -p.taxaPixCentavos });
      }
      return { ...p, status: para };
    });
  }

  /** Papel de quem está logado neste pedido (null = não participa). */
  const papelDe = (usuaria: Autenticada) => (p: Pedido): Ator | null =>
    p.compradoraId === usuaria.id ? "compradora" : p.vendedoraId === usuaria.id ? "vendedora" : null;

  // ---- rotas internas (checkout e webhook do Pix, Módulo 04): X-API-Key ----
  const interno = express.Router();
  interno.use(exigirApiKey(config.apiKeys));

  interno.post("/pedidos", async (req, res) => {
    const dados = esquemaNovoPedido.parse(req.body);
    const subtotal = dados.itens.reduce((soma, i) => soma + i.precoCentavos, 0);
    const total = subtotal + dados.freteCentavos;
    // a comissão e a taxa vigentes ficam congeladas no pedido (Req. 011 e 014)
    const comissao = await banco.comissaoAtual();
    const taxaPix = await banco.taxaPixAtual();
    const divisao = dividirValor(subtotal, comissao);
    // o Pix cobra sobre o valor inteiro que a compradora paga (peças + frete)
    const taxaPixCentavos = dividirValor(total, taxaPix).comissaoCentavos;
    const pedido = await banco.inserirPedido({
      id: randomUUID(),
      compradoraId: dados.compradoraId,
      vendedoraId: dados.vendedoraId,
      itens: dados.itens,
      endereco: dados.endereco,
      subtotalCentavos: subtotal,
      freteCentavos: dados.freteCentavos,
      totalCentavos: total,
      comissaoPontosBase: comissao,
      comissaoCentavos: divisao.comissaoCentavos,
      taxaPixPontosBase: taxaPix,
      taxaPixCentavos,
      // nunca negativo: comissão ≤ 50% das peças e taxa ≤ 10% do total
      vendedoraCentavos: divisao.vendedoraCentavos + dados.freteCentavos - taxaPixCentavos,
      status: "AGUARDANDO_PAGAMENTO",
    });
    res.status(201).json(pedido);
  });

  interno.post("/pedidos/:id/pagamento-confirmado", async (req, res) => {
    res.json(await transicionar(idTexto.parse(req.params.id), "PAGO", () => "sistema"));
  });

  interno.post("/pedidos/:id/expirar", async (req, res) => {
    res.json(await transicionar(idTexto.parse(req.params.id), "CANCELADO", () => "sistema"));
  });

  app.use("/interno", interno);

  // ---- pedidos da usuária logada ----
  app.get("/pedidos/compras", login, async (req, res) => {
    const { status } = filtroStatus.parse(req.query);
    res.json({ pedidos: (await banco.pedidosDe("compradora", quem(res).id, status)).map(semEndereco) });
  });

  app.get("/pedidos/vendas", login, async (req, res) => {
    const { status } = filtroStatus.parse(req.query);
    res.json({ pedidos: await banco.pedidosDe("vendedora", quem(res).id, status) });
  });

  app.get("/pedidos/:id", login, async (req, res) => {
    const p = await banco.pedido(idTexto.parse(req.params.id));
    if (!p) throw new Recusa(404, "pedido não encontrado.");
    const usuaria = quem(res);
    const papel = papelDe(usuaria)(p);
    if (!papel && usuaria.perfil !== "ADMIN_MASTER") throw new Recusa(403, "este pedido não é seu.");
    res.json(papel === "compradora" ? semEndereco(p) : p);
  });

  // só a vendedora do pedido marca como enviado
  app.post("/pedidos/:id/enviar", login, async (req, res) => {
    res.json(await transicionar(idTexto.parse(req.params.id), "ENVIADO", papelDe(quem(res))));
  });

  // só a compradora do pedido confirma o recebimento (libera o saldo da vendedora)
  app.post("/pedidos/:id/confirmar-recebimento", login, async (req, res) => {
    res.json(semEndereco(await transicionar(idTexto.parse(req.params.id), "ENTREGUE", papelDe(quem(res)))));
  });

  // a compradora cancela enquanto não pagou
  app.post("/pedidos/:id/cancelar", login, async (req, res) => {
    res.json(semEndereco(await transicionar(idTexto.parse(req.params.id), "CANCELADO", papelDe(quem(res)))));
  });

  // ---- carteira da vendedora ----
  app.get("/carteira", login, async (_req, res) => {
    const id = quem(res).id;
    res.json({ ...(await banco.saldo(id)), extrato: await banco.extrato(id) });
  });

  app.get("/carteira/repasses", login, async (_req, res) => {
    res.json({ repasses: await banco.repasses({ vendedoraId: quem(res).id }) });
  });

  /** Solicitação de saque: não pode passar do saldo disponível (menos o que já está em saque). */
  app.post("/carteira/repasses", login, async (req, res) => {
    const { valorCentavos } = z.object({ valorCentavos: centavos.positive("o valor precisa ser maior que zero.") }).parse(req.body);
    const id = quem(res).id;
    const repasse = await banco.emFila(async () => {
      const { podeSacarCentavos } = await banco.saldo(id);
      if (valorCentavos > podeSacarCentavos) throw new Recusa(422, "o valor do repasse é maior que o saldo disponível.");
      return banco.criarRepasse(id, valorCentavos);
    });
    res.status(201).json(repasse);
  });

  /**
   * Regras públicas da plataforma: o simulador de ganho e a sugestão de preço do anúncio
   * (Módulo 02) leem daqui. Só leitura; quem altera é o painel do admin.
   */
  const configuracao = async () => ({
    comissaoPontosBase: await banco.comissaoAtual(),
    taxaPixPontosBase: await banco.taxaPixAtual(),
    precosSugeridos: await banco.precosSugeridos(),
  });

  app.get("/config", async (_req, res) => {
    res.json(await configuracao());
  });

  // ---- painel do admin: só a administradora master ----
  const admin = express.Router();
  admin.use(login, exigirAdminMaster);

  admin.get("/resumo", async (_req, res) => {
    res.json({ ...(await banco.resumo()), comissaoPontosBase: await banco.comissaoAtual(), taxaPixPontosBase: await banco.taxaPixAtual() });
  });

  /** Dashboard de vendas: totais, série no tempo, para onde vão as peças, categorias e vendedoras. */
  admin.get("/dashboard", async (req, res) => {
    const { periodo, demo } = z
      .object({ periodo: z.enum(PERIODOS).default("12m"), demo: z.enum(["0", "1"]).default("0") })
      .parse(req.query);
    if (demo === "1") {
      // dados FICTÍCIOS, gerados na hora e nunca gravados: a resposta vem marcada
      const d = montarDashboard(pedidosDemonstracao(agora()), periodo, agora());
      return res.json({ ...d, demonstracao: true, vendedoras: d.vendedoras.map((v) => ({ ...v, nome: nomeVendedoraDemo(v.vendedoraId) })) });
    }
    res.json(montarDashboard(await banco.todosPedidos(), periodo, agora()));
  });

  admin.get("/configuracao", async (_req, res) => {
    res.json(await configuracao());
  });

  /** Nova taxa do Pix: como a comissão, vale só para pedidos novos. */
  admin.put("/taxa-pix", async (req, res) => {
    const { taxaPixPontosBase } = z
      .object({
        taxaPixPontosBase: z
          .number()
          .int("use pontos-base inteiros (99 = 0,99%).")
          .min(0)
          .max(TAXA_PIX_MAXIMA, "a taxa do Pix pode ir até 10%."),
      })
      .parse(req.body);
    await banco.definirTaxaPix(taxaPixPontosBase);
    res.json({ taxaPixPontosBase });
  });

  /** Troca a tabela de preço sugerido inteira: uma faixa por categoria e condição, sem repetir. */
  admin.put("/precos-sugeridos", async (req, res) => {
    const { faixas } = esquemaPrecos.parse(req.body);
    await banco.emFila(() => banco.definirPrecosSugeridos(faixas));
    res.json({ precosSugeridos: await banco.precosSugeridos() });
  });

  admin.get("/pedidos", async (req, res) => {
    const { status } = filtroStatus.parse(req.query);
    res.json({ pedidos: await banco.todosPedidos(status) });
  });

  admin.post("/pedidos/:id/cancelar", async (req, res) => {
    res.json(await transicionar(idTexto.parse(req.params.id), "CANCELADO", () => "admin"));
  });

  admin.get("/comissao", async (_req, res) => {
    res.json({ comissaoPontosBase: await banco.comissaoAtual() });
  });

  /** Nova comissão: vale só para pedidos novos (os antigos guardam a comissão da compra). */
  admin.put("/comissao", async (req, res) => {
    const { comissaoPontosBase } = z
      .object({ comissaoPontosBase: z.number().int("use pontos-base inteiros (1000 = 10%).").min(0).max(PONTOS_BASE_100 / 2, "a comissão pode ir até 50%.") })
      .parse(req.body);
    await banco.definirComissao(comissaoPontosBase);
    res.json({ comissaoPontosBase });
  });

  admin.get("/repasses", async (req, res) => {
    const { status } = z.object({ status: z.enum(["SOLICITADO", "PAGO"]).optional() }).parse(req.query);
    res.json({ repasses: await banco.repasses({ status }) });
  });

  /** Registra o Pix manual ao vendedor (Req. 014): debita o disponível; nunca maior que ele. */
  admin.post("/repasses/:id/pagar", async (req, res) => {
    const repasseId = z.string().uuid("id inválido.").parse(req.params.id);
    const pago = await banco.emFila(async () => {
      const r = await banco.repasse(repasseId);
      if (!r) throw new Recusa(404, "repasse não encontrado.");
      if (r.status === "PAGO") throw new Recusa(409, "este repasse já foi pago.");
      const { disponivelCentavos } = await banco.saldo(r.vendedoraId);
      if (r.valorCentavos > disponivelCentavos) throw new Recusa(422, "o valor do repasse é maior que o saldo disponível.");
      await banco.lancar({ vendedoraId: r.vendedoraId, pedidoId: null, repasseId: r.id, tipo: "repasse", pendenteCentavos: 0, disponivelCentavos: -r.valorCentavos });
      return { ...r, status: "PAGO" as const, pagoEm: await banco.marcarRepassePago(r.id) };
    });
    res.json(pago);
  });

  app.use("/admin", admin);

  app.use((_req, res) => {
    res.status(404).json({ erro: "rota não encontrada." });
  });
  app.use((erro: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (erro instanceof Recusa) return res.status(erro.status).json({ erro: erro.message });
    if (erro instanceof z.ZodError) {
      const campos = Object.fromEntries(erro.issues.map((i) => [i.path.join(".") || "corpo", i.message]));
      return res.status(400).json({ erro: "confira os dados enviados.", campos });
    }
    const tipo = (erro as { type?: string }).type;
    if (tipo === "entity.parse.failed") return res.status(400).json({ erro: "JSON inválido." });
    if (tipo === "entity.too.large") return res.status(413).json({ erro: "requisição grande demais." });
    console.error("[pedidos]", erro);
    res.status(500).json({ erro: "erro interno. tente de novo." });
  });
  return app;
}
