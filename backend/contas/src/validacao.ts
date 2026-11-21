import { z } from "zod";
import { TIPOS_CHAVE_PIX, validarChavePix } from "../../comum/chave-pix.js";

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

/* ------------------------------------------------------------------------------------------------
 * Perfil de vendedora e chave Pix (Req. 002). Mesmas regras de frontend/src/lib/validacao-vendedora.ts.
 * ---------------------------------------------------------------------------------------------- */

/**
 * Pode esconder um CPF: 11 números ou mais no texto, juntos ou separados por qualquer coisa
 * ("529 982 247 25", "529-982-247.25", "5a2a9…"). Nada disso pode ir para o perfil público.
 */
const PODE_TER_CPF = (v: string) => v.replace(/\D/g, "").length >= 11;

/** Nome público: opcional (vazio = usa o primeiro nome). Letras, números e pontuação simples. */
const nomePublico = z
  .string()
  .trim()
  .max(40, "o nome público pode ter até 40 caracteres.")
  .refine((v) => v === "" || v.length >= 2, "o nome público precisa ter pelo menos 2 caracteres.")
  .refine((v) => /^[\p{L}\d' .&_-]*$/u.test(v), "use só letras, números, espaço e . - _ & no nome público.")
  .refine((v) => !PODE_TER_CPF(v), "o nome público não pode ter CPF, documento ou sequência longa de números.")
  .transform((v) => v.replace(/\s+/g, " ") || null);

const cidade = z
  .string({ error: "informe sua cidade." })
  .trim()
  .min(2, "informe sua cidade.")
  .max(60, "nome de cidade muito longo.")
  .refine((v) => /^[\p{L}' .-]+(\s*[/-]\s*[A-Za-z]{2})?$/u.test(v), "use só letras na cidade (ex.: Brasília/DF).")
  .transform((v) => v.replace(/\s+/g, " "));

/** Nome público vazio, null ou ausente vira null (a vitrine usa o primeiro nome). */
export const esquemaVendedora = z
  .object({ nomePublico: nomePublico.nullish(), cidade })
  .transform((d) => ({ nomePublico: d.nomePublico ?? null, cidade: d.cidade }));

/** Cadastrar ou trocar a chave Pix: tipo, chave validada conforme o tipo e a senha atual. */
export const esquemaChavePix = z
  .object({
    tipo: z.enum(TIPOS_CHAVE_PIX, { error: "escolha o tipo da chave: CPF, e-mail, telefone ou aleatória." }),
    chave: z.string({ error: "informe a chave Pix." }).max(120, "chave Pix muito longa."),
    senhaAtual,
  })
  .transform((d, ctx) => {
    const r = validarChavePix(d.tipo, d.chave);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", path: ["chave"], message: r.erro });
      return z.NEVER;
    }
    return { ...d, chave: r.chave };
  });

/** Erros do Zod no formato { campo: mensagem } que o frontend entende. */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const problema of erro.issues) {
    const campo = String(problema.path[0] ?? "geral");
    campos[campo] ??= problema.message;
  }
  return campos;
}
