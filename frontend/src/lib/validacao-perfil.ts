import { validarCampo, type DadosConta } from "./validacao-conta";

/**
 * Validação dos formulários da área da conta (editar perfil e trocar senha). Reaproveita as
 * regras do cadastro (validacao-conta.ts) para nome, e-mail e força da senha. O backend valida
 * de novo: aqui é só para dar retorno rápido.
 */
export interface DadosPerfil {
  nome: string;
  email: string;
  senhaAtual: string;
}

export interface DadosSenha {
  senhaAtual: string;
  novaSenha: string;
  confirmarSenha: string;
}

export type Erros<T> = Partial<Record<keyof T, string>>;

const comoCadastro = (dados: Partial<DadosConta>): DadosConta => ({ nome: "", email: "", senha: "", confirmarSenha: "", ...dados });

export const mesmoEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** `emailAtual`: se o e-mail mudar, a senha atual passa a ser obrigatória. */
export function validarPerfil(dados: DadosPerfil, emailAtual: string): Erros<DadosPerfil> {
  const conta = comoCadastro({ nome: dados.nome, email: dados.email });
  const erros: Erros<DadosPerfil> = {
    nome: validarCampo("nome", conta, "cadastro"),
    email: validarCampo("email", conta, "cadastro"),
    senhaAtual: !mesmoEmail(dados.email, emailAtual) && !dados.senhaAtual ? "para trocar o e-mail, confirme sua senha atual." : undefined,
  };
  return limpar(erros);
}

export function validarTrocaSenha(dados: DadosSenha): Erros<DadosSenha> {
  const conta = comoCadastro({ senha: dados.novaSenha, confirmarSenha: dados.confirmarSenha });
  const erros: Erros<DadosSenha> = {
    senhaAtual: dados.senhaAtual ? undefined : "informe sua senha atual.",
    novaSenha:
      validarCampo("senha", conta, "cadastro") ??
      (dados.novaSenha === dados.senhaAtual ? "a nova senha precisa ser diferente da atual." : undefined),
    confirmarSenha: validarCampo("confirmarSenha", conta, "cadastro"),
  };
  return limpar(erros);
}

function limpar<T>(erros: Erros<T>): Erros<T> {
  return Object.fromEntries(Object.entries(erros).filter(([, v]) => v)) as Erros<T>;
}
