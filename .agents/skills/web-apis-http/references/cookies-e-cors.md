# Cookies e CORS na Prática

Referência prática e didática sobre gerenciamento de estado com Cookies e compartilhamento de recursos entre origens (CORS).

---

## 1. Cookies HTTP

Cookies são pequenos pares `nome=valor` armazenados pelo navegador e enviados automaticamente ao servidor em requisições correspondentes.

### Como funciona o fluxo
1. O servidor responde com o header `Set-Cookie`:
   ```http
   Set-Cookie: refresh_token=abc123; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=604800
   ```
2. Nas próximas requisições compatíveis com `Domain`, `Path` e política `SameSite`, o navegador anexa automaticamente:
   ```http
   Cookie: refresh_token=abc123
   ```

### Atributos de segurança essenciais

| Atributo | O que faz | Por que usar |
| --- | --- | --- |
| `HttpOnly` | Impede acesso via `document.cookie` no JavaScript | Protege o token contra roubo em caso de **XSS** |
| `Secure` | Só envia o cookie em conexões **HTTPS** | Impede interceptação em rede HTTP aberta (exceção: navegadores aceitam em `localhost` ou desligue apenas em dev HTTP) |
| `SameSite=Lax` | Envia em navegação normal (links), bloqueia em `POST`/`fetch` vindos de outro site | Boa defesa padrão contra **CSRF** |
| `SameSite=Strict` | Nunca envia quando a requisição parte de outro site | Máxima proteção CSRF, mas pode quebrar retorno de links externos |
| `SameSite=None; Secure` | Envia mesmo em requisições *cross-site* | Só use se front-end e API estiverem em domínios distintos e com HTTPS + proteção extra contra CSRF |
| `Path=/api/auth` | Restringe para quais rotas o navegador envia o cookie | Reduz superfície: o refresh token não trafega em toda requisição de imagem ou vitrine |
| `Max-Age` / `Expires` | Define validade em segundos/data | Sem eles, vira cookie de sessão (apagado ao fechar o navegador) |

### Padrão recomendado para autenticação Web
- **Access Token (JWT curto, ex.: 15 min):** mantido em memória no front-end e enviado no header `Authorization: Bearer ...` (não vulnerável a CSRF automático).
- **Refresh Token (longo):** mantido em **cookie `HttpOnly`**, com `Path` restrito à rota de renovação/logout, e rotacionado/invalidado no servidor no logout.

---

## 2. CORS (Cross-Origin Resource Sharing)

### O que é uma "Origem"?
Uma origem é a combinação exata de:
`esquema (http/https) + host (domínio) + porta`

Exemplos comparados com `https://app.desapego.com`:
- `https://app.desapego.com/catalogo` → **Mesma origem** (*Same-Origin*)
- `http://app.desapego.com` → **Origem diferente** (esquema mudou)
- `https://api.desapego.com` → **Origem diferente** (subdomínio mudou)
- `https://app.desapego.com:8443` → **Origem diferente** (porta mudou)

### Same-Origin Policy (SOP)
Por padrão, o navegador **impede que scripts em uma origem leiam respostas de outra origem**. O CORS é o mecanismo de headers HTTP pelo qual o **servidor destino** informa ao navegador quais origens têm permissão para ler a resposta.

> **Importante:** CORS é aplicado **pelo navegador**. Ferramentas como `curl`, Postman e chamadas servidor-a-servidor não aplicam CORS — portanto, **CORS nunca substitui autenticação ou autorização no servidor**.

### Requisição Simples vs Preflight (`OPTIONS`)

Uma requisição dispara **preflight** (`OPTIONS` automático antes da chamada real) sempre que NÃO for "simples" — por exemplo, quando usa:
- Métodos diferentes de `GET`, `HEAD` ou `POST` (como `PUT`, `PATCH`, `DELETE`).
- `Content-Type` diferente de `text/plain`, `application/x-www-form-urlencoded` ou `multipart/form-data` (ex.: `application/json` **dispara preflight!**).
- Headers customizados como `Authorization`, `X-API-Key`.

### Headers principais de CORS

**Enviados pelo navegador:**
- `Origin: https://app.desapego.com`
- No preflight: `Access-Control-Request-Method: PUT` e `Access-Control-Request-Headers: authorization, content-type`

**Respondidos pelo servidor:**
- `Access-Control-Allow-Origin: https://app.desapego.com` (ou `*` apenas para APIs públicas **sem** credenciais)
- `Vary: Origin` (obrigatório quando `Allow-Origin` muda conforme quem pede, para não envenenar caches)
- `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Authorization, Content-Type`
- `Access-Control-Allow-Credentials: true` (necessário se o front envia cookies/`credentials: "include"`)
- `Access-Control-Max-Age: 600` (cacheia o preflight no navegador por 10 min)

### Armadilhas mais comuns (e como corrigir)

1. **`Access-Control-Allow-Origin: *` + `credentials: "include"`**
   - Navegadores **proíbem** curinga `*` quando há credenciais/cookies. É preciso devolver exatamente a origem validada na lista permitida (`origens.includes(origin)`).
2. **Esquecer `Vary: Origin`**
   - Um proxy/CDN pode cachear a resposta com o `Allow-Origin` do primeiro domínio e quebrar o segundo.
3. **Upload direto ao Storage (Supabase / S3) falhando no `PUT`/`POST`**
   - O navegador faz a requisição **direto** para o domínio do storage! Portanto:
     - O bucket precisa ter regra de **CORS** liberando a origem do site, o método (`PUT` ou `POST`) e os headers usados (`Content-Type`).
     - A **CSP** (`connect-src`) do front-end também precisa liberar o domínio do storage, senão o próprio navegador bloqueia antes mesmo do CORS.
4. **Proxy *same-origin* como alternativa limpa**
   - Em vez de expor `api.exemplo.com` com CORS complexo e cookies *third-party*, configure rewrites no servidor do front-end (`/api/*` → backend interno). Assim o navegador vê tudo na mesma origem (`same-origin`), eliminando preflights de CORS e tornando cookies `first-party`.

### Checklist de debug com `curl`
Simule um preflight exatamente como o navegador faz:
```bash
curl -i -X OPTIONS https://sua-api.com/anuncios \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization, content-type"
```
Verifique se a resposta traz `204` (ou `200`), `Access-Control-Allow-Origin` exato, `Access-Control-Allow-Methods` e `Access-Control-Allow-Headers` cobrindo o que foi pedido.
