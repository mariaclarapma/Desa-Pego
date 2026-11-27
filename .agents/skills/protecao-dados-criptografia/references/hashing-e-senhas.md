# Hashing, Senhas e HMAC

Referência prática e didática sobre funções de hash, armazenamento seguro de senhas e autenticação de mensagens com HMAC.

---

## 1. Hash vs HMAC vs Criptografia

- **Hash (unidirecional):** transforma qualquer entrada em um resumo de tamanho fixo (`SHA-256`). **Não tem chave e não pode ser revertido.**
- **HMAC (Hash com Chave Secreta):** combina um hash (`SHA-256`) com uma chave secreta compartilhada (`HMAC-SHA256`). Só quem tem a chave gera ou valida o mesmo resultado.
- **Criptografia (bidirecional):** transforma texto claro em texto cifrado usando uma chave — **pode ser revertida** (*descriptografada*) por quem possui a chave certa.

---

## 2. Por que SHA-256 NÃO serve para senhas?

`SHA-256` foi projetado para ser **extremamente rápido** (ótimo para checksum de arquivos). Em uma GPU moderna, um atacante testa **bilhões de senhas por segundo** contra um vazamento de `SHA-256`.

### O que usar para senhas: Funções KDF lentas com Salt
Use **Argon2id** (recomendação principal do OWASP) — ou `scrypt` / `bcrypt`:
- **Salt único por senha:** um valor aleatório misturado antes do hash impede ataques de *rainbow tables* e impede identificar dois usuários com a mesma senha.
- **Custo configurável (memória + tempo):** exige memória RAM e processamento por tentativa, inviabilizando quebra em massa por GPU/ASIC.

### Exemplo prático com Argon2id
- O salt já fica embutido na string gerada (ex.: `$argon2id$v=19$m=65536,t=3,p=1$...`).
- **Boas práticas:**
  1. Nunca faça `trim()` silencioso nem limite artificialmente senhas curtas demais sem avisar; exija mínimo seguro (ex.: 8+ caracteres).
  2. Nunca exponha `senhaHash` em DTOs, respostas JSON ou logs.
  3. Ao fazer login com conta inexistente, evite diferença gritante de tempo/mensagem: devolva sempre erro genérico ("e-mail ou senha inválidos").

---

## 3. HMAC para busca, unicidade e assinaturas

### Caso 1: Garantir unicidade sem descriptografar (ex.: CPF)
Se você só **cifrar** o CPF com `AES-256-GCM` (que usa um IV aleatório diferente a cada gravação), o mesmo CPF gera dois textos cifrados diferentes — logo o banco não consegue checar `UNIQUE` diretamente!

**Solução (Criptografia + Índice cego por HMAC):**
1. Normalize o dado (ex.: só os 11 dígitos do CPF).
2. Calcule `cpf_hash = HMAC_SHA256(CPF_HASH_CHAVE, cpfNormalizado)` → determinístico, vai para coluna `UNIQUE` indexada.
3. Cifre o CPF com `AES-256-GCM(CPF_CRIPTO_CHAVE, cpfNormalizado)` → vai para coluna `cpf_cripto` caso precise recuperar/mascarar.

> **Importante:** use chaves diferentes para o HMAC e para a cifra (`CPF_HASH_CHAVE` ≠ `CPF_CRIPTO_CHAVE`).

### Caso 2: Validar assinatura de webhook ou link pré-assinado
Ao comparar uma assinatura recebida com a esperada, **nunca** use `===` (que para no primeiro byte diferente e vaza informação por tempo):
```ts
import { createHmac, timingSafeEqual } from "node:crypto";

function assinaturaValida(payload: string, recebidaHex: string, segredo: Uint8Array): boolean {
  const esperada = Buffer.from(createHmac("sha256", segredo).update(payload).digest("hex"), "utf8");
  const recebida = Buffer.from(recebidaHex, "utf8");
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}
```
