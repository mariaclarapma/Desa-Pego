import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";

/**
 * Leitura do token de acesso emitido pelo serviço de contas (Módulo 01), para os outros
 * serviços (catálogo e pedidos) saberem quem está chamando. O token é um JWT HS256 de
 * 15 minutos com { sub, nome, perfil }, assinado com o mesmo JWT_SECRET.
 */
export type Perfil = "USUARIO" | "ADMIN" | "ADMIN_MASTER";

export interface Autenticada {
  id: string;
  nome: string;
  perfil: Perfil;
}

export async function lerToken(cabecalho: string | undefined, segredo: Uint8Array): Promise<Autenticada | null> {
  const [tipo, token] = (cabecalho ?? "").split(" ");
  if (tipo !== "Bearer" || !token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo, { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { id: String(payload.sub), nome: String(payload.nome ?? ""), perfil: String(payload.perfil) as Perfil };
  } catch {
    return null;
  }
}

/** Rota privada: exige o token de acesso. Guarda a usuária em res.locals.usuaria. */
export function exigirLogin(segredo: Uint8Array) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const usuaria = await lerToken(req.get("authorization"), segredo);
    if (!usuaria) return res.status(401).json({ erro: "não autenticado." });
    res.locals.usuaria = usuaria;
    next();
  };
}

/** Só a administradora master (Lucy). Use depois de exigirLogin. Quem não é recebe 403. */
export function exigirAdminMaster(req: Request, res: Response, next: NextFunction) {
  if ((res.locals.usuaria as Autenticada | undefined)?.perfil !== "ADMIN_MASTER") {
    return res.status(403).json({ erro: "acesso restrito à administração." });
  }
  next();
}

/** O segredo do JWT como bytes (mesma regra do serviço de contas). */
export function lerSegredoJwt(env: NodeJS.ProcessEnv): Uint8Array {
  const segredo = env.JWT_SECRET ?? "";
  if (segredo.length < 32) {
    if (env.NODE_ENV === "production") throw new Error("JWT_SECRET precisa ter pelo menos 32 caracteres em produção.");
    console.warn("[seguranca] JWT_SECRET ausente ou curto: as rotas com login não vão aceitar tokens do serviço de contas.");
  }
  return new TextEncoder().encode(segredo || "sem-segredo-configurado");
}
