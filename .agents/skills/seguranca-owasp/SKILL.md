---
name: seguranca-owasp
description: >-
  Guia prático e didático de segurança em aplicações Web e APIs baseado no
  OWASP Top 10: SQL Injection, XSS, CSRF, Broken Access Control (IDOR),
  criptografia, uploads, SSRF e headers de segurança. Use esta skill ao revisar
  código sensível, implementar autenticação/autorização, tratar entradas de
  usuário/uploads ou estudar vulnerabilidades e defesas.
---

# Segurança e Boas Práticas (OWASP Top 10)

Skill para **prevenir, detectar e explicar vulnerabilidades** em aplicações Web e back-end, unindo checklist de revisão de segurança (AppSec) e material didático baseado no **OWASP Top 10**.

## Quando usar

- Ao revisar rotas autenticadas, permissões, upload de arquivos, queries SQL ou renderização de conteúdo no front-end.
- Ao configurar autenticação (senhas, JWT, cookies), CORS, CSP, rate limiting e tratamento de dados sensíveis (LGPD).
- Ao investigar riscos como **SQL Injection**, **XSS**, **CSRF**, **IDOR**, **SSRF** ou vazamento de segredos.
- Ao estudar ou documentar requisitos não funcionais e controles de segurança.

## Fluxo de trabalho

1. **Mapear a superfície de ataque:** identifique entradas não confiáveis (body, query, params, headers, arquivos, URLs externas) e dados/ações sensíveis.
2. **Passar o checklist rápido** abaixo no código novo ou alterado.
3. **Consultar as referências:**
   - Visão estruturada dos 10 itens do OWASP Top 10: [OWASP Top 10 na Prática](./references/owasp-top10-resumo.md)
   - Exemplos "Vulnerável vs Seguro" (SQLi, XSS, CSRF, IDOR, Upload, SSRF): [Ataques Comuns e Defesas](./references/ataques-comuns-e-defesas.md)

## Checklist rápido de Segurança

### Controle de Acesso e Sessão
- **Autorização em toda rota protegida (A01):** valide autenticação (`401`) e papel/posse do recurso (`403`) no servidor (`recurso.donoId === usuario.id`), nunca confie em ID enviado no body ou botão oculto no front-end.
- **Autenticação robusta (A07):** senhas com **Argon2id** (ou bcrypt/scrypt), mensagem genérica em falha de login, *rate limit* / bloqueio temporário contra força bruta e invalidação de refresh token no logout.
- **Cookies protegidos:** tokens de sessão em cookie usam `HttpOnly`, `SameSite=Lax` (ou `Strict`) e `Secure` em produção.

### Entradas, Injection e XSS
- **SQL sem concatenação (A03):** use sempre placeholders parametrizados (`$1`, `$2`) ou métodos tipados do ORM (nunca template string montando SQL).
- **Prevenção de XSS:** escape automático do framework (evite `dangerouslySetInnerHTML` / `innerHTML`), valide protocolos de URL (`https:`/`http:`, nunca `javascript:`) e aplique `Content-Security-Policy` (CSP).
- **Prevenção de CSRF:** nunca mude estado em `GET`; mantenha `SameSite` nos cookies e prefira `Authorization: Bearer` em header para chamadas de API ou valide `Origin`/token anti-CSRF.
- **Uploads e caminhos:** valide tipo MIME, tamanho máximo e *magic bytes*; gere chaves aleatórias (UUID) e nunca concatene nome de arquivo do usuário em `path.join`.

### Dados, Configuração e Segredos
- **Dados sensíveis (A02):** HTTPS obrigatório em produção, CPF/chaves cifrados em repouso (ex.: AES-256-GCM) e comparados via HMAC; nunca devolva senha, CPF ou chave inteira na API.
- **Configuração segura (A05):** headers de segurança (`nosniff`, `X-Frame-Options`, `CSP`, HSTS em produção), CORS restrito a origens confiáveis e respostas de erro sem *stack trace*.
- **Integridade e SSRF (A08/A10):** assine webhooks/URLs com HMAC (`timingSafeEqual`), nunca faça `fetch` para URL arbitrária enviada pelo usuário sem *allowlist*.
- **Zero segredos no Git:** `.env`, chaves privadas e tokens ficam fora do repositório (use gitleaks na CI).
