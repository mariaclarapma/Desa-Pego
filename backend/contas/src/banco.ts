import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Banco do serviço de contas. Em desenvolvimento é SQLite (nativo do Node, sem instalar nada);
 * no sistema final será o PostgreSQL. O SQL é o mesmo nos dois para estas tabelas.
 */
export interface UsuarioRegistro {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
  perfil: "USUARIO" | "ADMIN";
  criado_em: string;
}

export interface SessaoRegistro {
  id: string;
  usuario_id: string;
  token_hash: string;
  expira_em: string;
  revogada_em: string | null;
}

export type Banco = ReturnType<typeof abrirBanco>;

export function abrirBanco(arquivo: string) {
  if (arquivo !== ":memory:") mkdirSync(dirname(arquivo), { recursive: true });
  const db = new DatabaseSync(arquivo);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'USUARIO' CHECK (perfil IN ('USUARIO', 'ADMIN')),
      criado_em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessoes (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expira_em TEXT NOT NULL,
      revogada_em TEXT,
      criado_em TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessoes_usuario ON sessoes (usuario_id);
  `);

  const agora = () => new Date().toISOString();
  const q = {
    inserirUsuario: db.prepare(
      "INSERT INTO usuarios (id, nome, email, senha_hash, criado_em) VALUES (?, ?, ?, ?, ?)",
    ),
    usuarioPorEmail: db.prepare("SELECT * FROM usuarios WHERE email = ?"),
    usuarioPorId: db.prepare("SELECT * FROM usuarios WHERE id = ?"),
    inserirSessao: db.prepare(
      "INSERT INTO sessoes (id, usuario_id, token_hash, expira_em, criado_em) VALUES (?, ?, ?, ?, ?)",
    ),
    sessaoPorHash: db.prepare("SELECT * FROM sessoes WHERE token_hash = ?"),
    revogarSessao: db.prepare("UPDATE sessoes SET revogada_em = ? WHERE id = ? AND revogada_em IS NULL"),
    revogarDoUsuario: db.prepare("UPDATE sessoes SET revogada_em = ? WHERE usuario_id = ? AND revogada_em IS NULL"),
    atualizarPerfil: db.prepare("UPDATE usuarios SET nome = ?, email = ? WHERE id = ?"),
    atualizarSenha: db.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?"),
    excluirUsuario: db.prepare("DELETE FROM usuarios WHERE id = ?"),
  };

  return {
    /** Lança erro com code "ERR_SQLITE_ERROR" e mensagem UNIQUE se o e-mail já existir. */
    criarUsuario(u: Omit<UsuarioRegistro, "perfil" | "criado_em">) {
      q.inserirUsuario.run(u.id, u.nome, u.email, u.senha_hash, agora());
    },
    usuarioPorEmail: (email: string) => q.usuarioPorEmail.get(email) as UsuarioRegistro | undefined,
    usuarioPorId: (id: string) => q.usuarioPorId.get(id) as UsuarioRegistro | undefined,
    criarSessao(s: Omit<SessaoRegistro, "revogada_em">) {
      q.inserirSessao.run(s.id, s.usuario_id, s.token_hash, s.expira_em, agora());
    },
    sessaoPorHash: (hash: string) => q.sessaoPorHash.get(hash) as SessaoRegistro | undefined,
    revogarSessao: (id: string) => q.revogarSessao.run(agora(), id),
    revogarSessoesDoUsuario: (usuarioId: string) => q.revogarDoUsuario.run(agora(), usuarioId),
    /** Lança erro com mensagem UNIQUE se o novo e-mail já for de outra conta. */
    atualizarPerfil: (id: string, nome: string, email: string) => q.atualizarPerfil.run(nome, email, id),
    atualizarSenha: (id: string, senhaHash: string) => q.atualizarSenha.run(senhaHash, id),
    /** Exclusão definitiva: as sessões da conta caem junto (ON DELETE CASCADE). */
    excluirUsuario: (id: string) => q.excluirUsuario.run(id),
    fechar: () => db.close(),
  };
}
