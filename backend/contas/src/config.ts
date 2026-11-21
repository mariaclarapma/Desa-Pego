import { randomBytes } from "node:crypto";
import { lerChaveCripto } from "../../comum/chave-pix.js";
import { lerOrigens, lerTrustProxy } from "../../comum/seguranca.js";

export interface Config {
  porta: number;
  /** URL do PostgreSQL (ex.: Supabase). Sem URL, o banco fica em memória (pg-mem). */
  urlBanco?: string;
  jwtSegredo: Uint8Array;
  acessoMinutos: number;
  refreshDias: number;
  cookieNome: string;
  /** Caminho visto pelo navegador: o frontend repassa /api/auth/* para este serviço. */
  cookiePath: string;
  cookieSeguro: boolean;
  /**
   * Em quais proxies confiar para ler o IP real no X-Forwarded-For (usado no limite de tentativas).
   * Local: só o Next.js (loopback). No Render: o Next.js e o balanceador da rede interna.
   */
  trustProxy: string | number;
  /** Origens do frontend liberadas no CORS (CORS_ORIGENS). Nunca "*". */
  origens: string[];
  /** Cadastros por hora por IP (padrão 10). Os testes E2E, que cadastram muitas contas do mesmo IP, aumentam. */
  cadastrosPorHora?: number;
  /**
   * Chave de 32 bytes que cifra as chaves Pix no banco (PIX_CRIPTO_CHAVE). Sem ela, o app usa
   * uma chave temporária (só para testes e banco em memória). Veja docs/CHAVE-PIX.md.
   */
  pixCriptoChave?: Buffer;
}

export function lerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const producao = env.NODE_ENV === "production";
  let segredo = env.JWT_SECRET;
  if (!segredo || segredo.length < 32) {
    if (producao) throw new Error("JWT_SECRET precisa ter pelo menos 32 caracteres em produção.");
    // em desenvolvimento, gera um segredo a cada início (as sessões caem ao reiniciar)
    segredo = randomBytes(48).toString("base64url");
    console.warn("[contas] JWT_SECRET não definido: usando um segredo temporário de desenvolvimento.");
  }
  const urlBanco = env.DATABASE_URL || undefined;
  if (producao && !urlBanco) throw new Error("DATABASE_URL é obrigatório em produção (senão as contas somem a cada reinício).");
  // Req. 002: perder ou trocar esta chave torna ilegíveis as chaves Pix já salvas.
  // Por isso ela é obrigatória sempre que o banco é persistente, e não só em produção.
  let pixCriptoChave = lerChaveCripto(env.PIX_CRIPTO_CHAVE);
  if (!pixCriptoChave) {
    if (producao || urlBanco) {
      throw new Error("PIX_CRIPTO_CHAVE é obrigatória com DATABASE_URL ou em produção (gere com: openssl rand -base64 32). Veja docs/CHAVE-PIX.md.");
    }
    pixCriptoChave = randomBytes(32);
    console.warn("[contas] PIX_CRIPTO_CHAVE não definida: usando uma chave temporária (banco em memória).");
  }
  return {
    porta: Number(env.PORTA_CONTAS ?? 3002),
    urlBanco,
    jwtSegredo: new TextEncoder().encode(segredo),
    acessoMinutos: 15,
    refreshDias: 30,
    cookieNome: "desapego_refresh",
    cookiePath: env.COOKIE_PATH ?? "/api/auth",
    cookieSeguro: producao,
    trustProxy: lerTrustProxy(env.TRUST_PROXY),
    origens: lerOrigens(env),
    cadastrosPorHora: Number(env.LIMITE_CADASTROS_POR_HORA) || 10,
    pixCriptoChave,
  };
}
