import { randomBytes } from "node:crypto";

export interface Config {
  porta: number;
  /** Arquivo do SQLite, ou ":memory:" nos testes. */
  arquivoBanco: string;
  jwtSegredo: Uint8Array;
  acessoMinutos: number;
  refreshDias: number;
  cookieNome: string;
  /** Caminho visto pelo navegador: o frontend repassa /api/auth/* para este serviço. */
  cookiePath: string;
  cookieSeguro: boolean;
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
  return {
    porta: Number(env.PORTA_CONTAS ?? 3002),
    arquivoBanco: env.ARQUIVO_BANCO_CONTAS ?? "contas/dados/contas.sqlite",
    jwtSegredo: new TextEncoder().encode(segredo),
    acessoMinutos: 15,
    refreshDias: 30,
    cookieNome: "desapego_refresh",
    cookiePath: env.COOKIE_PATH ?? "/api/auth",
    cookieSeguro: producao,
  };
}
