# Chave Pix da vendedora (Req. 002)

Este documento explica como a chave Pix das vendedoras é protegida, como cuidar da `PIX_CRIPTO_CHAVE` e o que as
Issues #004 e #014 precisam fazer para usar a chave.

## 1. Como funciona

| Etapa | Onde | O que acontece |
| --- | --- | --- |
| Validação | `backend/comum/chave-pix.ts` (`validarChavePix`) | CPF com dígitos verificadores, e-mail de até 77 caracteres, celular com DDD (`+55…`) ou chave aleatória (UUID). A chave é normalizada antes de ser guardada. |
| Gravação | `PUT /auth/me/pix` | Pede a **senha atual**. Cinco senhas erradas bloqueiam por 15 minutos, no mesmo limite do login. |
| Armazenamento | tabela `contas.chaves_pix` | Guarda só a cifra AES-256-GCM (`v1.<iv>.<tag>.<cifra>`). O id da conta entra como dado autenticado, então uma cifra copiada para outra conta não abre. A tabela tem RLS ligado no Supabase. |
| Exibição | `GET /auth/me/vendedora` | Mostra só o tipo, a **máscara** (ex.: `***.982.247-**`) e a data. A resposta vai com `Cache-Control: no-store`. Se a cifra não abrir, responde `pix: null` e `pixIndisponivel: true` (nunca 500), e a vendedora vê o aviso e o formulário para cadastrar de novo. |
| Chave ilegível | `temChavePixUtilizavel` (`backend/contas/src/pix.ts`) | Uma chave que não abre conta como "sem chave": o token sai com `temChavePix: false` (não publica anúncios novos) e o perfil público responde 404. O log registra só o id da conta. |
| Perfil público | `GET /auth/vendedoras/:id` | Mostra só `id`, nome público e cidade. Não traz e-mail, nome completo, CPF nem chave. |

Nenhuma rota HTTP devolve a chave completa. Todas as rotas da vendedora usam o id que vem do token, nunca um id
enviado na requisição. Assim, uma conta não consegue ler nem alterar o perfil de outra.

## 2. `PIX_CRIPTO_CHAVE`: guarda, backup e recuperação

A `PIX_CRIPTO_CHAVE` é a chave que cifra todas as chaves Pix. Ela tem 32 bytes em base64.

> **Se essa chave for perdida ou trocada, nenhuma chave Pix salva pode mais ser lida.** Os repasses param até cada
> vendedora cadastrar a chave de novo.

### Onde ela fica

- **Nunca no Git.** O `.env` está no `.gitignore` e o `.env.example` traz a variável vazia.
- **Em desenvolvimento:** o `npm run gerar-env` cria uma chave aleatória no `.env`.
  - Com o banco em memória, sem `DATABASE_URL`, o serviço pode rodar sem ela. Nesse caso, ele gera uma chave
    temporária a cada início.
  - Com `DATABASE_URL`, o serviço **não sobe** sem a variável. Isso evita gravar chaves Pix que ficariam ilegíveis
    no próximo reinício.
- **Em produção (Render):** a variável fica no painel, com `sync: false` no `render.yaml`. Ela **não** usa
  `generateValue`, porque recriar o serviço geraria uma chave nova e deixaria ilegíveis as chaves Pix já salvas.
- **Uma chave por ambiente.** Use chaves diferentes em desenvolvimento, CI e produção. A da produção nunca é
  copiada para máquinas de desenvolvimento.

### Criar a chave de produção (uma única vez)

```bash
openssl rand -base64 32
```

1. Cole o valor no painel do Render: **Environment → `PIX_CRIPTO_CHAVE`**.
2. Guarde **na mesma hora** uma cópia no cofre de senhas do grupo (Bitwarden, 1Password ou similar). Use um item
   chamado `desaPego · PIX_CRIPTO_CHAVE · produção` e anote a data de criação.
3. Não mande a chave por chat, e-mail ou issue, nem a cole em prints.

### Backup

- O banco (Supabase) e a `PIX_CRIPTO_CHAVE` são **backups separados**, e os dois são necessários.
  - Backup do banco sem a chave: as chaves Pix ficam ilegíveis.
  - Chave sem o banco: não há o que decifrar.
- Pelo menos **duas pessoas** do grupo devem ter acesso ao item no cofre.

### Recuperação

| Situação | O que fazer |
| --- | --- |
| O serviço não sobe e o log diz "PIX_CRIPTO_CHAVE é obrigatória" | A variável sumiu do painel. Copie a chave do cofre para o painel do Render e faça um novo deploy. **Não gere uma chave nova.** |
| O log diz "precisa ter 32 bytes" | O valor foi colado errado (espaço, quebra de linha, cortado). Cole de novo a partir do cofre. |
| A chave foi perdida de vez (não está no cofre nem no painel) | As chaves salvas não podem ser recuperadas. Gere uma chave nova e faça o deploy. O sistema não quebra: cada vendedora vê em `/conta/vendedora` o aviso "sua chave Pix está indisponível" e cadastra de novo, o que substitui a cifra antiga. Até lá, ela não publica anúncios novos. Avise as vendedoras. Apagar as cifras antigas (`DELETE FROM contas.chaves_pix;`) é opcional e só tira os avisos do log. |
| Suspeita de vazamento da chave | Hoje não há troca automática de chave. Por ora: gere uma chave nova e peça o recadastro, como na linha acima. O formato `v1.` permite criar no futuro uma migração que decifre com a chave antiga e cifre com a nova. |

## 3. Dependência da Issue #004 (Criar e Gerenciar Anúncio)

**Regra do Req. 002: só quem tem chave Pix cadastrada pode publicar anúncio.** A regra está em
`backend/comum/autenticacao.ts`, que é o `app/core` do projeto:

- `podeAnunciar(usuaria)`: devolve `true` só se o token tiver `temChavePix: true`.
- `exigirChavePix`: middleware que devolve **403** com `{ erro, codigo: "CHAVE_PIX_AUSENTE" }` quando não há chave.

O que a Issue #004 precisa fazer na rota de criar ou publicar anúncio, no catálogo:

```ts
import { exigirChavePix, exigirLogin, lerSegredoJwt } from "../../comum/autenticacao.js";

const segredo = lerSegredoJwt(process.env);
app.post("/anuncios", exigirLogin(segredo), exigirChavePix, async (req, res) => {
  // res.locals.usuaria.id é a vendedora; aqui ela já tem chave Pix
});
```

- **A barreira é o backend.** O frontend pode esconder o botão "anunciar" ou levar a vendedora para
  `/conta/vendedora` ao receber `CHAVE_PIX_AUSENTE`, mas a rota precisa sempre usar `exigirChavePix`.
- O campo `temChavePix` vem no token de acesso, que dura 15 minutos. Ao cadastrar a chave, `PUT /auth/me/pix`
  devolve um token novo com o campo, então a vendedora não precisa entrar de novo.
- Tokens emitidos antes desta mudança não têm o campo e contam como "sem chave". Basta renovar a sessão.
- Os testes da regra estão em `backend/comum/chave-pix.test.ts` (bloco "regra para o Módulo 02").

## 4. Integração com a Issue #014 (repasse manual pela administração)

Para fazer o repasse Pix, a administração precisa ver a chave completa da vendedora. Hoje **não existe rota para
isso**, de propósito. Existe só a função interna, que já tem teste:

```ts
// backend/contas/src/pix.ts
lerChavePixCompletaParaRepasse(banco, pixSegredo, usuarioId) // → { tipo, chave } | null
```

Quando a #014 precisar mostrar a chave no painel, a rota deve ficar **no serviço de contas** (é o único que tem a
`PIX_CRIPTO_CHAVE`) e seguir estas regras:

1. **Só a administradora master:** `autenticado` + `somenteAdminMaster`, com o perfil relido do banco, como nas
   rotas `/auth/admin/usuarios`.
2. **Reautenticação:** pedir a senha da admin com `reautenticar(...)`, como em `PUT /auth/me/pix`. Por isso a rota é
   um `POST` com a senha no corpo, nunca um `GET`.
3. **Ligada a um repasse:** de preferência, `POST /auth/admin/repasses/:id/chave-pix`, que só responde se o repasse
   estiver pendente para aquela vendedora. Para isso, o serviço de contas consulta o de pedidos pela rota interna
   com `X-API-Key`.
4. **`Cache-Control: no-store`** na resposta, e a chave nunca vai para o log.
5. **Auditoria:** registrar quem consultou, de qual vendedora e quando, sem a chave.
6. **Nunca** colocar a chave completa no token, na listagem de usuárias ou em respostas de pedidos e carteira.

Um caminho alternativo, sem mostrar a chave à admin: o serviço de contas entrega a chave direto ao provedor de
pagamento quando o repasse for automático (Mercado Pago, fora do escopo atual).
