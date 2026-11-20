import pg from "pg";

/**
 * Banco do serviço de contas: PostgreSQL.
 * - Com `DATABASE_URL` (ex.: Supabase), usa o Postgres de verdade e os dados ficam salvos.
 * - Sem URL (testes e `npm run dev` sem configurar nada), usa o pg-mem, um Postgres em memória:
 *   as contas somem quando o serviço reinicia.
 *
 * As tabelas ficam no schema `contas`, e não no `public`: no Supabase, o `public` é publicado
 * automaticamente pela API REST, e os hashes de senha nunca podem sair por ali.
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

export type Banco = Awaited<ReturnType<typeof abrirBanco>>;

interface Consultavel {
  query<R extends pg.QueryResultRow>(sql: string, valores?: unknown[]): Promise<pg.QueryResult<R>>;
  end(): Promise<void>;
}

/** Erro de e-mail repetido (restrição UNIQUE, código 23505 do Postgres). */
export const emailDuplicado = (erro: unknown) => {
  const e = erro as { code?: string; message?: string };
  return e?.code === "23505" || /duplicate key|unique/i.test(e?.message ?? "");
};

/** Tira o `sslmode` da URL: o SSL é configurado aqui (o Supabase usa um certificado próprio). */
function semSslmode(url: string) {
  const u = new URL(url);
  u.searchParams.delete("sslmode");
  return u.toString();
}

async function conectar(url?: string): Promise<{ db: Consultavel; memoria: boolean }> {
  if (!url) {
    const { newDb } = await import("pg-mem");
    const { Pool } = newDb().adapters.createPg();
    return { db: new Pool() as Consultavel, memoria: true };
  }
  const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);
  const pool = new pg.Pool({
    connectionString: semSslmode(url),
    ssl: local ? undefined : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
  });
  return { db: pool, memoria: false };
}

/**
 * Abre o banco e cria as tabelas se ainda não existirem.
 * `schema` muda só nos testes contra um Postgres real (cada arquivo de teste usa o seu).
 */
export async function abrirBanco(url?: string, schema = "contas") {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`schema inválido: ${schema}`);
  const { db, memoria } = await conectar(url);
  const s = schema;

  await db.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${s}.usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'USUARIO' CHECK (perfil IN ('USUARIO', 'ADMIN')),
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${s}.sessoes (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES ${s}.usuarios(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expira_em TIMESTAMPTZ NOT NULL,
      revogada_em TIMESTAMPTZ,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await db.query(`CREATE INDEX IF NOT EXISTS sessoes_usuario ON ${s}.sessoes (usuario_id)`);
  if (!memoria) {
    // defesa extra no Supabase: com RLS ligado e sem políticas, os papéis da API (anon e
    // authenticated) não leem nada. O dono das tabelas (o serviço) não é afetado.
    await db.query(`ALTER TABLE ${s}.usuarios ENABLE ROW LEVEL SECURITY`);
    await db.query(`ALTER TABLE ${s}.sessoes ENABLE ROW LEVEL SECURITY`);
  }

  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string | null));
  const usuario = (r?: pg.QueryResultRow) => (r ? ({ ...r, criado_em: iso(r.criado_em) } as UsuarioRegistro) : undefined);
  const sessao = (r?: pg.QueryResultRow) =>
    r ? ({ ...r, expira_em: iso(r.expira_em), revogada_em: iso(r.revogada_em) } as SessaoRegistro) : undefined;
  const agora = () => new Date().toISOString();
  const um = async (sql: string, valores: unknown[]) => (await db.query(sql, valores)).rows[0];

  return {
    /** Lança erro 23505 (veja `emailDuplicado`) se o e-mail já existir. */
    async criarUsuario(u: Omit<UsuarioRegistro, "perfil" | "criado_em">) {
      await db.query(`INSERT INTO ${s}.usuarios (id, nome, email, senha_hash, criado_em) VALUES ($1, $2, $3, $4, $5)`, [
        u.id,
        u.nome,
        u.email,
        u.senha_hash,
        agora(),
      ]);
    },
    usuarioPorEmail: async (email: string) => usuario(await um(`SELECT * FROM ${s}.usuarios WHERE email = $1`, [email])),
    usuarioPorId: async (id: string) => usuario(await um(`SELECT * FROM ${s}.usuarios WHERE id = $1`, [id])),
    async criarSessao(x: Omit<SessaoRegistro, "revogada_em">) {
      await db.query(`INSERT INTO ${s}.sessoes (id, usuario_id, token_hash, expira_em, criado_em) VALUES ($1, $2, $3, $4, $5)`, [
        x.id,
        x.usuario_id,
        x.token_hash,
        x.expira_em,
        agora(),
      ]);
    },
    sessaoPorHash: async (hash: string) => sessao(await um(`SELECT * FROM ${s}.sessoes WHERE token_hash = $1`, [hash])),
    async revogarSessao(id: string) {
      await db.query(`UPDATE ${s}.sessoes SET revogada_em = $1 WHERE id = $2 AND revogada_em IS NULL`, [agora(), id]);
    },
    async revogarSessoesDoUsuario(usuarioId: string) {
      await db.query(`UPDATE ${s}.sessoes SET revogada_em = $1 WHERE usuario_id = $2 AND revogada_em IS NULL`, [agora(), usuarioId]);
    },
    /** Lança erro 23505 se o novo e-mail já for de outra conta. */
    async atualizarPerfil(id: string, nome: string, email: string) {
      await db.query(`UPDATE ${s}.usuarios SET nome = $1, email = $2 WHERE id = $3`, [nome, email, id]);
    },
    async atualizarSenha(id: string, senhaHash: string) {
      await db.query(`UPDATE ${s}.usuarios SET senha_hash = $1 WHERE id = $2`, [senhaHash, id]);
    },
    /** Exclusão definitiva: as sessões da conta caem junto (ON DELETE CASCADE). */
    async excluirUsuario(id: string) {
      await db.query(`DELETE FROM ${s}.usuarios WHERE id = $1`, [id]);
    },
    /** Só para os testes: apaga todas as contas e sessões. */
    async limpar() {
      await db.query(`DELETE FROM ${s}.sessoes`);
      await db.query(`DELETE FROM ${s}.usuarios`);
    },
    /** Só para os testes contra um Postgres real: apaga o schema do arquivo de teste. */
    async apagarSchema() {
      if (!memoria) await db.query(`DROP SCHEMA IF EXISTS ${s} CASCADE`);
    },
    fechar: () => db.end(),
  };
}
