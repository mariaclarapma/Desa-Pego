# Prisma: Modelagem, Queries e Transações

Referência prática e didática sobre ORMs, modelagem em `schema.prisma` e uso seguro do Prisma Client.

---

## 1. O que é um ORM e seus trade-offs

Um **ORM** (*Object-Relational Mapping*) mapeia tabelas relacionais para objetos/tipos da linguagem (no Prisma, gerando um cliente TypeScript totalmente tipado a partir do `schema.prisma`).

| Abordagem | Pontos fortes | Cuidados |
| --- | --- | --- |
| **ORM (Prisma)** | Produtividade, tipagem forte de queries e relações, migrations integradas | Pode esconder N+1, gerar SQL subótimo em relatórios complexos ou exigir SQL bruto para casos específicos |
| **Query Builder (Knex / Kysely)** | Controle próximo do SQL com tipagem | Menos abstração de relações; migrations separadas |
| **SQL puro (`pg`)** | Controle total de índices, locks, CTEs e planos de execução | Mais verboso; exige validação manual de tipos na borda |

**Regra prática:** use o Prisma para CRUD, relações e tipagem do dia a dia, e recorra a `$queryRaw` / `$executeRaw` (sempre com *tagged template* parametrizado!) quando precisar de `UPDATE ... RETURNING`, *full-text search* específico do PostgreSQL ou agregações complexas.

---

## 2. Boas práticas no `schema.prisma`

### Padrão de nomenclatura de tabelas (`tbl_<num>_<nome>`)
- **Formato:** `tbl_<3_digitos>_<nome_snake_case_plural>`
  - Exemplos: `tbl_001_usuarios`, `tbl_002_vendedoras`, `tbl_003_anuncios`, `tbl_004_pedidos`.
- **Regras:**
  1. Numeração sequencial com 3 dígitos (`001`, `002`, ..., `010`) para manter ordenação previsível no banco.
  2. No Prisma, o `model` continua em `PascalCase` singular para ergonomia no código (`Usuario`, `Anuncio`) e mapeia para o nome físico com `@@map("tbl_001_usuarios")`.
  3. Índices e chaves podem referenciar o nome físico para rastreabilidade (`idx_tbl_003_anuncios_status`, `fk_tbl_003_anuncios_vendedora`).
  4. **Nunca renumere** uma tabela que já foi para migration/produção — novas tabelas sempre usam o próximo número livre.

```prisma
model Usuario {
  id        String   @id @default(uuid())
  nome      String   @db.VarChar(120)
  email     String   @unique
  criadoEm  DateTime @default(now()) @map("criado_em")

  anuncios  Anuncio[]

  @@map("tbl_001_usuarios")
}

model Anuncio {
  id            String     @id @default(uuid())
  vendedoraId   String     @map("vendedora_id")
  titulo        String     @db.VarChar(100)
  precoCentavos Int        @map("preco_centavos")
  status        StatusPeca @default(DISPONIVEL)
  pausada       Boolean    @default(false)
  criadoEm      DateTime   @default(now()) @map("criado_em")

  vendedora Usuario @relation(fields: [vendedoraId], references: [id], onDelete: Restrict)

  @@index([status, pausada, criadoEm])
  @@index([vendedoraId])
  @@map("tbl_002_anuncios")
}
```

### Detalhes importantes
- **Convenção banco vs código:** use `camelCase` nos campos TypeScript e `snake_case` no PostgreSQL com `@map`, além de `@@map("tbl_NNN_nome")` nas tabelas.
- **Dinheiro:** `Int` (até ~R$ 21 milhões em centavos) ou `BigInt`; evite `Float` (erros binários) e use `Decimal` apenas se o domínio exigir frações menores que 1 centavo.
- **`onDelete` explícito:**
  - `Restrict`: impede apagar uma vendedora que já tem anúncios ou pedidos (preserva auditoria/livro-razão).
  - `Cascade`: útil para itens descartáveis acoplados (ex.: tokens de sessão quando a conta é excluída).
  - `SetNull`: preserva o registro filho desvinculando a referência (ex.: manter pedido histórico se um cupom opcional sumir).

---

## 3. Prisma Client: Singleton, Seleção e N+1

### Instância única (Singleton)
Em Node/Next.js com *hot reload*, criar `new PrismaClient()` a cada importação abre dezenas de conexões e derruba o PostgreSQL (`too many clients`):
```ts
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### `select` explícito contra vazamento de dados
```ts
// Errado: devolve senhaHash, cpfCripto e campos internos se serializar o objeto
const conta = await prisma.conta.findUnique({ where: { id } });

// Certo: selecione apenas o necessário para aquela resposta
const conta = await prisma.conta.findUnique({
  where: { id },
  select: { id: true, nome: true, email: true, cidade: true },
});
```

### Evitando o problema N+1
- **N+1:** fazer 1 query para listar 50 pedidos e, dentro de um `for`, fazer mais 50 queries para buscar o comprador de cada pedido (total: 51 queries).
- **Solução:** use `select`/`include` aninhado na consulta principal ou busque todos os IDs de uma vez com `where: { id: { in: ids } }`.

---

## 4. Concorrência, atomicidade e erros do Prisma

### Atualização condicional atômica (ex.: reservar peça única)
Não faça `findUnique` + `if (status === "DISPONIVEL")` + `update` sem proteção:
```ts
const resultado = await prisma.anuncio.updateMany({
  where: { id: pecaId, status: "DISPONIVEL", pausada: false },
  data: { status: "RESERVADA", reservadaAte: expiraEm },
});
if (resultado.count === 0) {
  throw new ConflitoError("peça indisponível ou já reservada.");
}
```

### Transações (`$transaction`)
- **Batch transaction:** `await prisma.$transaction([op1, op2])` — executa todas ou nenhuma.
- **Interactive transaction:** `await prisma.$transaction(async (tx) => { ... })` — permite ler, calcular e gravar na mesma transação ACID (use `tx`, nunca `prisma`, dentro do callback; mantenha a transação curta e sem chamadas HTTP externas dentro dela!).

### Códigos de erro úteis (`Prisma.PrismaClientKnownRequestError`)
- `P2002`: violação de restrição `UNIQUE` (ex.: e-mail ou CPF já cadastrado → responda `409 Conflict`).
- `P2025`: registro não encontrado em `update`/`delete` → responda `404 Not Found`.
- `P2003`: violação de chave estrangeira (`FOREIGN KEY`).
