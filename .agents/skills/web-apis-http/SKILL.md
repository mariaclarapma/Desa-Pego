---
name: web-apis-http
description: >-
  Guia prático e didático de fundamentos Web e APIs HTTP: HTTPS/TLS, métodos
  HTTP, status codes, headers, cookies e CORS. Use esta skill ao projetar ou
  revisar endpoints REST, configurar cabeçalhos de segurança/CSP, implementar
  autenticação com cookies, diagnosticar erros de CORS ou explicar conceitos de
  protocolo Web.
---

# Web e APIs HTTP

Skill para **projetar, depurar e explicar** comunicação Web e APIs sobre HTTP/HTTPS, cobrindo semântica do protocolo, segurança de transporte, cabeçalhos, cookies e CORS.

## Quando usar

- Ao definir rotas, métodos HTTP e status codes de uma API.
- Ao configurar headers de resposta (segurança, `Content-Security-Policy`, `Cache-Control`, `Content-Type`).
- Ao implementar ou depurar sessões baseadas em **cookies** (`HttpOnly`, `Secure`, `SameSite`).
- Ao diagnosticar falhas de **CORS**, preflight `OPTIONS` ou integração navegador → API/storage externo.
- Ao estudar ou ensinar como o protocolo HTTP funciona na prática.

## Fluxo de diagnóstico e revisão

1. **Identifique a camada do problema:**
   - **Transporte/Origem (`HTTPS`):** certificado, redirecionamento, *mixed content* ou HSTS?
   - **Contrato da requisição:** método HTTP, URL, `Content-Type` e status code devolvido fazem sentido semântico?
   - **Segurança no navegador:** política de `CSP`, cabeçalhos de proteção, escopo de **Cookies** ou bloqueio de **CORS**?
2. **Aplique o checklist rápido** abaixo.
3. **Aprofunde nas referências:**
   - HTTPS, métodos, status codes e headers: [HTTP: Métodos, Status Codes e Headers](./references/http-metodos-status-headers.md)
   - Cookies seguros, CSRF/XSS, CORS, preflight e proxy *same-origin*: [Cookies e CORS na Prática](./references/cookies-e-cors.md)

## Checklist rápido de Web e APIs

### HTTPS e transporte
- Em produção, toda comunicação trafega exclusivamente via **HTTPS** (TLS), nunca HTTP puro.
- Ative `Strict-Transport-Security` (HSTS) **apenas em produção HTTPS** (nunca em `http://localhost`).
- Nunca passe segredos, tokens de sessão ou senhas na *query string* da URL (ficam em logs e histórico); use `Authorization` header ou cookie `HttpOnly`.

### Métodos e Status Codes
- Use **métodos** conforme semântica: `GET` (leitura segura), `POST` (criação/ação), `PUT` (substituição idempotente), `PATCH` (atualização parcial), `DELETE` (remoção idempotente).
- Diferencie claramente erros de cliente (`400` payload inválido, `401` não autenticado, `403` sem permissão, `404` não encontrado, `409` conflito/regra de estado, `413` payload grande, `415` mídia não suportada, `429` rate limit) de falhas de servidor (`500`, `502`, `503`).

### Headers
- Sempre envie e valide `Content-Type` (`application/json`, `image/jpeg`, etc.) e proteja downloads/uploads com `X-Content-Type-Options: nosniff`.
- Defina `Cache-Control` adequado: `no-store` para dados autenticados/sensíveis e `public, max-age=..., immutable` apenas para assets com chave única.
- Configure `Content-Security-Policy` (CSP) liberando apenas as origens realmente necessárias (`connect-src`, `img-src`, `script-src`).

### Cookies e CORS
- Tokens de longa duração (ex.: refresh token) devem ficar em cookies `HttpOnly` + `SameSite=Lax` (ou `Strict`) + `Secure` em produção, com `Path` restrito quando aplicável.
- **CORS não é autenticação**, é proteção do navegador (*Same-Origin Policy*): permita apenas origens confiáveis em lista explícita — **nunca** combine `Access-Control-Allow-Origin: *` com `Access-Control-Allow-Credentials: true`.
- Quando possível (ex.: Next.js rewrites `/api/*`), use proxy *same-origin* para evitar CORS e manter cookies como *first-party*.
