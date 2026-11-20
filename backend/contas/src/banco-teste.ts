import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { abrirBanco, type Banco } from "./banco.js";

/**
 * Banco dos testes. Por padrão é o pg-mem (Postgres em memória, sem instalar nada).
 * Com `TEST_DATABASE_URL` (a CI usa o Postgres do GitHub Actions), roda contra um Postgres real,
 * cada arquivo de teste no seu próprio schema, apagado no fim.
 *
 * Devolve uma função que lê o banco atual; cada teste começa com as tabelas vazias.
 */
export function usarBancoDeTeste(): () => Banco {
  let banco: Banco;
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL || undefined;
    banco = await abrirBanco(url, url ? `teste_${randomBytes(6).toString("hex")}` : "contas");
  });
  beforeEach(async () => {
    await banco.limpar();
  });
  afterAll(async () => {
    await banco?.apagarSchema();
    await banco?.fechar();
  });
  return () => banco;
}
