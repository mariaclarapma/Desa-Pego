# HTTP: HTTPS, Métodos, Status Codes e Headers

Referência prática e didática sobre a camada HTTP de aplicações Web e APIs.

---

## 1. HTTPS e TLS

- **HTTP** trafega em texto claro; **HTTPS** encapsula o HTTP sobre **TLS** (Transport Layer Security).
- **O que o TLS garante:**
  1. **Confidencialidade:** terceiros na rede não leem headers, cookies, tokens nem corpo da requisição.
  2. **Integridade:** o conteúdo não pode ser alterado em trânsito sem detecção.
  3. **Autenticidade:** o certificado prova que você está falando com o domínio legítimo.
- **Boas práticas:**
  - Não faça *downgrade* para `http://` em integrações externas ou callbacks.
  - Em produção, envie `Strict-Transport-Security: max-age=63072000; includeSubDomains` (HSTS) e `upgrade-insecure-requests` na CSP; em `localhost` HTTP, **não** envie HSTS para não travar o navegador em desenvolvimento.
  - Se a API roda atrás de proxy reverso (Render, Cloudflare, Nginx), configure `trust proxy` corretamente para que `req.protocol === "https"` e `req.ip` reflitam o cliente real.

---

## 2. Métodos HTTP

Dois conceitos fundamentais:
- **Seguro (*Safe*):** não altera estado no servidor (`GET`, `HEAD`, `OPTIONS`).
- **Idempotente:** chamar 1 vez ou N vezes seguidas produz o mesmo estado final no servidor (`GET`, `HEAD`, `PUT`, `DELETE`).

| Método | Uso típico | Tem corpo? | Seguro? | Idempotente? |
| --- | --- | --- | --- | --- |
| `GET` | Buscar recurso ou listagem | Não | Sim | Sim |
| `HEAD` | Igual ao `GET`, mas retorna só headers | Não | Sim | Sim |
| `POST` | Criar recurso ou disparar ação/comando | Sim | Não | Não (salvo chave de idempotência) |
| `PUT` | Substituir um recurso inteiro ou enviar arquivo para URL fixa | Sim | Não | Sim |
| `PATCH` | Atualizar parcialmente um recurso | Sim | Não | Depende da operação |
| `DELETE` | Remover um recurso | Opcional | Não | Sim |
| `OPTIONS` | Consultar métodos/permissões (ex.: *preflight* CORS) | Não | Sim | Sim |

**Armadilha comum:** usar `GET` para ações que alteram estado (ex.: `/logout` ou `/pausar` via `GET`) permite efeitos colaterais por *prefetch* de navegador ou links externos. Use `POST` ou `DELETE`.

---

## 3. Status Codes essenciais

### `2xx` — Sucesso
- `200 OK`: leitura ou atualização concluída com corpo na resposta.
- `201 Created`: recurso criado (idealmente com `Location` ou o recurso criado no JSON).
- `204 No Content`: sucesso sem corpo (comum em `DELETE`, upload `PUT` direto no storage, ou `OPTIONS`).

### `3xx` — Redirecionamento / Cache
- `301` / `308`: redirecionamento permanente (`308` preserva o método HTTP).
- `302` / `307`: redirecionamento temporário (`307` preserva o método HTTP).
- `304 Not Modified`: cache condicional válido (`ETag` / `If-None-Match`), economiza banda.

### `4xx` — Erro do cliente
- `400 Bad Request`: sintaxe/validação de entrada inválida (campo faltando, formato errado).
- `401 Unauthorized`: **não autenticado** (token ausente, expirado ou inválido).
- `403 Forbidden`: **autenticado, mas sem permissão** (recurso de outro usuário, perfil não-admin, falta de chave Pix).
- `404 Not Found`: recurso não existe (ou ocultado propositalmente por segurança).
- `409 Conflict`: conflito com o estado atual (e-mail/CPF duplicado, peça já reservada/vendida, transição de status inválida).
- `413 Payload Too Large`: corpo ou arquivo excede o tamanho máximo permitido.
- `415 Unsupported Media Type`: `Content-Type` ou conteúdo real (*magic bytes*) não aceito.
- `422 Unprocessable Content`: JSON bem formado, mas regra semântica inválida (alternativa válida ao `400` conforme convenção da API).
- `429 Too Many Requests`: limite de requisições (*rate limit*) atingido — ideal acompanhar de header `Retry-After`.

### `5xx` — Erro do servidor / dependência
- `500 Internal Server Error`: bug inesperado no servidor (nunca vaze stack trace ao usuário).
- `502 Bad Gateway`: proxy/gateway recebeu resposta inválida do serviço acima.
- `503 Service Unavailable`: serviço indisponível ou dependência crítica fora do ar.

---

## 4. Headers mais importantes

### Requisição e Negociação
- `Host`: domínio destino (obrigatório em HTTP/1.1).
- `Content-Type`: formato do corpo enviado (`application/json; charset=utf-8`, `multipart/form-data`, `image/png`).
- `Accept`: formatos aceitos pelo cliente (`application/json`).
- `Authorization`: credencial por requisição (`Bearer <access_token>`).
- `User-Agent` e `Origin` / `Referer`: identificação e origem da chamada no navegador.

### Cache e Controle de Conteúdo
- `Cache-Control`:
  - Dados privados/autenticados: `no-store`.
  - Assets estáticos com nome imutável (ex.: UUID da foto): `public, max-age=31536000, immutable`.
- `ETag` / `If-Match` / `If-None-Match`: validação condicional de cache e controle de concorrência otimista (ex.: copiar objeto no S3 apenas se `CopySourceIfMatch` bater com o ETag).
- `Range` / `Content-Range` (`206 Partial Content`): leitura parcial de arquivos (ex.: ler só os 12 primeiros bytes no storage para checar *magic bytes*).

### Headers de Segurança HTTP
- `Content-Security-Policy` (CSP): restringe de quais origens o navegador pode carregar scripts, estilos, imagens (`img-src`) e fazer `fetch`/XHR (`connect-src`).
- `X-Content-Type-Options: nosniff`: impede o navegador de adivinhar (*MIME sniffing*) um arquivo como script executável.
- `X-Frame-Options: DENY` (ou `frame-ancestors 'none'` na CSP): protege contra *clickjacking*.
- `Referrer-Policy: strict-origin-when-cross-origin`: evita vazar query strings/paths completos para terceiros.
- `Cross-Origin-Opener-Policy: same-origin`: isola a janela contra ataques *cross-origin*.
- Evite expor tecnologias desnecessariamente (`poweredByHeader: false` / `app.disable("x-powered-by")`).
