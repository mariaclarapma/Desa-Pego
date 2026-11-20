import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Peças de segurança usadas pelos dois serviços do backend (contas e catálogo).
 * Tudo em memória e sem dependências: proporcional a um projeto de uma instância só.
 */

const MINUTO = 60_000;

/** Lista separada por vírgula (ex.: "http://localhost:3000, https://desapego.onrender.com"). */
export const lerLista = (valor?: string) =>
  (valor ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * CORS com lista de origens permitidas (nunca "*").
 * - Origem permitida: responde com os cabeçalhos CORS dela (e o preflight OPTIONS com 204).
 * - Origem de fora: 403. Navegadores sempre mandam Origin em POST/PATCH/DELETE, então isto
 *   também barra formulários de outros sites (CSRF).
 * - Sem Origin (curl, servidor-a-servidor, renderização no servidor do Next): segue, e as rotas
 *   sensíveis têm a própria proteção (token ou API key).
 */
export function cors(origens: string[]) {
  const permitidas = new Set(origens);
  return (req: Request, res: Response, next: NextFunction) => {
    const origem = req.get("origin");
    if (!origem) return next();
    if (!permitidas.has(origem)) return res.status(403).json({ erro: "origem não permitida." });
    res.vary("Origin");
    res.set("Access-Control-Allow-Origin", origem);
    res.set("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
      res.set("Access-Control-Max-Age", "600");
      return res.status(204).end();
    }
    next();
  };
}

/**
 * Limite de requisições por IP numa janela fixa (camada 7 dentro da aplicação; o WAF fica
 * na frente, veja o README). Responde 429 com Retry-After.
 */
export function limiteRequisicoes({ max, janelaMs = MINUTO, agora = Date.now }: { max: number; janelaMs?: number; agora?: () => number }) {
  const contagem = new Map<string, { inicio: number; total: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const chave = req.ip ?? "desconhecido";
    const t = agora();
    let atual = contagem.get(chave);
    if (!atual || t - atual.inicio >= janelaMs) {
      atual = { inicio: t, total: 0 };
      contagem.set(chave, atual);
      // limpeza simples para o mapa não crescer sem fim
      if (contagem.size > 10_000) for (const [k, v] of contagem) if (t - v.inicio >= janelaMs) contagem.delete(k);
    }
    atual.total += 1;
    if (atual.total > max) {
      res.set("Retry-After", String(Math.ceil((atual.inicio + janelaMs - t) / 1000)));
      return res.status(429).json({ erro: "muitas requisições seguidas. espere um pouco e tente de novo." });
    }
    next();
  };
}

const resumo = (valor: string) => createHash("sha256").update(valor).digest();

/**
 * API key no cabeçalho X-API-Key, para as rotas de integração.
 * As chaves vêm do ambiente (API_KEYS, separadas por vírgula) e são comparadas em tempo
 * constante. Sem nenhuma chave configurada, as rotas ficam desligadas (503).
 */
export function exigirApiKey(chaves: string[]) {
  const validas = chaves.map(resumo);
  return (req: Request, res: Response, next: NextFunction) => {
    if (validas.length === 0) {
      return res.status(503).json({ erro: "integração desativada: defina API_KEYS no ambiente." });
    }
    const enviada = req.get("x-api-key");
    const ok = !!enviada && validas.some((v) => timingSafeEqual(v, resumo(enviada)));
    if (!ok) return res.status(401).json({ erro: "API key ausente ou inválida." });
    next();
  };
}

/** Origens do frontend: CORS_ORIGENS; em desenvolvimento, o Next local por padrão. */
export function lerOrigens(env: NodeJS.ProcessEnv) {
  const origens = lerLista(env.CORS_ORIGENS);
  if (origens.length) return origens;
  if (env.NODE_ENV === "production") throw new Error("CORS_ORIGENS é obrigatório em produção (ex.: https://desapego.onrender.com).");
  return ["http://localhost:3000"];
}

/** "2" vira número de saltos; o resto (ex.: "loopback, uniquelocal") vai como lista para o Express. */
export const lerTrustProxy = (v?: string) => (!v ? "loopback" : /^\d+$/.test(v.trim()) ? Number(v) : v);

/** Carrega o .env da raiz do repositório, se existir (na hospedagem, as variáveis vêm do painel). */
export function carregarEnv(arquivo: string) {
  try {
    process.loadEnvFile(arquivo);
  } catch {
    // sem .env: segue com as variáveis do ambiente
  }
}
