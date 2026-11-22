"use client";

import { ApiErro } from "@/lib/api/cliente";
import { renovarSessao } from "@/lib/api/contas";
import { useSessao } from "@/lib/sessao";

/** A pessoa precisa entrar na conta (a sacola e a compra exigem login). */
export class SemLogin extends Error {
  constructor(mensagem = "entre na sua conta para colocar peças na sacola e comprar.") {
    super(mensagem);
  }
}

async function renovar() {
  try {
    const nova = await renovarSessao();
    useSessao.getState().definir(nova);
    return nova;
  } catch {
    useSessao.getState().definir(null);
    throw new SemLogin();
  }
}

/**
 * Executa uma chamada ao catálogo com o token da sessão. Sem sessão na memória, tenta
 * recuperá-la pelo cookie httpOnly; se o token de acesso (15 min) tiver vencido (401),
 * renova uma vez e repete. Sem conta logada, lança SemLogin.
 */
export async function comLogin<T>(operacao: (token: string) => Promise<T>): Promise<T> {
  const sessao = useSessao.getState().sessao ?? (await renovar());
  try {
    return await operacao(sessao.accessToken);
  } catch (erro) {
    if (!(erro instanceof ApiErro && erro.status === 401)) throw erro;
    return operacao((await renovar()).accessToken);
  }
}
