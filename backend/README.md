# backend — desaPego

Dois serviços de desenvolvimento, que sobem juntos com `npm run dev` (na raiz do repositório ou aqui):

| Serviço | Porta | O que faz |
| --- | --- | --- |
| **catálogo** (Express) | 3001 | peças, reservas e pedidos (dados em `db.json`, criado a partir de `db.seed.json`) e rotas de integração com API key |
| **contas** (Express + PostgreSQL) | 3002 | cadastro, login e sessão de verdade (Módulo 01, Req. 001) |

O frontend acessa os dois pela mesma origem: `/api/auth/*` vai para contas e `/api/*` para o catálogo
(ver `frontend/next.config.ts`). No sistema final, os dois viram módulos do backend NestJS
([arquitetura](../docs/ARQUITETURA.md)).

```bash
npm run dev            # sobe catálogo e contas
npm test               # testes do serviço de contas (Vitest + Supertest)
npm run typecheck      # checagem de tipos do serviço de contas
npm run reset-db       # volta o catálogo ao estado inicial (com o servidor parado)
```

Requer **Node.js 22.13 ou mais novo**.

### Banco das contas (PostgreSQL)

- **Com `DATABASE_URL`** no `.env` da raiz (veja [`.env.example`](../.env.example)): usa esse Postgres, por exemplo o
  Supabase, e as contas ficam salvas. As tabelas são criadas sozinhas na primeira vez.
- **Sem `DATABASE_URL`**: usa o [pg-mem](https://github.com/oguimbal/pg-mem), um Postgres em memória. Não precisa
  instalar nada, mas as contas somem quando o serviço reinicia. Os testes usam o mesmo esquema.
- **Testes contra um Postgres real**: defina `TEST_DATABASE_URL` (a CI faz isso). Cada arquivo de teste usa um
  schema próprio, apagado no fim.

As tabelas `usuarios` e `sessoes` ficam no schema **`contas`**, e não no `public`: no Supabase, o `public` é
publicado pela API REST automática, e hashes de senha nunca podem sair por ali. O RLS fica ligado nas duas tabelas
como defesa extra.

## Serviço de contas (`contas/`)

| Método e rota | O que faz |
| --- | --- |
| `POST /auth/cadastro` | cria a conta (`nome`, `email`, `cpf`, `senha`) e já abre a sessão · 201, 400, 409, 429 |
| `POST /auth/login` | entra com `email` e `senha` · 200, 400, 401, 429 |
| `POST /auth/refresh` | troca o refresh token do cookie por um novo e devolve um novo token de acesso · 200, 401 |
| `POST /auth/logout` | encerra a sessão e apaga o cookie · 204 |
| `GET /auth/me` | dados do usuário do token `Authorization: Bearer …` · 200, 401 |
| `PATCH /auth/me` | edita `nome` e `email`; trocar o e-mail exige `senhaAtual` · 200, 400, 401, 403, 409, 429 |
| `PUT /auth/me/senha` | troca a senha (`senhaAtual`, `novaSenha`); derruba as outras sessões · 200, 400, 401, 403, 429 |
| `DELETE /auth/me` | exclui a conta de vez com a `senha`; encerra todas as sessões e apaga o cookie · 204, 400, 401, 403, 429 |

Login, cadastro, refresh, `PATCH /auth/me` e `PUT /auth/me/senha` respondem
`{ usuario: { id, nome, email }, accessToken, expiraEm }`.

### CRUD de usuários

| Operação | Rota | Regras |
| --- | --- | --- |
| **Create** | `POST /auth/cadastro` | nome e sobrenome, e-mail válido e único, CPF válido e único, senha com 8+ caracteres, letra e número; hash Argon2id |
| **Read** | `GET /auth/me` | rota privada: só devolve a conta dona do token (sem senha nem hash) |
| **Update** | `PATCH /auth/me` | o nome muda sem senha; o e-mail pede a senha atual e não pode ser de outra conta; devolve um token de acesso novo |
| **Update** | `PUT /auth/me/senha` | confere a senha atual; a nova precisa ser forte e diferente da atual; revoga todas as sessões e abre uma nova neste aparelho |
| **Delete** | `DELETE /auth/me` | reautenticação com a senha; exclusão definitiva (as sessões caem por `ON DELETE CASCADE`); o e-mail fica livre |

Todas as rotas `/auth/me*` usam o middleware `autenticado` (token de acesso de uma conta que ainda existe).
Senha atual errada responde **403** com `{ erro, campos }`; 5 erros seguidos bloqueiam por 15 minutos (**429**).

Testes: `contas/src/app.test.ts` (cadastro, login e sessão), `contas/src/crud.test.ts` (as quatro operações) e `contas/src/cpf.test.ts` (CPF: validação, duplicidade, corrida e vazamento).

### Segurança (documento de arquitetura, §6)

- **Senhas** com hash **Argon2id** (parâmetros mínimos da OWASP). A senha e o hash nunca saem do serviço.
- **Token de acesso**: JWT HS256 de **15 minutos**, guardado só na memória do navegador.
- **Refresh token**: valor aleatório num **cookie httpOnly, SameSite=Strict** (Secure em produção), válido por
  30 dias. No banco fica só o hash SHA-256. Cada refresh token vale **uma vez** (rotação); se um token já usado
  aparecer de novo, todas as sessões da conta caem (sinal de roubo).
- **Mensagem genérica** para credenciais inválidas, com o mesmo tempo de resposta exista ou não o e-mail.
- **Bloqueio** por 15 minutos depois de 5 tentativas erradas (por e-mail e por IP); cadastro limitado a 10 por hora por IP.
- **Validação** com Zod no backend (o frontend nunca é a barreira); e-mail único sem diferenciar maiúsculas
  (restrição `UNIQUE` no banco); cabeçalhos de segurança com Helmet; corpo limitado a 10 KB.
- **Segredos**: `JWT_SECRET` vem do ambiente (veja o [`.env.example`](../.env.example) da raiz); em produção, sem ele o serviço não sobe.
- A URL do banco e o `JWT_SECRET` ficam só no `.env` ou no painel da hospedagem, **nunca no Git**.

### Limitações desta versão de desenvolvimento

- Limite de tentativas em memória no lugar do Redis (vale para uma instância só).
- **CPF** (Req. 001): validado pelos dígitos verificadores e nunca guardado em texto puro. A coluna
  `cpf_hash` (HMAC-SHA256 com `CPF_HASH_CHAVE`) tem índice `UNIQUE`, então o próprio banco recusa CPF
  repetido, mesmo com dois cadastros ao mesmo tempo. A coluna `cpf_cifrado` (AES-256-GCM com
  `CPF_CRIPTO_CHAVE`, id da conta como AAD) guarda o CPF. Nenhuma resposta, token ou log inclui o CPF.
  As duas chaves são obrigatórias com `DATABASE_URL` e **não podem ser trocadas** depois que houver
  contas: os CPFs ficariam ilegíveis e a unicidade deixaria de funcionar (troca exige migração).
  Geração, backup e recuperação das chaves: [docs/CPF.md](../docs/CPF.md).
  Contas antigas e a administradora master ficam com CPF nulo.
- Ainda não tem recuperação de senha, login com Google nem 2FA (previstos na arquitetura).
- O token de acesso é um JWT sem estado: depois de trocar a senha, um token de acesso já emitido para outro
  aparelho continua válido até vencer (no máximo 15 minutos), mas a sessão desse aparelho não renova.
  Depois de excluir a conta, nenhum token funciona mais (a conta não existe).

## API do catálogo (`catalogo/`)

Express + TypeScript, no lugar do json-server (que aceitava PUT/PATCH/DELETE de qualquer pessoa). Expõe só o que
o site usa, e as regras ficam no servidor.

| Método e rota | Uso |
| --- | --- |
| `GET /pecas`, `GET /pecas/:id` | vitrine e página da peça (reserva vencida volta como disponível) |
| `POST /pecas/:id/reservar` | **login** · reserva por 15 min no nome de quem reservou · 200, 401, 403 (peça da própria vendedora), 404, 409 |
| `POST /pecas/:id/liberar` | **login** · desfaz a reserva; só quem reservou (peça vendida continua vendida) · 200, 401, 403, 409 (peça num pedido aguardando Pix) |
| `POST /pedidos` | **login** · checkout com `{ comprador, endereco, itens: [ids] }`; preço, frete e total vêm do catálogo. O `CompraFacade` cria um pedido por vendedora no Módulo 05 · 201, 400, 401, 403, 409, 502, 503 |
| `GET /pedidos/:id` | **login** · só a compradora vê o pedido (para as outras contas, 404) |
| `POST /integracao/pagamentos/:id/confirmar` | **X-API-Key** · webhook do Pix: confirma no Módulo 05, depois pago + peças vendidas (idempotente) · 200, 401, 404, 409 (Pix vencido), 502, 503 |
| `GET /integracao/pedidos?status=` | **X-API-Key** · exporta os pedidos · 200, 400, 401, 503 |

As alterações passam por uma **fila** (uma de cada vez), então duas reservas da mesma peça ao mesmo tempo não passam
juntas, que é o papel do `UPDATE ... WHERE status = 'disponivel'` atômico do banco real (ADR-003). Tem Helmet, CORS
por lista (`CORS_ORIGENS`), limite por IP (300 leituras e 30 escritas por minuto) e validação com Zod. Os testes
ficam em `catalogo/src/app.test.ts`.

**Compra → Módulo 05 (issue #31).** O checkout e o webhook do Pix passam pelo `CompraFacade`
(`catalogo/src/compra-facade.ts`), que coordena o catálogo, o serviço de pedidos (rotas `/interno`, com a primeira
chave de `API_KEYS`, em `PEDIDOS_API_URL`, padrão `http://localhost:3003`) e o Pix simulado:

- cada vendedora da sacola vira um pedido no Módulo 05 e cobra o seu frete fixo; o Pix é um só, com o total;
- o Módulo 05 é avisado **antes** de o catálogo mudar. Se ele falhar, nada muda (502) e dá para repetir;
- a cada minuto, os pedidos com o Pix vencido são cancelados aqui e no Módulo 05, e as peças voltam à vitrine;
- a peça precisa de `vendedoraId` (quem grava é o anúncio, Módulo 02). As peças de exemplo usam contas de
  demonstração (`demo-vendedora-*`). Com um `db.json` antigo, rode `npm run reset-db -w backend`.

O teste de ponta a ponta, com os dois serviços conversando por HTTP, fica em `catalogo/src/integracao-modulo05.test.ts`.

## Segurança comum (`comum/`)

`seguranca.ts`: CORS por lista de origens (nunca `*`; origem de fora recebe 403), limite de requisições por IP e
API key no cabeçalho `X-API-Key` (chaves em `API_KEYS`, comparadas em tempo constante). Os dois serviços usam esse
módulo. Testes em `comum/seguranca.test.ts`.

## Pedidos, carteira e administração (`pedidos/`, Módulo 05)

Express + TypeScript + PostgreSQL (schema `pedidos`, separado do de contas; sem `DATABASE_URL`, usa o pg-mem).
Porta 3003, acessada pelo site em `/api/gestao/*`. Os endpoints estão em [`../docs/openapi.yaml`](../docs/openapi.yaml).

- `estados.ts`: a máquina de estados do pedido e quem pode fazer cada transição.
- `banco.ts`: pedidos com a comissão congelada, livro-razão da carteira (lançamentos só são inseridos), repasses e
  a configuração da comissão. As alterações passam por uma fila: conferir o saldo e debitar acontecem juntos.
- `app.ts`: rotas da usuária (compras, vendas, enviar, confirmar o recebimento, carteira e saque), rotas internas
  com `X-API-Key` (checkout e webhook do Pix) e o painel (`ADMIN_MASTER`).
- Testes: `pedidos.test.ts` (Req. 015). As contas e o checkout são simulados: as usuárias são tokens JWT assinados
  com o segredo de teste, e os pedidos entram pela rota interna.

O serviço de contas ganhou o perfil `ADMIN_MASTER` (seed com `ADMIN_MASTER_EMAIL` e `ADMIN_MASTER_PASSWORD`), o
bloqueio de contas e as rotas `GET /auth/admin/usuarios`, `POST /auth/admin/usuarios/:id/bloquear` e `/desbloquear`.
O catálogo ganhou `GET /admin/pecas`, `POST /admin/pecas/:id/ocultar` e `/reexibir`.
