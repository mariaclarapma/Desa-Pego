# Anatomia e Segurança de JWT

Referência prática e didática sobre como o **JSON Web Token (JWT)** funciona por dentro e quais erros evitar.

---

## 1. O que é um JWT (Header.Payload.Signature)

Um JWT (JWS) são três blocos em **Base64URL** separados por ponto:

```text
eyJhbGci… . eyJzdWIi… . assinatura   (header . payload . signature, encurtados)
```

1. **Header:** algoritmo e tipo (`{"alg":"HS256","typ":"JWT"}`).
2. **Payload (Claims):** dados do usuário e metadados:
   - `sub` (*Subject*): ID único do usuário.
   - `iat` (*Issued At*) e `exp` (*Expiration Time*): emissão e vencimento em segundos Unix.
   - `jti` (*JWT ID*): ID único útil para rastreamento/revogação.
   - Claims de domínio: ex. `perfil`, `nome`, `temChavePix`.
3. **Signature:** prova matemática de que o token foi emitido por quem tem a chave e **não foi alterado**.

> **Atenção:** **Base64URL NÃO é criptografia!** Qualquer pessoa (incluindo o front-end com `atob` ou `jwt.io`) lê o Header e o Payload. A assinatura garante apenas **integridade e autenticidade**, não confidencialidade.

---

## 2. Algoritmos: Simétrico vs Assimétrico

| Algoritmo | Chaves | Quando usar |
| --- | --- | --- |
| **`HS256` (HMAC-SHA256)** | Uma chave secreta compartilhada (`JWT_SECRET`) | Arquitetura onde um serviço emite e os mesmos serviços internos de confiança validam usando a mesma variável secreta |
| **`RS256` / `ES256` / `EdDSA`** | Chave privada assina; chave pública (ou JWKS) verifica | Quando múltiplos sistemas terceiros ou gateways precisam validar o token sem ter poder de emitir novos tokens |

---

## 3. Onde guardar tokens no Front-end?

| Local | Sobrevive ao reload? | Risco de **XSS** | Risco de **CSRF** | Recomendação |
| --- | --- | --- | --- | --- |
| **Memória JS** (`useState` / variável) | Não (recarrega via `/refresh`) | Baixo (não é persistido em storage) | Nenhum (vai no header `Authorization`) | **Ideal para Access Token curto** |
| **Cookie `HttpOnly` + `SameSite=Lax`** | Sim | Protegido (JS não lê `document.cookie`) | Mitigado por `SameSite` e `Path` restrito | **Ideal para Refresh Token** |
| **`localStorage` / `sessionStorage`** | Sim | **Alto** (qualquer XSS lê e exfiltra na hora) | Nenhum | **Evitar** para tokens de sessão |

---

## 4. Vulnerabilidades clássicas de JWT

1. **Aceitar `alg: "none"` ou algoritmo inesperado:** sempre passe `algorithms: ["HS256"]` (ou o algoritmo exato esperado) na função de verificação (ex.: `jwtVerify` da biblioteca `jose`).
2. **Segredo curto/previsível:** em `HS256`, use chave aleatória de pelo menos 32 bytes (256 bits).
3. **Token sem expiração ou expiração longa sem revogação:** um access token válido por 30 dias não pode ser invalidado facilmente se o usuário trocar a senha ou fizer logout. Mantenha o access token curto (5–15 min) e controle revogação no refresh token.
4. **Decodificar no front-end achando que é validação de segurança:** no front-end, ler o payload serve só para interface (ex.: mostrar o primeiro nome ou aviso de chave Pix); quem valida a assinatura e decide `401`/`403` é sempre o back-end.
5. **Open Redirect no retorno do login:** ao mandar o usuário para `/entrar?de=/anunciar`, valide no front que `de` começa com `/` e não com `//` (para ninguém redirecionar para `//site-malicioso.com`).
