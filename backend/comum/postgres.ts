import pg from "pg";

/**
 * Conexão com o PostgreSQL usada pelos serviços (contas e pedidos).
 * - Com URL (ex.: Supabase): Postgres de verdade, com SSL fora do localhost.
 * - Sem URL (testes e `npm run dev` sem configurar nada): pg-mem, um Postgres em memória.
 */
export interface Consultavel {
  query<R extends pg.QueryResultRow>(sql: string, valores?: unknown[]): Promise<pg.QueryResult<R>>;
  end(): Promise<void>;
}

/** Tira o `sslmode` da URL: o SSL é configurado aqui (o Supabase usa um certificado próprio). */
function semSslmode(url: string) {
  const u = new URL(url);
  u.searchParams.delete("sslmode");
  return u.toString();
}

export async function conectar(url?: string): Promise<{ db: Consultavel; memoria: boolean }> {
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

/** Nome de schema seguro para montar o SQL (só letras minúsculas, números e _). */
export function validarSchema(schema: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`schema inválido: ${schema}`);
  return schema;
}

/** Datas do Postgres (Date) viram texto ISO nas respostas. */
export const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string | null));
