# Fluxo Front-end ↔ Back-end e Refresh Token

Referência prática e didática do ciclo completo de comunicação autenticada entre o navegador (Next.js/React) e a API.

---

## 1. Fluxo completo passo a passo

### A. Login (`POST /api/auth/login`)
1. Front-end envia `{ email, senha }` (via HTTPS / proxy `/api`).
2. Back-end valida credenciais (`Argon2id`), gera:
   - **Access Token (JWT, ~15 min)** → devolvido no corpo JSON `{ accessToken, usuaria }`.
   - **Refresh Token (aleatório opaco ou JWT com `jti`)** → salvo em hash no banco e enviado em cookie:
     `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=604800`
3. Front-end guarda `accessToken` **apenas em memória** (Contexto/Store).

### B. Chamada autenticada normal
- Front-end envia no header:
  ```http
  Authorization: Bearer <accessToken>
  ```
- Não precisa mandar o cookie de refresh nas rotas de negócio (`/anuncios`, `/pedidos`), pois o `Path=/api/auth` já limita o envio automático do cookie!

### C. Reload da página (ou aba nova)
- A memória JS começa vazia (`accessToken === null`).
- Na inicialização da área autenticada, o front-end chama `POST /api/auth/refresh` (mesma origem ou `credentials: "include"`).
- Se o cookie `HttpOnly` ainda for válido no banco, o back-end devolve um novo `accessToken` (e opcionalmente rotaciona o refresh token).
- Se retornar `401`, o usuário realmente não está logado → limpa estado e segue como visitante ou redireciona para `/entrar`.

### D. Expiração durante o uso (`401` + Refresh *Single-Flight*)
Quando o usuário deixa a aba aberta por 20 minutos e clica em algo, a chamada retorna `401`. Se a tela disparar 3 requisições ao mesmo tempo, **não dispare 3 refreshes paralelos** (se houver rotação de refresh token, a 2ª e a 3ª vão falhar porque a 1ª já trocou o token!).

**Padrão *Single-Flight* (uma promessa em voo):**
```ts
let renovacaoEmAndamento: Promise<string | null> | null = null;

export async function renovarAccessToken(): Promise<string | null> {
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = pedirNovoTokenAoServidor().finally(() => {
      renovacaoEmAndamento = null;
    });
  }
  return renovacaoEmAndamento;
}

export async function chamarComToken<T>(operacao: (token: string) => Promise<T>, tokenAtual: string): Promise<T> {
  try {
    return await operacao(tokenAtual);
  } catch (erro) {
    if (!ehErro401(erro)) throw erro;
    const novoToken = await renovarAccessToken();
    if (!novoToken) {
      limparSessaoLocal();
      throw erro;
    }
    // tenta exatamente MAIS UMA vez com o token novo (sem loop infinito)
    return await operacao(novoToken);
  }
}
```

### E. Logout (`POST /api/auth/logout`)
1. Front-end chama `/api/auth/logout`.
2. Back-end revoga o refresh token no banco/Redis **e** responde limpando o cookie (`Max-Age=0` com os mesmos `Path` e flags).
3. Front-end limpa `accessToken` e dados do usuário da memória e redireciona.

---

## 2. Por que usar Proxy *Same-Origin* (`/api/*`) no Front-end?

Quando o front-end (ex.: `Next.js` em `app.exemplo.com`) faz *rewrite* de `/api/auth/*` para o serviço de contas interno:
1. O cookie de refresh é emitido pelo próprio domínio do site (**first-party cookie**), evitando bloqueios crescentes de *third-party cookies* em Safari/Chrome/Firefox.
2. `SameSite=Lax` funciona perfeitamente sem precisar relaxar para `SameSite=None`.
3. A maioria das chamadas nem dispara *preflight* de CORS.

---

## 3. Checklist de debug quando a autenticação falha no Front

- **Cookie não aparece no DevTools → Network:** confira se o front e a API estão na mesma origem (ou usando `credentials: "include"` + `Access-Control-Allow-Credentials: true`), se `Secure` não está ativo em `http://` não-localhost, e se o `Path` do cookie bate com a rota chamada.
- **Refresh funciona, mas a rota seguinte dá `403` após atualizar perfil/Pix:** lembre de atualizar o `accessToken` em memória chamando o refresh logo após a ação que mudou uma claim do JWT (ex.: cadastrar chave Pix).
- **Múltiplas chamadas falham após 15 min:** verifique se o refresh usa *single-flight* (promessa compartilhada) e se o retry em `401` acontece no máximo uma vez.
