# Pendência: persistência do catálogo no Render

Pendência separada da #4. As fotos dos anúncios já podem ficar no Amazon S3 (`docs/FOTOS.md`), mas os dados do
catálogo, não.

## O problema

O serviço do catálogo (`backend/catalogo`) guarda tudo em `backend/db.json`:

- as peças, inclusive as publicadas pelas vendedoras (Req. 004);
- as reservas da sacola (15 minutos);
- os registros de envio das fotos (`fotos`);
- os pedidos do lado do catálogo.

No Render grátis o disco é **efêmero**: a cada deploy ou reinício o `db.json` volta a ser a semente
(`db.seed.json`). Na prática:

- anúncios publicados somem, e as fotos deles ficam órfãs em `anuncios/` no bucket;
- uma reserva em andamento é perdida no meio do checkout;
- envios de fotos ainda não publicados deixam de existir (a regra de ciclo de vida limpa `temporarias/`).

## Opções

| Opção | Prós | Contras |
| --- | --- | --- |
| Tabelas no PostgreSQL do Supabase (já usado por contas e pedidos) | sem custo novo; transações para a reserva da peça única | trocar a `Loja` (JSON) por um repositório SQL, com migração da semente |
| Disco persistente do Render | quase nenhuma mudança de código | só em plano pago; uma instância só |
| Manter o `db.json` | nada a fazer | inviável em produção |

## Decisão e próximos passos

1. O grupo decide a opção (sugestão: Supabase) e registra num ADR.
2. Abrir uma issue própria, por exemplo "Persistir o catálogo fora do disco do Render", com os critérios:
   - peças, reservas, pedidos do catálogo e registros de fotos sobrevivem a deploy e reinício;
   - a reserva de 15 minutos continua atômica (nenhuma peça vendida duas vezes);
   - os testes atuais do catálogo passam contra o novo armazenamento.
3. Até lá, um anúncio publicado em produção pode sumir no próximo deploy. Isso vale para a demonstração.
