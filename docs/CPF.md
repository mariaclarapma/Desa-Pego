# CPF das contas (Req. 001)

Este documento explica como o CPF é protegido no serviço de contas e como cuidar das duas chaves que essa proteção
usa: `CPF_CRIPTO_CHAVE` e `CPF_HASH_CHAVE`.

## 1. Como funciona

| Etapa | Onde | O que acontece |
| --- | --- | --- |
| Validação | `backend/comum/cpf.ts` (`validarCpf`) e `frontend/src/lib/validacao-conta.ts` | 11 dígitos, com ou sem pontuação, e dígitos verificadores certos. Sequências repetidas (`111.111.111-11`) são recusadas. O backend valida de novo. |
| Unicidade | coluna `contas.usuarios.cpf_hash` | HMAC-SHA256 do CPF com a `CPF_HASH_CHAVE`. O índice `usuarios_cpf_hash_unico` (`UNIQUE`) faz o **banco** recusar CPF repetido, inclusive em dois cadastros ao mesmo tempo. |
| Armazenamento | coluna `contas.usuarios.cpf_cifrado` | AES-256-GCM com IV aleatório e a `CPF_CRIPTO_CHAVE`. Formato: `v1.<iv>.<tag>.<cifra>`. O id da conta entra como dado autenticado (AAD), então uma cifra copiada para outra conta não abre. |
| Respostas e logs | `backend/contas/src/app.ts` | Nenhuma resposta, token ou log traz o CPF, o hash ou a cifra. As mensagens de erro não repetem o número digitado. |

**Por que HMAC e não SHA-256.** Só existem cerca de 10⁹ CPFs. Com um SHA-256 simples, quem lesse o banco calcularia
o hash de todos em minutos e descobriria cada CPF. O HMAC só pode ser recalculado por quem tem a `CPF_HASH_CHAVE`.

**Por que duas chaves.** São usos diferentes, e separá-los limita o estrago de um vazamento:

- Vazar só a `CPF_HASH_CHAVE` permite testar se um CPF tem conta, mas não permite ler os CPFs guardados.
- Vazar só a `CPF_CRIPTO_CHAVE` não ajuda sem o banco.

As duas precisam ser diferentes. O serviço não sobe se forem iguais.

Contas criadas antes do campo e a administradora master ficam com CPF nulo. O índice `UNIQUE` aceita vários nulos.

## 2. As chaves: geração, guarda e backup

> **Nunca troque nem perca as chaves depois que houver contas.**
> - Com outra `CPF_HASH_CHAVE`, o banco deixa de reconhecer CPF repetido, **sem nenhum erro visível**. Os hashes
>   novos não batem com os antigos.
> - Com outra `CPF_CRIPTO_CHAVE`, os CPFs salvos ficam ilegíveis.

### Gerar (uma vez por ambiente)

```bash
openssl rand -base64 32   # rode duas vezes: uma para cada chave
```

Qualquer texto aleatório com 32 ou mais caracteres funciona. O serviço deriva a chave real com HKDF-SHA256. Espaços
e quebras de linha nas pontas são ignorados. Não use frases, nomes ou valores que dá para adivinhar.

### Onde ficam

- **Nunca no Git.** O `.env` está no `.gitignore`, o `.env.example` traz as variáveis vazias e a CI roda o
  gitleaks.
- **Em desenvolvimento:**
  - O `npm run gerar-env` cria as duas chaves no `.env`.
  - Sem `DATABASE_URL` (banco em memória), o serviço gera chaves temporárias a cada início.
  - Com `DATABASE_URL`, o serviço **não sobe** sem as duas chaves. Isso evita gravar CPFs com uma chave que
    some no reinício.
- **Na CI:** chaves descartáveis, geradas a cada execução no teste de fumaça (`.github/workflows/ci.yml`).
- **Em produção (Render):** as duas variáveis ficam no painel, com `sync: false` no `render.yaml`. Elas **não**
  usam `generateValue`, porque recriar o serviço geraria chaves novas.
- **Uma chave por ambiente.** As chaves de produção nunca vão para máquinas de desenvolvimento, e o Supabase de
  desenvolvimento usa chaves próprias.

### Criar as chaves de produção

1. Gere as duas chaves com o comando acima.
2. Cole cada uma no painel do Render: **Environment → `CPF_CRIPTO_CHAVE`** e **`CPF_HASH_CHAVE`**.
3. **Na mesma hora**, guarde uma cópia de cada uma no cofre de senhas do grupo (Bitwarden, 1Password ou similar).
   Use itens separados, chamados `desaPego · CPF_CRIPTO_CHAVE · produção` e `desaPego · CPF_HASH_CHAVE · produção`,
   e anote a data de criação.
4. Só depois faça o deploy.
5. Não mande as chaves por chat, e-mail ou issue, nem as cole em prints ou logs.

### Backup

- O banco (Supabase) e as chaves são **backups separados**, e os dois são necessários.
  - Banco sem as chaves: CPFs ilegíveis e unicidade quebrada.
  - Chaves sem o banco: não há o que decifrar.
- **Não guarde as chaves junto com o dump do banco.** Quem pegasse os dois teria todos os CPFs.
- Pelo menos **duas pessoas** do grupo devem ter acesso aos itens no cofre.
- Depois de cada mudança no painel do Render, confira se o valor no painel é igual ao do cofre.

## 3. Recuperação

| Situação | O que fazer |
| --- | --- |
| O serviço não sobe e o log diz "CPF_CRIPTO_CHAVE … obrigatória" ou "CPF_HASH_CHAVE … obrigatória" | A variável sumiu do painel. Copie do cofre para o painel e faça um novo deploy. **Não gere uma chave nova.** |
| O log diz "precisam ser diferentes" | As duas variáveis receberam o mesmo valor. Restaure cada uma a partir do seu item no cofre. |
| A `CPF_HASH_CHAVE` foi perdida, mas a `CPF_CRIPTO_CHAVE` está intacta | Dá para recuperar: gere uma `CPF_HASH_CHAVE` nova e recalcule todos os `cpf_hash`, decifrando cada `cpf_cifrado`. **Esse script ainda não existe.** Até ele rodar, o cadastro precisa ficar fora do ar, senão CPFs repetidos entram. |
| A `CPF_CRIPTO_CHAVE` foi perdida, mas a `CPF_HASH_CHAVE` está intacta | A unicidade continua funcionando. Os CPFs guardados não podem ser lidos, mas hoje nenhuma funcionalidade lê o CPF. Gere uma chave nova para os próximos cadastros. As cifras antigas ficam ilegíveis e podem ser apagadas, ou o CPF pode ser pedido de novo. |
| Suspeita de vazamento de uma chave | Hoje não há troca automática. Com a chave antiga em mãos, é possível migrar: decifrar com a antiga e cifrar com a nova, ou recalcular os hashes com a nova. O prefixo `v1.` já prevê formatos futuros. Esse script também ainda não existe. |

## 4. Testes

- `backend/comum/cpf.test.ts`: validação (tamanho, dígitos verificadores, sequências, mensagens sem o número).
- `backend/contas/src/cpf-cripto.test.ts`: HMAC determinístico, cifra com IV aleatório, cifra adulterada, outra
  conta, outra chave e tag truncada.
- `backend/contas/src/cpf.test.ts`: cadastro válido e inválido, duplicado, cadastros simultâneos, restrição `UNIQUE`
  no banco e ausência do CPF no banco, nas respostas, no token e nos logs.
- `frontend/cypress/e2e/autenticacao.cy.ts`: máscara, validação no formulário e CPF repetido.
