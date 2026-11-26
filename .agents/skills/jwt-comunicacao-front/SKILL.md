---
name: jwt-comunicacao-front
description: >-
  Guia prático e didático sobre autenticação com JWT e comunicação segura com o
  front-end: anatomia do JWT, Access Token em memória + Refresh Token em cookie
  HttpOnly, renovação automática (single-flight), logout/revogação e proxy
  same-origin. Use esta skill ao implementar login/sessão, wrappers de fetch
  autenticado, refresh token, rotas protegidas ou estudar JWT no front/back.
---

# JWT: Comunicação com o Front-end

Skill para **projetar, implementar e depurar autenticação baseada em JWT** entre API e navegador sem expor tokens a XSS, CSRF ou loops de expiração.

## Quando usar

- Ao implementar login, cadastro autenticado, refresh token e logout entre back-end e front-end.
- Ao construir clientes HTTP autenticados no front (`Authorization: Bearer`, renovação em `401`, `useSessaoObrigatoria`).
- Ao revisar claims do JWT, expiração, armazenamento no navegador ou problemas de cookie/proxy em dev e produção.
- Ao estudar as diferenças entre JWT assinado, sessões tradicionais e fluxo Access + Refresh Token.

## Fluxo de trabalho

1. **Definir o desenho da sessão:** Access Token curto (em memória) + Refresh Token revogável (cookie `HttpOnly` via proxy *same-origin* ou CORS com credenciais).
2. **Aplicar o checklist abaixo** tanto no servidor quanto no cliente.
3. **Consultar as referências:**
   - Estrutura do token, Base64URL, algoritmos, claims e ataques comuns: [Anatomia e Segurança de JWT](./references/jwt-anatomia-seguranca.md)
   - Fluxo login → refresh *single-flight* → `401` retry → logout e proxy `/api`: [Fluxo Front-end ↔ Back-end e Refresh](./references/fluxo-front-back-refresh.md)

## Checklist rápido de JWT + Front-end

### No Back-end
- **Access Token curto (ex.: 10–15 min):** contém apenas identificação mínima (`sub`, `perfil`, flags leves) — **nunca** coloque senha, CPF, chave Pix ou segredos no payload (Base64URL é legível por qualquer um).
- **Algoritmo fixo na verificação:** exija algoritmo explícito (`HS256`, `EdDSA` ou `RS256`) ao verificar o token; nunca aceite `alg: "none"`.
- **Refresh Token em cookie `HttpOnly`:** guarde o hash/identificador no banco para poder **revogar no logout**, use `HttpOnly`, `SameSite=Lax` (ou `Strict`), `Secure` em produção e `Path` restrito às rotas de auth.
- **Claims que mudam de valor:** se uma claim do JWT (ex.: `temChavePix`) mudar durante a sessão, emita novo access token na operação ou após o refresh.

### No Front-end
- **Nada de `localStorage` para tokens:** mantenha o `accessToken` apenas em memória React/estado; ao recarregar a página, recupere-o chamando o endpoint de refresh.
- **Refresh *single-flight* (deduplicado):** se 4 componentes receberem `401` ao mesmo tempo, dispare **apenas uma** chamada `/auth/refresh` compartilhada e repita cada requisição **no máximo 1 vez**.
- **Sem loop infinito:** se `/auth/refresh` falhar (`401`), limpe a sessão em memória e redirecione para `/entrar` preservando a rota de retorno de forma segura (apenas caminho relativo `/...`).
- **Prefira proxy *same-origin* (`/api/auth/*`):** evita CORS complexo e mantém o refresh cookie como *first-party*.
