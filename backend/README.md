# backend — desaPego

Dois serviços de desenvolvimento, que sobem juntos com `npm run dev` (na raiz do repositório ou aqui):

| Serviço | Porta | O que faz |
| --- | --- | --- |
| **catálogo** (json-server) | 3001 | API REST simulada de peças e pedidos, a partir de `db.seed.json` |
| **contas** (Express + SQLite) | 3002 | cadastro, login e sessão de verdade (Módulo 01, Req. 001) |

O frontend acessa os dois pela mesma origem: `/api/auth/*` vai para contas e `/api/*` para o catálogo
(ver `frontend/next.config.ts`). No sistema final, os dois viram módulos do backend NestJS com PostgreSQL
([arquitetura](../docs/ARQUITETURA.md)).

```bash
npm run dev            # sobe catálogo e contas
npm test               # testes do serviço de contas (Vitest + Supertest)
npm run typecheck      # checagem de tipos do serviço de contas
npm run reset-db       # volta o catálogo ao estado inicial (com o servidor parado)
npm run reset-contas   # apaga todas as contas e sessões (com o servidor parado)
```

Requer **Node.js 22.13 ou mais novo** (o banco de contas usa o SQLite nativo do Node).

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
- **Segredos**: `JWT_SECRET` vem do ambiente (veja `.env.example`); em produção, sem ele o serviço não sobe.
- O banco (`contas/dados/contas.sqlite`) fica **fora do Git**.

### Limitações desta versão de desenvolvimento

- SQLite no lugar do PostgreSQL, e limite de tentativas em memória no lugar do Redis (vale para uma instância).
- Ainda não tem CPF, recuperação de senha, login com Google nem 2FA (previstos na arquitetura).
- O token de acesso é um JWT sem estado: depois de trocar a senha, um token de acesso já emitido para outro
  aparelho continua válido até vencer (no máximo 15 minutos), mas a sessão desse aparelho não renova.
  Depois de excluir a conta, nenhum token funciona mais (a conta não existe).

## Catálogo (json-server)

| Método e rota | Uso |
| --- | --- |
| `GET /pecas`, `GET /pecas/:id` | vitrine, página da peça e conferência da reserva |
| `PATCH /pecas/:id` | reservar, liberar ou marcar como vendida |
| `POST /pedidos`, `GET /pedidos/:id`, `PATCH /pedidos/:id` | pedido com Pix simulado |

O json-server não tem transações: a reserva aqui é didática. No backend real ela é um
`UPDATE ... WHERE status = 'disponivel'` atômico (ADR-003).
