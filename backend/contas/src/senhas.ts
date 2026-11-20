import { hash, verify } from "@node-rs/argon2";

// Argon2id com os parâmetros mínimos recomendados pela OWASP (19 MiB, 2 iterações, 1 via)
const PARAMETROS = { algorithm: 2 /* Argon2id */, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const gerarHashSenha = (senha: string) => hash(senha, PARAMETROS);

let hashFicticio: Promise<string> | undefined;

/**
 * Confere a senha. Sem usuário (e-mail inexistente), confere contra um hash fictício para
 * gastar o mesmo tempo: assim a resposta não revela se o e-mail tem conta.
 */
export async function conferirSenha(senha: string, hashSalvo: string | undefined): Promise<boolean> {
  hashFicticio ??= gerarHashSenha("senha-ficticia-para-igualar-o-tempo");
  const alvo = hashSalvo ?? (await hashFicticio);
  const confere = await verify(alvo, senha).catch(() => false);
  return Boolean(hashSalvo) && confere;
}
