# Migrations Seguras com Prisma

Referência prática e didática sobre versionamento de schema, ciclo de migrations e deploy sem tempo de inatividade (*zero-downtime*).

---

## 1. Comandos do Prisma Migrate (e quando usar cada um)

| Comando | Onde usar | O que faz |
| --- | --- | --- |
| `npx prisma migrate dev --name <nome>` | **Desenvolvimento local** | Compara o `schema.prisma` com o histórico usando um *shadow database*, gera o arquivo `.sql` da migration, aplica no banco local e regenera o Prisma Client |
| `npx prisma migrate deploy` | **Produção e CI/CD** | Aplica apenas as migrations pendentes já versionadas no Git, sem criar novas e sem resetar dados |
| `npx prisma migrate status` | **Diagnóstico / CI** | Mostra se há migrations pendentes ou divergências (*drift*) |
| `npx prisma db push` | **Apenas prototipação descartável** | Sincroniza o schema direto no banco **sem gerar histórico de migration**. Pode apagar dados — **nunca use em produção** |
| `npx prisma migrate reset` | **Apenas dev/testes** | Apaga o banco inteiro, reaplica tudo e roda o seed |

---

## 2. Regras de ouro de migrations em equipe

1. **Migrations são imutáveis após irem para a branch principal:**
   - O Prisma grava um checksum SHA-256 de cada arquivo `migration.sql` na tabela `_prisma_migrations`.
   - Se alguém editar uma migration já aplicada em produção/staging, o `migrate deploy` falha por divergência de checksum.
   - Precisa corrigir algo? Crie uma **nova** migration.
2. **Sempre revise o SQL gerado antes de commitar:**
   - Confira se a nova tabela segue o padrão `tbl_<num>_<nome>` (ex.: `tbl_001_usuarios`) e **nunca renumere** tabelas de migrations já aplicadas.
   - O Prisma pode gerar `DROP COLUMN` + `ADD COLUMN` quando você apenas **renomeou** um campo no `schema.prisma` — o que apagaria os dados da coluna!
   - Para renomear preservando dados, use `--create-only` e edite o SQL gerado para `ALTER TABLE ... RENAME COLUMN ...`:
     ```bash
     npx prisma migrate dev --create-only --name renomear_coluna
     ```
3. **Mantenha um script de `seed` idempotente:**
   - Use `upsert` em dados iniciais (admin master, configurações padrão) para que rodar o seed duas vezes não duplique nem falhe.

---

## 3. Padrão *Expand and Contract* (Zero-Downtime Migrations)

Durante um deploy com *rolling update*, a versão antiga e a versão nova da API podem rodar **ao mesmo tempo** contra o mesmo banco. Mudanças bruscas quebram uma das duas versões.

### Caso A: Adicionar coluna obrigatória (`NOT NULL`) em tabela com dados
Se a tabela já tem linhas, `ADD COLUMN x TEXT NOT NULL` sem `DEFAULT` falha no PostgreSQL.

**Faça em 3 passos:**
1. **Expandir:** adicione a coluna como opcional (`String?`) ou com `@default(...)`.
2. **Preencher (*Backfill*):** rode um script/UPDATE em lotes pequenos preenchendo as linhas antigas, e já faça o código novo escrever na coluna nova.
3. **Contrair:** só depois de todas as linhas preenchidas e do código antigo fora do ar, torne a coluna obrigatória (`NOT NULL`).

### Caso B: Renomear ou trocar o tipo de uma coluna sem derrubar o ar
1. **Expandir:** adicione a coluna nova (`nova_coluna`) mantendo a antiga (`antiga_coluna`).
2. **Dupla escrita + backfill:** o código novo escreve nas duas e lê da nova com *fallback* para a antiga; faça *backfill* dos registros antigos.
3. **Contrair:** quando ninguém mais ler/escrever na antiga, remova a antiga em outra migration.

### Caso C: Criar índice em tabela grande no PostgreSQL
- `CREATE INDEX` comum bloqueia escritas (`INSERT`/`UPDATE`/`DELETE`) enquanto constrói o índice.
- Em tabelas grandes em produção, prefira `CREATE INDEX CONCURRENTLY ...` (lembrando que no PostgreSQL ele não pode rodar dentro de um bloco `BEGIN ... COMMIT`).
