# Catálogo no PostgreSQL do Supabase

Até aqui, o catálogo (`backend/catalogo`) guardava tudo em `backend/db.json`, que o Render grátis apaga a cada
deploy e reinício. Agora, com `DATABASE_URL` (o mesmo banco das contas e dos pedidos), os dados ficam no
PostgreSQL do Supabase e sobrevivem a deploy e reinício. Sem `DATABASE_URL`, como no `npm run dev`, nada muda:
continua o `db.json`.

## O que fica no banco

Schema `catalogo`, fora do `public`, que o Supabase publica pela API REST. É o mesmo cuidado do schema `contas`.

| Tabela | O que guarda | Colunas para consulta | Resto |
| --- | --- | --- | --- |
| `pecas` | peças da semente e anúncios das vendedoras (Req. 004), com reserva, pausa e ocultação | `id`, `vendedora_id`, `status`, `reservada_ate` | objeto inteiro em `dados` (JSONB) |
| `fotos` | envios autorizados e o **vínculo com a peça** | `chave`, `usuaria_id`, `tipo`, `criada_em`, `enviada_em`, `peca_id` (chave estrangeira para `pecas`) | — |
| `pedidos` | pedidos do lado do catálogo (checkout, Pix) | `id`, `compradora_id`, `status` | objeto inteiro em `dados` |
| `configuracao` | regras do painel (frete) | `id = 1` | `dados` |

As tabelas são criadas sozinhas na primeira vez que o catálogo sobe com `DATABASE_URL`, como nas contas. Na
primeira vez, a semente (`db.seed.json`) é copiada, e a linha de `configuracao` marca o catálogo como iniciado.
Depois disso, a semente não é usada de novo, nem se o catálogo for esvaziado.

## Como as regras foram preservadas

- **Mesma `Loja`, mesma fila.** As rotas, o `CompraFacade` e o painel continuam usando `loja.alterarEmFila`. Cada
  alteração roda sozinha e, no fim, grava numa **transação** só as linhas que mudaram.
- **Reserva de 15 minutos continua atômica:** duas pessoas reservando ao mesmo tempo, só uma consegue (o teste
  confere no banco). A reserva vencida volta a contar como disponível (`statusAtual`), também depois de um reinício.
- **Se a alteração for recusada no meio ou a gravação falhar, ela não vale:** a memória volta ao último estado
  gravado e a requisição recebe o erro. Nada fica valendo só na memória.
- **Vitrine e página da peça** leem da memória, que é sempre igual ao banco. Nada de cache entre requisições.
- **Uma instância só.** A fila vale dentro de um processo, como antes com o `db.json`. O Render grátis roda uma
  instância. Para escalar, a reserva teria de virar um `UPDATE ... WHERE status = 'disponivel'` no banco
  (ADR-003), e isso fica para depois do MVP.

## Testes

`backend/catalogo/src/loja-banco.test.ts` roda no pg-mem. Com `TEST_DATABASE_URL` (a CI), roda num Postgres de
verdade, num schema próprio apagado no fim. "Reiniciar o serviço" é abrir a loja de novo no mesmo banco. O que ele
cobre:

- a semente copiada só na primeira vez;
- anúncio, fotos e vínculo (`fotos.peca_id`) depois do reinício, e a vitrine mostrando a peça;
- reserva no nome de quem reservou depois do reinício, vencendo em 15 minutos;
- duas reservas ao mesmo tempo;
- falha do banco ao gravar sem deixar alteração pela metade.

O teste de fumaça da CI (`npm start` em modo produção com o Postgres do GitHub Actions) também sobe o catálogo no
banco.

## O que acontece no primeiro deploy

Com as tabelas vazias, o catálogo copia **só a semente** (`db.seed.json`: as 11 peças de demonstração). Tudo o que
estava no `db.json` da instância que está no ar **fica de fora**:

| O que estava no `db.json` | No primeiro deploy, sem migração |
| --- | --- |
| anúncios publicados pelas vendedoras | somem |
| fotos dos anúncios (arquivos na pasta local) e o registro dos envios | somem; as URLs `/api/fotos/...` quebram |
| vínculos foto → peça | somem com os anúncios |
| reservas em vigor (15 minutos) | a peça volta a ficar disponível |
| peças da semente vendidas | voltam a aparecer como disponíveis na vitrine |
| pedidos do catálogo (checkout, Pix) | somem; os do Módulo 05 (schema `pedidos`) continuam, mas sem o par no catálogo |
| frete definido no painel | volta ao padrão (R$ 19,90) |

No Render grátis isso já acontece a cada deploy hoje, porque o disco é apagado. A diferença é que, depois desta
versão, **é a última vez**. Por isso vale migrar uma vez.

Não dá para copiar o `db.json` do Render: o plano grátis não tem acesso ao disco, e o próprio deploy o apaga. A
migração lê os dados **pela API que está no ar, antes do deploy**, só com GET.

## Migração (precisa de aprovação do grupo)

Código em `backend/catalogo/src/migracao.ts`, comando em `cli-catalogo.ts`, testes em `migracao.test.ts`. Na raiz:

1. **Exportar** da produção, antes do deploy, num momento sem movimento. Precisa de `ADMIN_MASTER_EMAIL`,
   `ADMIN_MASTER_PASSWORD` e `API_KEYS` (a mesma do Render) no `.env` local:

   ```bash
   npm run catalogo -w backend -- exportar --site https://desapego.onrender.com --saida ../exportacao-catalogo
   ```

   Lê `/api/admin/pecas` (peças completas, com dona, reserva e fotos), `/api/integracao/pedidos`,
   `/api/admin/frete` e cada foto em `/api/fotos/:chave`. Grava `catalogo.json` e `fotos/`. A pasta tem **dados
   pessoais** (nome, e-mail e endereço dos pedidos): fica fora do Git (`.gitignore`) e deve ser apagada no fim.

2. **Conferir** o relatório, que não grava nada:

   ```bash
   npm run catalogo -w backend -- migrar --arquivo ../exportacao-catalogo/catalogo.json --fotos ../exportacao-catalogo/fotos
   ```

   Mostra quantas peças são da semente e quantas são anúncios, as reservas em vigor e vencidas, as vendas, os
   pedidos por status, as fotos vinculadas e o frete. Mostra também os **problemas**, que impedem aplicar (foto
   vinculada a uma conta que não é a da vendedora, foto em duas peças, peça com foto sem vendedora), e os
   **avisos** (envios soltos descartados, reservas que continuam até vencer).

3. **Fazer o deploy** desta versão.

4. **Aplicar**, com `DATABASE_URL`, `SUPABASE_URL` e `SUPABASE_SECRET_KEY` de produção no ambiente: o mesmo
   comando com `--aplicar`. Ele:
   - recusa se o catálogo no banco já tiver qualquer coisa além da semente intocada (migração já feita, ou anúncio
     novo), sem alterar nada;
   - confere **todas** as fotos (existe, até 5 MB, primeiros bytes do tipo) antes de copiar qualquer uma;
   - copia as fotos para o bucket `anuncios-fotos` e troca as URLs nas peças;
   - grava peças, registro das fotos (com `peca_id`), pedidos e frete numa transação.

5. Reiniciar o serviço no Render, para ele ler o banco migrado, e conferir: o anúncio aparece com as fotos, a
   vendedora o vê em "meus anúncios" e as peças vendidas não voltam à vitrine.

O que a migração leva e o que não leva:

- **Leva:** anúncios com dona, fotos, vínculos, pausa e ocultação; reservas (a em vigor continua no nome de quem
  reservou até vencer, a vencida volta a ficar disponível); vendas; pedidos do catálogo; frete.
- **Não leva:** envios de foto que não entraram em anúncio (a vendedora envia de novo) e o que acontecer entre a
  exportação e o deploy. Por isso, escolha um momento sem movimento.

**Testado localmente** (`migracao.test.ts`, pg-mem e Storage simulado): a "produção" é o catálogo da `main`
(db.json e fotos locais) servido em `/api`, com um anúncio de duas fotos, um envio abandonado, uma reserva em
vigor, uma vencida, uma venda, um pedido e o frete alterado. O teste confere:

- sem migração, tudo isso some;
- com exportação, conferência e aplicação, tudo volta, com as fotos no bucket público;
- a reserva continua bloqueando outra pessoa;
- a migração não roda duas vezes nem por cima de dados novos;
- uma foto faltando ou falsa para tudo antes de gravar;
- uma inconsistência no `db.json` impede aplicar.

## Ao publicar no Render (precisa de aprovação do grupo)

1. A `DATABASE_URL` já está no Render (contas e pedidos). No primeiro deploy desta versão, o catálogo **cria o
   schema `catalogo` no Supabase** e copia a semente. Para manter o que está no ar, siga a migração acima.
2. Confira no log: `[catalogo] dados: PostgreSQL (schema catalogo); fotos: Supabase Storage.`
3. Publique um anúncio, faça um novo deploy (ou reinicie o serviço) e confira que ele continua lá.

## Limitações

- O catálogo carrega tudo na memória ao iniciar. É adequado para o MVP (centenas de peças), não para milhares.
- `db.json` e `npm run reset-db` continuam só para o desenvolvimento local.
