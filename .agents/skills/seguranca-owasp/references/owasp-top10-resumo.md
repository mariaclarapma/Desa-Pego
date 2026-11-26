# OWASP Top 10 na Prática

Resumo didático e aplicado dos **10 riscos críticos do OWASP Top 10** para aplicações Web e APIs modernas.

---

| Código | Categoria (OWASP Top 10) | O que significa na prática | Como mitigar |
| --- | --- | --- | --- |
| **A01** | **Broken Access Control** | Usuário acessa dados ou ações de outro usuário/admin (ex.: IDOR em `/pedidos/123`) | Checar papel (`ADMIN`) e posse (`donoId === user.id`) em toda rota no back-end; negar por padrão (*deny by default*) |
| **A02** | **Cryptographic Failures** | Dados sensíveis expostos em trânsito ou em repouso (HTTP sem TLS, senha em MD5/texto, CPF aberto) | HTTPS/TLS, **Argon2id** para senhas, AES-256-GCM para dados recuperáveis, HMAC para busca/índice, segredos fora do Git |
| **A03** | **Injection** | Dados do usuário viram código executável (SQL Injection, NoSQLi, Command Injection, XSS) | Queries parametrizadas (`$1`), validação estrita com `zod`, nunca passar input para `exec`/`eval`/SQL concatenado |
| **A04** | **Insecure Design** | Falha na regra de negócio antes mesmo do código (ex.: permitir comprar peça já vendida, aceitar preço `<= 0` do cliente) | Modelagem de ameaças, atualização atômica, máquina de estados, cálculo de valores no servidor |
| **A05** | **Security Misconfiguration** | Padrões inseguros, debug ligado em produção, CORS `*` com credenciais, falta de CSP/headers | Desabilitar `x-powered-by`, definir `CSP`, `nosniff`, `X-Frame-Options`, HSTS em produção, CORS por *allowlist* |
| **A06** | **Vulnerable and Outdated Components** | Bibliotecas com CVEs conhecidas no `package.json` / `Dockerfile` | `npm audit`, Dependabot/Renovate, manter Node/frameworks atualizados e remover dependências sem uso |
| **A07** | **Identification & Authentication Failures** | Força bruta sem bloqueio, JWT sem expiração/segredo fraco, enumeração de contas no login | *Rate limit* por IP/conta, JWT curto + refresh token `HttpOnly` rotacionado/revogável, erro genérico no login |
| **A08** | **Software & Data Integrity Failures** | Aceitar webhook sem verificar assinatura, desserializar dado não confiável, CI sem proteção | Validar assinatura HMAC com `timingSafeEqual`, verificar integridade de uploads (*magic bytes*), travar lockfile (`npm ci`) |
| **A09** | **Security Logging & Monitoring Failures** | Ataques acontecem sem registro ou logs vazam senhas/tokens | Logar eventos de segurança (login falho, 403, alteração de permissão, webhook inválido) **sem** gravar senhas, tokens ou CPF |
| **A10** | **Server-Side Request Forgery (SSRF)** | Servidor busca uma URL fornecida pelo usuário e acessa rede interna/metadados da nuvem (`169.254.169.254`) | Nunca fazer `fetch(urlDoUsuario)` livre; usar *allowlist* de domínios/protocolos (`https:`) e bloquear IPs privados/loopback |

---

## Princípios transversais de defesa

1. **Defesa em profundidade:** mesmo que o front-end valide e oculte um botão, o back-end valida tudo novamente e o banco impõe `UNIQUE`/`CHECK`/`FOREIGN KEY`.
2. **Menor privilégio:** chaves de storage/banco têm apenas as permissões estritamente necessárias (ex.: navegador só envia para bucket temporário via URL pré-assinada; chave secreta fica só no servidor).
3. **Falhar de forma segura (*Fail Closed*):** se a verificação de assinatura, token ou configuração obrigatória falhar em produção, bloqueie a operação — nunca faça *fallback* permissivo.
