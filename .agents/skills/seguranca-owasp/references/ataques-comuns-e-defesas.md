# Ataques Comuns e Defesas (Vulnerável vs Seguro)

Exemplos práticos e didáticos dos ataques mais cobrados e encontrados em revisão de código Web/Back-end.

---

## 1. SQL Injection (SQLi)

**Como funciona:** o atacante envia caracteres SQL (ex.: `' OR '1'='1`) em um campo de busca ou ID; se a query concatenar strings, ele altera a lógica do comando SQL.

- **Vulnerável:**
  ```ts
  const sql = `SELECT * FROM tbl_001_usuarios WHERE email = '${req.body.email}'`;
  await db.query(sql);
  ```
- **Seguro (consulta parametrizada / ORM):**
  ```ts
  // PostgreSQL com pg
  await db.query("SELECT id, nome FROM tbl_001_usuarios WHERE email = $1", [req.body.email]);

  // Prisma (template tag parametrizada ou método tipado)
  await prisma.usuario.findUnique({ where: { email: req.body.email }, select: { id: true, nome: true } });
  ```
- **Regra:** jamais interpole variáveis dentro de SQL (`${x}`) nem use `$queryRawUnsafe`.

---

## 2. XSS (Cross-Site Scripting)

**Como funciona:** o atacante injeta JavaScript malicioso (em um comentário, título de anúncio ou query da URL) que executa no navegador de outra pessoa, podendo roubar dados da página ou agir em nome dela.

### Tipos
- **Armazenado (Stored):** script salvo no banco (ex.: descrição de produto) e exibido a todos os visitantes.
- **Refletido (Reflected):** script vem na URL (`?busca=<script>...`) e o servidor ecoa no HTML sem escapar.
- **DOM-based:** JavaScript do próprio cliente lê `location.search` e escreve via `innerHTML`.

### Como evitar
- **Vulnerável:**
  ```tsx
  <div dangerouslySetInnerHTML={{ __html: anuncio.descricao }} />
  <a href={urlDoUsuario}>ver site</a> // se urlDoUsuario = "javascript:alert(1)"!
  ```
- **Seguro:**
  1. Renderize como texto puro (`<p>{anuncio.descricao}</p>` — React/JSX escapa automaticamente).
  2. Se precisar de HTML rico, sanitize com biblioteca confiável (ex.: `DOMPurify`) antes.
  3. Em links dinâmicos, valide protocolo (`url.startsWith("https://") || url.startsWith("http://")`).
  4. Configure **CSP** (`script-src 'self' ...`, `object-src 'none'`) e guarde tokens sensíveis em cookies **`HttpOnly`** para que nem mesmo um XSS consiga lê-los via `document.cookie`.

---

## 3. CSRF (Cross-Site Request Forgery)

**Como funciona:** o usuário está logado no Site A (com cookie de sessão). Ao visitar um Site B malicioso, o Site B dispara um formulário oculto ou requisição para `POST https://site-a.com/conta/excluir`, e o navegador envia o cookie do Site A automaticamente!

### Como evitar
1. **Use `SameSite=Lax` (ou `Strict`) nos cookies:** impede o navegador de enviar o cookie em `POST`/formulários disparados de outro domínio.
2. **Não use `GET` para alterar estado:** operações que criam, editam, pausam ou apagam devem usar `POST`/`PUT`/`PATCH`/`DELETE`.
3. **Autenticação via Header `Authorization: Bearer ...`:** navegadores não anexam headers customizados automaticamente em requisições de terceiros (e ainda exigem preflight CORS).
4. **Quando usar cookie em APIs tradicionais:** valide o header `Origin` / `Referer` ou use token anti-CSRF (*Synchronizer Token* / *Double Submit Cookie*).

---

## 4. IDOR / Broken Object Level Authorization (BOLA)

**Como funciona:** um usuário autenticado troca o ID na URL (`DELETE /anuncios/abc` → `DELETE /anuncios/xyz`) e consegue alterar/ler o recurso de outro usuário.

- **Vulnerável:**
  ```ts
  app.delete("/anuncios/:id", exigirLogin, async (req, res) => {
    await repo.excluir(req.params.id); // não checou quem é o dono!
    res.status(204).end();
  });
  ```
- **Seguro:**
  ```ts
  app.delete("/anuncios/:id", exigirLogin, async (req, res) => {
    const anuncio = await repo.buscar(req.params.id);
    if (!anuncio) return res.status(404).json({ erro: "anúncio não encontrado." });
    if (anuncio.vendedoraId !== res.locals.usuaria.id) {
      return res.status(403).json({ erro: "esse anúncio é de outra pessoa." });
    }
    await repo.excluir(anuncio.id);
    res.status(204).end();
  });
  ```

---

## 5. Upload de Arquivos e Path Traversal

**Como funciona:** atacante envia um `.html`/`.exe` renomeado para `.jpg`, um arquivo gigante para derrubar memória/disco, ou um nome como `../../.env` para sobrescrever arquivos do servidor.

### Como evitar
- **Não use o nome original do arquivo** para salvar: gere uma chave nova (`randomUUID()` + extensão permitida) e valide contra regex estrita (`/^[0-9a-f-]{36}\.(jpg|png|webp)$/`).
- **Valide conteúdo real:** confira tamanho em bytes e assinatura dos primeiros bytes (*magic bytes*), não só `Content-Type` ou extensão.
- **Sirva com segurança:** use `X-Content-Type-Options: nosniff` e bucket separado / domínio isolado para conteúdo enviado por usuários.

---

## 6. SSRF e Comparação de Assinaturas

- **SSRF:** se o servidor precisar consultar uma URL externa (ex.: busca de CEP), monte a URL a partir de um host fixo (`https://viacep.com.br/ws/${cep}/json/` após validar `cep` com `/^\d{8}$/`), nunca aceite URL arbitrária do cliente.
- **Comparação de segredos/HMAC:** use `crypto.timingSafeEqual(a, b)` (conferindo `a.length === b.length` antes) para evitar *timing attacks*.
