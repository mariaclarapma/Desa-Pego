import { randomUUID } from "node:crypto";
import type { Banco } from "./banco.js";
import { gerarHashSenha } from "./senhas.js";
import { esquemaCadastro } from "./validacao.js";

/**
 * Seed da administradora master (Ludy). E-mail e senha vêm SÓ do ambiente
 * (ADMIN_MASTER_EMAIL e ADMIN_MASTER_PASSWORD); nada fica no código.
 *
 * - Sem conta com esse e-mail: cria, já como ADMIN_MASTER.
 * - Conta já existe: promove a ADMIN_MASTER (a senha atual dela não muda).
 * - Só pode existir uma: se outra conta já for a master, a seed recusa.
 * Roda a cada início do serviço e não faz nada se já estiver tudo certo.
 */
export async function garantirAdminMaster(banco: Banco, env: NodeJS.ProcessEnv): Promise<"criada" | "promovida" | "ok" | "sem-config"> {
  const email = env.ADMIN_MASTER_EMAIL?.trim().toLowerCase();
  const senha = env.ADMIN_MASTER_PASSWORD;
  if (!email || !senha) return "sem-config";

  // mesmas regras do cadastro: e-mail válido e senha forte
  const dados = esquemaCadastro.safeParse({ nome: env.ADMIN_MASTER_NOME ?? "Ludy Administração", email, senha });
  if (!dados.success) {
    throw new Error(`ADMIN_MASTER_EMAIL ou ADMIN_MASTER_PASSWORD inválidos: ${dados.error.issues.map((i) => i.message).join(" ")}`);
  }

  const atual = await banco.adminMaster();
  if (atual && atual.email !== email) {
    throw new Error("já existe uma administradora master com outro e-mail: só pode existir uma.");
  }
  if (atual) return "ok";

  const existente = await banco.usuarioPorEmail(email);
  if (existente) {
    await banco.tornarAdminMaster(existente.id);
    return "promovida";
  }
  await banco.criarUsuario({
    id: randomUUID(),
    nome: dados.data.nome,
    email,
    senha_hash: await gerarHashSenha(senha),
    perfil: "ADMIN_MASTER",
  });
  return "criada";
}
