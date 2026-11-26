---
name: orms-migrations-prisma
description: >-
  Guia prático e didático sobre ORMs, modelagem relacional, migrations seguras e
  Prisma ORM. Use esta skill ao modelar schemas Prisma (schema.prisma), criar
  ou revisar migrations (dev/produção), otimizar consultas/transações, evitar
  N+1 e vazamento de dados ou estudar boas práticas de banco com ORM.
---

# ORMs e Migrations: Prisma

Skill para **modelar bancos, escrever consultas seguras e conduzir migrations sem perda de dados** usando **Prisma** e boas práticas de ORM.

## Quando usar

- Ao criar ou alterar `schema.prisma` (models, relações, índices, constraints).
- Ao gerar, revisar ou aplicar migrations (`migrate dev`, `migrate deploy`, *backfill*).
- Ao revisar queries Prisma (N+1, `select` explícito, transações, atomicidade, paginação).
- Ao estudar trade-offs entre ORM, Query Builder e SQL puro, ou estratégias de *zero-downtime migration*.

## Fluxo de trabalho

1. **Avaliar modelo e impacto:** mudanças de schema afetam dados existentes, código em execução durante o deploy e índices de consulta.
2. **Aplicar o checklist abaixo** ao revisar `schema.prisma`, migrations e código de acesso ao banco.
3. **Consultar as referências:**
   - Trade-offs de ORM, `schema.prisma`, queries, N+1, transações e SQL bruto seguro: [Prisma: Modelagem e Queries](./references/prisma-modelagem-queries.md)
   - Ciclo `migrate dev` vs `migrate deploy`, *drift* e padrão *Expand & Contract*: [Migrations Seguras em Produção](./references/migrations-seguras.md)

## Checklist rápido de Prisma e Migrations

### Schema e Modelagem (`schema.prisma`)
- **Padrão obrigatório de nomes de tabelas:** `tbl_<num>_<nome>` com 3 dígitos e `snake_case` no plural (ex.: `tbl_001_usuarios`, `tbl_002_anuncios`), mapeado no Prisma com `@@map("tbl_001_usuarios")`. Nunca renumere tabelas já criadas em migrations aplicadas.
- **Dinheiro em inteiros:** use `Int` (ou `BigInt`) em centavos (`precoCentavos`), nunca `Float`.
- **Chaves e integridade:** defina `@unique` no banco para regras de unicidade (e-mail, CPF hash) — nunca valide unicidade só com `findUnique` antes de `create`.
- **Índices pensados nas queries:** adicione `@@index` em chaves estrangeiras e colunas usadas em `WHERE`/`ORDER BY` frequentes (ex.: `[status, criadoEm]`).
- **Ações referenciais conscientes:** escolha `onDelete: Restrict` (padrão seguro para pedidos/pagamentos) vs `Cascade` (apenas filhos dependentes sem valor histórico próprio).

### Queries e Segurança
- **Nunca exponha o modelo inteiro sem filtro:** use `select` explícito (ou `omit`) para não vazar `senhaHash`, `cpf`, tokens ou chaves em respostas da API.
- **Evite N+1:** carregue relações necessárias com `select`/`include` ou consultas em lote (`in: ids`), nunca `await prisma...` dentro de um `for`/`map`.
- **Singleton do `PrismaClient`:** reutilize uma única instância por processo (especialmente em Next.js dev com hot-reload) para não esgotar o pool de conexões.
- **Concorrência crítica:** para reserva/estoque único ou saldo, use `updateMany` com condição (`where: { id, status: "disponivel" }`) ou `$transaction` com isolamento adequado, e trate erro `P2002` (unique constraint) / `P2025` (not found).

### Migrations
- **`migrate dev` só no desenvolvimento; `migrate deploy` em produção/CI;** nunca use `db push` em banco com dados reais.
- **Nunca edite uma migration já aplicada** em ambiente compartilhado ou produção — crie uma nova migration corretiva.
- **Mudança destrutiva ou `NOT NULL` em tabela populada:** aplique em etapas (*Expand → Backfill → Contract*) para evitar quebra durante o deploy.
