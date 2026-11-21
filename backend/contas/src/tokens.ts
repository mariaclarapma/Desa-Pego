import { createHash, randomBytes, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

const EMISSOR = "desapego-contas";
const PUBLICO = "desapego";

export interface DadosAcesso {
  sub: string;
  nome: string;
  perfil: string;
  /** Req. 002: a conta tem chave Pix (os outros serviços usam para liberar a publicação de anúncios). */
  temChavePix?: boolean;
}

/** Token de acesso curto (JWT HS256), enviado no corpo da resposta e guardado só na memória do navegador. */
export async function gerarTokenAcesso(dados: DadosAcesso, segredo: Uint8Array, minutos: number) {
  const expiraEm = new Date(Date.now() + minutos * 60_000);
  const token = await new SignJWT({ nome: dados.nome, perfil: dados.perfil, temChavePix: dados.temChavePix === true })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(dados.sub)
    .setIssuer(EMISSOR)
    .setAudience(PUBLICO)
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(expiraEm)
    .sign(segredo);
  return { token, expiraEm: expiraEm.toISOString() };
}

export async function lerTokenAcesso(token: string, segredo: Uint8Array): Promise<DadosAcesso | null> {
  try {
    const { payload } = await jwtVerify(token, segredo, { issuer: EMISSOR, audience: PUBLICO, algorithms: ["HS256"] });
    return { sub: String(payload.sub), nome: String(payload.nome), perfil: String(payload.perfil), temChavePix: payload.temChavePix === true };
  } catch {
    return null;
  }
}

/** Refresh token: valor aleatório no cookie httpOnly; no banco fica só o hash SHA-256. */
export const gerarTokenRefresh = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
