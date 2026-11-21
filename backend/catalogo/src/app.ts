import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { z } from "zod";
import { exigirAdminMaster, exigirLogin } from "../../comum/autenticacao.js";
import { categoriaPermitida } from "../../comum/categorias.js";
import { cors, exigirApiKey, limiteRequisicoes } from "../../comum/seguranca.js";
import type { Loja, Peca, Pedido } from "./loja.js";

export interface ConfigCatalogo {
  origens: string[];
  apiKeys: string[];
  trustProxy: string | number;
  reservaMinutos: number;
  freteCentavos: number;
  /** Segredo do JWT do serviço de contas: o painel do admin (ocultar anúncios) exige login. */
  jwtSegredo: Uint8Array;
}

/** Erro de regra de negócio: vira a resposta { erro } com o status dado. */
class Recusa extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
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

/** Uma reserva vencida volta a contar como disponível. */
export function statusAtual(peca: Pick<Peca, "status" | "reservadaAte">, agora: number) {
  if (peca.status === "reservada" && peca.reservadaAte && new Date(peca.reservadaAte).getTime() <= agora) return "disponivel";
  return peca.status;
}

/** Código no formato de Pix copia-e-cola, só para demonstração. */
function pixSimulado(totalCentavos: number, txid: string) {
  const valor = (totalCentavos / 100).toFixed(2);
  return `00020126360014br.gov.bcb.pix0114DESAPEGODEMO5204000053039865405${valor}5802BR5908desaPego6008BRASILIA62140510${txid.toUpperCase()}6304DEMO`;
}

/**
 * API do catálogo (substitui o json-server). Só expõe o que o site usa:
 * GET /pecas, GET /pecas/:id, POST /pecas/:id/reservar, POST /pecas/:id/liberar,
 * POST /pedidos, GET /pedidos/:id. Integração (X-API-Key): /integracao/*.
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
  const pecaPublica = ({ oculta: _oculta, motivoOculta: _motivo, ...p }: Peca) => ({ ...p, status: statusAtual(p, agora()) });
  /** Frete fixo: o que a administração definiu no painel ou, se nada, o padrão do servidor. */
  const freteAtual = () => loja.configuracao().freteCentavos ?? config.freteCentavos;

  /** Regras públicas usadas pela sacola e pelo checkout para mostrar o frete antes do pedido. */
  app.get("/config", (_req, res) => {
    res.json({ freteCentavos: freteAtual(), reservaMinutos: config.reservaMinutos });
  });

  app.get("/pecas", (_req, res) => {
    res.json(loja.listarPecas().filter((p) => !p.oculta).map(pecaPublica));
  });

  app.get("/pecas/:id", (req, res) => {
    res.json(pecaPublica(achar(id.parse(req.params.id))));
  });

  app.post("/pecas/:id/reservar", escrita, async (req, res) => {
    const pecaId = id.parse(req.params.id);
    const peca = await loja.alterarEmFila(() => {
      const p = achar(pecaId);
      if (statusAtual(p, agora()) !== "disponivel") throw new Recusa(409, "essa peça acabou de ser reservada ou vendida por outra pessoa.");
      p.status = "reservada";
      p.reservadaAte = new Date(agora() + config.reservaMinutos * 60_000).toISOString();
      return { ...p };
    });
    res.json(peca);
  });

  app.post("/pecas/:id/liberar", escrita, async (req, res) => {
    const pecaId = id.parse(req.params.id);
    const peca = await loja.alterarEmFila(() => {
      const p = achar(pecaId);
      // só desfaz uma reserva; peça vendida continua vendida
      if (p.status === "reservada") {
        p.status = "disponivel";
        p.reservadaAte = null;
      }
      return pecaPublica(p);
    });
    res.json(peca);
  });

  app.post("/pedidos", escrita, async (req, res) => {
    const dados = esquemaPedido.parse(req.body);
    const pedido = await loja.alterarEmFila(() => {
      // cada peça precisa existir e continuar reservada (o checkout relê antes de criar o pedido)
      const pecas = [...new Set(dados.itens)].map((pecaId) => {
        const p = achar(pecaId);
        if (statusAtual(p, agora()) !== "reservada") throw new Recusa(409, `a reserva de “${p.titulo}” expirou. volte à sacola e tente de novo.`);
        return p;
      });
      const subtotal = pecas.reduce((soma, p) => soma + p.precoCentavos, 0);
      const frete = freteAtual();
      const novoId = loja.novoId();
      const novo: Pedido = {
        id: novoId,
        comprador: dados.comprador,
        endereco: dados.endereco,
        itens: pecas.map((p) => ({ id: p.id, titulo: p.titulo, precoCentavos: p.precoCentavos })),
        subtotalCentavos: subtotal,
        freteCentavos: frete,
        totalCentavos: subtotal + frete,
        status: "aguardando_pagamento",
        pixCopiaECola: pixSimulado(subtotal + frete, novoId),
        pixExpiraEm: pecas.map((p) => p.reservadaAte!).sort()[0],
        criadoEm: new Date(agora()).toISOString(),
      };
      loja.listarPedidos().push(novo);
      return novo;
    });
    res.status(201).json(pedido);
  });

  app.get("/pedidos/:id", (req, res) => {
    const pedido = loja.pedido(id.parse(req.params.id));
    if (!pedido) throw new Recusa(404, "pedido não encontrado.");
    res.json(pedido);
  });

  // ---- integração (sistemas parceiros): exige X-API-Key ----
  const integracao = express.Router();
  integracao.use(exigirApiKey(config.apiKeys));

  /** Webhook do Pix: marca o pedido como pago e as peças como vendidas. Idempotente. */
  integracao.post("/pagamentos/:id/confirmar", async (req, res) => {
    const pedidoId = id.parse(req.params.id);
    const pedido = await loja.alterarEmFila(() => {
      const p = loja.pedido(pedidoId);
      if (!p) throw new Recusa(404, "pedido não encontrado.");
      if (p.status === "aguardando_pagamento") {
        p.status = "pago";
        p.pagoEm = new Date(agora()).toISOString();
        for (const item of p.itens) {
          const peca = loja.peca(item.id);
          if (peca) {
            peca.status = "vendida";
            peca.reservadaAte = null;
          }
        }
      }
      return { ...p };
    });
    res.json(pedido);
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
  return app;
}
