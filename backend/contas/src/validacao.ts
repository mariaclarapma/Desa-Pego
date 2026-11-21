import { z } from "zod";

// Mesmas regras do formulário (frontend/src/lib/validacao-conta.ts): o backend valida de novo,
// porque o frontend nunca é a barreira de segurança.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "e-mail muito longo.")
  .pipe(z.email("confira o e-mail: ele precisa ter o formato nome@exemplo.com."));

const nome = z
  .string()
  .trim()
  .max(120, "nome muito longo.")
  .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, "informe nome e sobrenome.")
  .refine((v) => /^[\p{L}' .-]+$/u.test(v), "use só letras no nome.");

const senhaNova = z
  .string()
  .min(8, "a senha precisa ter pelo menos 8 caracteres.")
  .max(128, "a senha pode ter no máximo 128 caracteres.")
  .refine((v) => /\p{L}/u.test(v) && /\d/.test(v), "a senha precisa ter pelo menos uma letra e um número.");

const senhaAtual = z.string({ error: "informe sua senha atual." }).min(1, "informe sua senha atual.").max(128);

export const esquemaCadastro = z.object({ nome, email, senha: senhaNova });

export const esquemaLogin = z.object({
  email,
  senha: z.string().min(1, "informe sua senha.").max(128),
});

/** Editar perfil: nome e e-mail. Trocar o e-mail pede a senha atual (conferida na rota). */
export const esquemaPerfil = z.object({ nome, email, senhaAtual: senhaAtual.optional() });

export const esquemaSenha = z
  .object({ senhaAtual, novaSenha: senhaNova })
  .refine((d) => d.senhaAtual !== d.novaSenha, { path: ["novaSenha"], message: "a nova senha precisa ser diferente da atual." });

/** Excluir conta: reautenticação com a senha. */
export const esquemaExclusao = z.object({ senha: senhaAtual });

/** Erros do Zod no formato { campo: mensagem } que o frontend entende. */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const problema of erro.issues) {
    const campo = String(problema.path[0] ?? "geral");
    campos[campo] ??= problema.message;
  }
  return campos;
}
