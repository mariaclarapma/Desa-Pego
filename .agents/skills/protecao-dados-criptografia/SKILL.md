---
name: protecao-dados-criptografia
description: >-
  Guia prático e didático de proteção de dados e criptografia aplicada: hash de
  senhas (Argon2id), HMAC para busca/integridade, criptografia autenticada em
  repouso (AES-256-GCM), HTTPS/TLS em trânsito e gestão de chaves (LGPD). Use
  esta skill ao implementar cadastro/login, cifrar CPF/chaves/tokens, validar
  assinaturas HMAC, configurar TLS/HTTPS ou estudar criptografia prática.
---

# Proteção de Dados: Hash, Criptografia e HTTPS

Skill para **escolher a primitiva criptográfica certa para cada dado** e proteger informações sensíveis em repouso e em trânsito (LGPD).

## Quando usar

- Ao armazenar senhas, tokens de sessão/refresh, códigos OTP ou chaves de API.
- Ao guardar dados pessoais sensíveis recuperáveis (CPF, chave Pix, documentos) com necessidade de busca por igualdade (`UNIQUE`).
- Ao validar assinaturas de webhooks ou URLs pré-assinadas (HMAC).
- Ao configurar HTTPS/TLS, rotação de chaves e mascaramento de dados em respostas da API.

## Regra de ouro: qual técnica usar?

| Necessidade | Técnica correta | Exemplo |
| --- | --- | --- |
| Verificar senha sem nunca recuperar o texto original | **Hash lento com salt** (`Argon2id`) | `senha_hash` de login |
| Buscar/garantir unicidade de dado sensível sem abrir o conteúdo | **HMAC-SHA256** com chave secreta | `cpf_hash` (`UNIQUE` no banco) |
| Guardar dado sensível e recuperar/exibir mascarado depois | **Criptografia simétrica autenticada (AEAD)** (`AES-256-GCM`) | `cpf_cripto`, `pix_cripto` |
| Provar autenticidade/integridade de webhook ou link | **HMAC-SHA256** + `timingSafeEqual` | Assinatura de webhook / URL |
| Proteger tudo que trafega entre navegador, proxy e APIs | **HTTPS (TLS 1.2/1.3)** | Tráfego em produção |

## Fluxo de trabalho

1. **Classificar o dado:** público, interno, pessoal (LGPD) ou credencial/segredo.
2. **Aplicar o checklist abaixo** antes de gravar, trafegar ou retornar o dado.
3. **Consultar as referências:**
   - Senhas, `Argon2id`, salt, SHA-256 vs KDF e HMAC: [Hashing, Senhas e HMAC](./references/hashing-e-senhas.md)
   - `AES-256-GCM`, IV/Nonce, rotação de chaves e HTTPS/TLS: [Criptografia em Repouso e HTTPS](./references/criptografia-e-https.md)

## Checklist rápido de Proteção de Dados

- **Senhas:** use **Argon2id** (ou scrypt/bcrypt) com salt aleatório por senha; **nunca** use MD5, SHA-1 ou SHA-256 puro para senhas, e nunca retorne o hash na API.
- **Criptografia em repouso:** use **AES-256-GCM** (com integridade/Auth Tag), gerando um **IV/nonce aleatório novo a cada gravação** — nunca reutilize nonce com a mesma chave.
- **Chaves e segredos:** gere com entropia criptográfica (`randomBytes(32)`), mantenha fora do código/Git e separe chaves por finalidade (`JWT_SECRET`, `CPF_CRIPTO_CHAVE`, `CPF_HASH_CHAVE`, `PIX_CRIPTO_CHAVE`).
- **Comparação segura:** sempre compare assinaturas/HMACs com `crypto.timingSafeEqual` (após checar igualdade de tamanho).
- **HTTPS e mascaramento:** exija TLS em produção (sem *downgrade* HTTP), nunca logue dados sensíveis e devolva apenas versões mascaradas ao usuário (ex.: `***.982.247-**`).
