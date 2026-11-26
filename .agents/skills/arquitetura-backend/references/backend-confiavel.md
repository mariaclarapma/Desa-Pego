# Engenharia de Back-end Confiável

Guia prático e didático sobre os pilares que evitam bugs silenciosos, falhas de segurança e perda de consistência no servidor.

---

## 1. Validação na fronteira e autorização

### Validação de entrada (Schema + Domínio)
- **Regra:** nunca confie no payload vindo do cliente. Valide tipo, tamanho máximo, formato, enum permitido e limites numéricos logo na entrada (ex.: `zod`).
- **Erro claro:** devolva `400` (ou `422`) indicando os campos inválidos, sem expor detalhes internos de SQL ou infraestrutura.
- **Upload de arquivos:** não confie apenas na extensão ou no `Content-Type` enviado pelo navegador. Valide também:
  1. Limite de tamanho em bytes.
  2. Assinatura dos primeiros bytes (*magic bytes*, ex.: `FF D8 FF` para JPEG, `89 50 4E 47` para PNG, `RIFF....WEBP` para WebP).
  3. Posse do envio (só quem pediu a URL pré-assinada pode vincular a foto ao próprio recurso).

### Autenticação vs Autorização (IDOR)
- **Autenticação (`401`):** "Quem é você?" (JWT ausente, expirado ou assinatura inválida).
- **Autorização (`403`):** "Você pode fazer isso?"
  - Papel/perfil (ex.: rota `/admin` exige perfil `ADMIN`; anunciar exige `temChavePix`).
  - **Posse do recurso (anti-IDOR):** antes de ler, editar, pausar ou excluir `/anuncios/:id` ou `/pedidos/:id`, confirme no servidor que `recurso.donoId === usuarioAutenticado.id`.

---

## 2. Concorrência, atomicidade e máquina de estados

### O problema da corrida (*Race Condition*)
Se dois compradores clicam em "comprar" ao mesmo tempo numa peça única:
- **Errado:**
  1. `SELECT status FROM pecas WHERE id = $1` → `"disponivel"`
  2. `UPDATE pecas SET status = 'reservada' WHERE id = $1`
  *(Ambas as requisições podem ler `"disponivel"` antes de qualquer uma atualizar!)*
- **Certo (atualização atômica):**
  - `UPDATE pecas SET status = 'reservada', reservada_ate = ... WHERE id = $1 AND status = 'disponivel' RETURNING *`
  - Se `rowCount === 0`, outra pessoa reservou antes → responda `409 Conflict`.
- Em armazenamento em memória/arquivo JSON, serialize escritas por uma fila assíncrona única e **revalide as condições dentro da seção crítica**.

### Máquina de Estados explícita
- Defina um mapa de transições permitidas:
  - Ex.: `aguardando_pagamento` → `pago` | `cancelado`
  - `pago` → `enviado`
  - `enviado` → `entregue`
- Rejeite qualquer salto inválido (ex.: cancelar pedido já entregue, editar anúncio já reservado/vendido) com `409 Conflict`.

---

## 3. Idempotência e integrações externas

- **Webhooks e retentativas:** gateways de pagamento e filas entregam o mesmo evento mais de uma vez (*at-least-once delivery*).
- **Como tornar idempotente:**
  1. Valide a assinatura criptográfica do remetente antes de processar.
  2. Guarde o `eventoId` processado (chave única no banco) ou verifique atomicamente a transição de estado dentro da mesma transação.
  3. Se o evento já foi processado, **não aplique novamente** e devolva `200 OK` para parar as retentativas.

---

## 4. Dinheiro, livro-razão e precisão numérica

- **Nunca use ponto flutuante (`0.1 + 0.2 === 0.30000000000000004`) para dinheiro.**
- Guarde valores em **centavos inteiros** (`8990` = R$ 89,90) e percentuais em **pontos-base** (`1000` = 10,00%).
- Use aritmética inteira (com `BigInt` na multiplicação intermediária) garantindo que `comissao + taxa + liquido === total` sem diferença de 1 centavo.
- **Livro-razão (*ledger*):** registros financeiros devem ser **imutáveis** (*append-only*). Estornos ou repasses geram novos lançamentos (crédito/débito), nunca `UPDATE` ou `DELETE` no histórico.

---

## 5. Segurança de dados (LGPD) e segredos

- **Senhas:** hash unidirecional lento com salt por usuário (`Argon2id`). Nunca devolva o campo de senha ou hash na API.
- **Dados sensíveis buscáveis (ex.: CPF):**
  - Armazene o valor cifrado (criptografia autenticada, ex.: AES-256-GCM) quando precisar recuperar/exibir mascarado.
  - Armazene um **HMAC determinístico** (`cpf_hash`) com chave secreta para consultas e restrição `UNIQUE` sem precisar descriptografar toda a base.
- **Logs e respostas:** nunca logue tokens, senhas, chaves privadas ou payloads sensíveis completos.

---

## 6. Estratégia de testes no back-end

| Camada | O que testar | Ferramentas comuns |
| --- | --- | --- |
| **Unidade (domínio puro)** | Cálculos em centavos, arredondamentos, máquinas de estado, validações | Vitest / Jest |
| **Integração HTTP (API)** | Status codes (`200/201/204/400/401/403/404/409`), posse, payloads inválidos, webhooks repetidos | Supertest + adaptadores simulados |
| **Persistência real** | Queries SQL, restrições `UNIQUE`, `UPDATE ... WHERE`, migrações | Banco de testes (PostgreSQL) |
