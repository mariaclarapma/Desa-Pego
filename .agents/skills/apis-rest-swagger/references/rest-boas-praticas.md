# Boas Práticas de APIs REST

Referência prática e didática para modelar recursos, rotas, parâmetros, respostas e evolução de APIs REST.

---

## 1. Fundamentos REST na prática

REST (*Representational State Transfer*) organiza a API em torno de **recursos** identificados por URLs e manipulados pelos **métodos padrão do HTTP**:
- **Recurso:** substantivo do domínio (`/pecas`, `/anuncios`, `/pedidos`).
- **Stateless (sem estado de sessão no servidor):** cada requisição carrega tudo o que precisa para ser entendida (ex.: token `Authorization: Bearer ...`, parâmetros, corpo).
- **Interface uniforme:** mesmas convenções de métodos, status codes e formato de erro em toda a API.

---

## 2. Convenções de URLs e ações

### Coleções e itens
- Coleção: `GET /anuncios` (listar) | `POST /anuncios` (criar)
- Item específico: `GET /anuncios/{id}` | `PUT /anuncios/{id}` (substituir) | `PATCH /anuncios/{id}` (atualizar parcial) | `DELETE /anuncios/{id}`

### Sub-recursos (relacionamentos e ações de negócio)
- **Relacionamento:** `GET /pedidos/{id}/historico` ou `POST /anuncios/fotos`.
- **Transição de estado / comando:** quando não é uma edição livre de campos, modele como ação explícita em `POST`:
  - `POST /anuncios/{id}/pausar`
  - `POST /anuncios/{id}/reativar`
  - `POST /pedidos/{id}/confirmar-recebimento`
  Isso deixa claro que existe uma máquina de estados validada no servidor (e não um campo booleano editado diretamente).

### O que evitar em URLs
- Verbos CRUD na rota: `/buscarPecas`, `/deleteAnuncio`, `/createOrder`.
- Misturar singular e plural sem padrão (`/peca` e `/anuncios`).
- Aninhamento profundo desnecessário (`/vendedoras/{vId}/lojas/{lId}/anuncios/{aId}/fotos/{fId}`): prefira manter no máximo 2 níveis e usar `/fotos/{chave}` ou query params.

---

## 3. Paginação, filtros, busca e ordenação

Em listagens públicas ou grandes, **sempre pagine** para proteger memória, banco e tempo de resposta:
- **Paginação por página (*offset*):** simples para vitrines com número de páginas (`?pagina=1&porPagina=20`). A resposta devolve metadados:
  ```json
  {
    "itens": [],
    "total": 42,
    "pagina": 1,
    "porPagina": 20,
    "totalPaginas": 3
  }
  ```
- **Paginação por cursor:** ideal para feeds infinitos e alto volume com muitas inserções simultâneas (`?cursor=...&limite=20`).
- **Limites máximos:** o servidor deve impor teto (ex.: `porPagina <= 48` ou `100`) para ninguém derrubar o banco pedindo `porPagina=1000000`.
- **Ordenação explícita:** use valores fechados (enum), ex.: `ordem=recentes | menor_preco | maior_preco`.

---

## 4. Padronização de payloads e erros

### Payload de dados
- **Nomenclatura única:** escolha um padrão no JSON (ex.: `camelCase` como `precoCentavos`, `criadoEm`) e siga em todas as rotas.
- **Datas e dinheiro:**
  - Datas em string ISO-8601 UTC (`"2026-11-26T20:00:00.000Z"`).
  - Valores financeiros em centavos inteiros (`8990` para R$ 89,90).
- **Retorno de `POST` / `PUT`:** devolva o recurso criado/atualizado com seu `id` gerado e estado atual, ou `204 No Content` em `DELETE`.

### Formato consistente de erro
Defina um formato único para que o front-end trate erros de forma previsível:
```json
{
  "erro": "alguns campos precisam de ajuste.",
  "campos": {
    "precoCentavos": "o preço precisa ser maior que zero.",
    "fotos": "envie pelo menos 1 foto."
  }
}
```
- Mensagem legível e segura para o usuário final.
- **Nunca** exponha queries SQL, nomes de tabelas internas ou *stack traces*.

---

## 5. Evolução e versionamento

- **Mudanças compatíveis (*non-breaking*):** adicionar um campo opcional novo na resposta ou um query param opcional novo na requisição **não** quebra clientes antigos.
- **Mudanças incompatíveis (*breaking*):** remover campo, renomear chave JSON, mudar tipo (`string` → `number`) ou tornar opcional em obrigatório exige coordenação ou versionamento explícito na URL (`/api/v2/...`) ou por cabeçalho.
