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
| `POST /auth/cadastro` | cria a conta (`nome`, `email`, `senha`) e já abre a sessão · 201, 400, 409, 429 |
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
| **Create** | `POST /auth/cadastro` | nome e sobrenome, e-mail válido e único, senha com 8+ caracteres, letra e número; hash Argon2id |
| **Read** | `GET /auth/me` | rota privada: só devolve a conta dona do token (sem senha nem hash) |
| **Update** | `PATCH /auth/me` | o nome muda sem senha; o e-mail pede a senha atual e não pode ser de outra conta; devolve um token de acesso novo |
| **Update** | `PUT /auth/me/senha` | confere a senha atual; a nova precisa ser forte e diferente da atual; revoga todas as sessões e abre uma nova neste aparelho |
| **Delete** | `DELETE /auth/me` | reautenticação com a senha; exclusão definitiva (as sessões caem por `ON DELETE CASCADE`); o e-mail fica livre |

Todas as rotas `/auth/me*` usam o middleware `autenticado` (token de acesso de uma conta que ainda existe).
Senha atual errada responde **403** com `{ erro, campos }`; 5 erros seguidos bloqueiam por 15 minutos (**429**).

Testes: `contas/src/app.test.ts` (cadastro, login e sessão) e `contas/src/crud.test.ts` (as quatro operações).

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
- Ainda não tem CPF, recuperação de senha, login com Google nem 2FA (previstos na arquitetura).
- O token de acesso é um JWT sem estado: depois de trocar a senha, um token de acesso já emitido para outro
  aparelho continua válido até vencer (no máximo 15 minutos), mas a sessão desse aparelho não renova.
  Depois de excluir a conta, nenhum token funciona mais (a conta não existe).

## API do catálogo (`catalogo/`)

Express + TypeScript, no lugar do json-server (que aceitava PUT/PATCH/DELETE de qualquer pessoa). Expõe só o que
o site usa, e as regras ficam no servidor.

| Método e rota | Uso |
| --- | --- |
| `GET /pecas`, `GET /pecas/:id` | vitrine e página da peça (reserva vencida volta como disponível) |
| `POST /pecas/:id/reservar` | reserva por 15 min · 200, 404, 409 se outra pessoa reservou antes |
| `POST /pecas/:id/liberar` | desfaz a reserva (peça vendida continua vendida) |
| `POST /pedidos` | cria o pedido com `{ comprador, endereco, itens: [ids] }`; preço, frete e total vêm do catálogo · 201, 400, 409 |
| `GET /pedidos/:id` | consulta o pedido |
| `POST /integracao/pagamentos/:id/confirmar` | **X-API-Key** · webhook do Pix: pago + peças vendidas (idempotente) · 200, 401, 404, 503 |
| `GET /integracao/pedidos?status=` | **X-API-Key** · exporta os pedidos · 200, 400, 401, 503 |

As alterações passam por uma **fila** (uma de cada vez), então duas reservas da mesma peça ao mesmo tempo não passam
juntas, que é o papel do `UPDATE ... WHERE status = 'disponivel'` atômico do banco real (ADR-003). Tem Helmet, CORS
por lista (`CORS_ORIGENS`), limite por IP (300 leituras e 30 escritas por minuto) e validação com Zod. Os testes
ficam em `catalogo/src/app.test.ts`.

## Segurança comum (`comum/`)

`seguranca.ts`: CORS por lista de origens (nunca `*`; origem de fora recebe 403), limite de requisições por IP e
API key no cabeçalho `X-API-Key` (chaves em `API_KEYS`, comparadas em tempo constante). Os dois serviços usam esse
módulo. Testes em `comum/seguranca.test.ts`.
