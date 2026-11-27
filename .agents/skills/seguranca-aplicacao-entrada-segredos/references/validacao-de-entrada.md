# Validação de Entrada Segura

Referência prática e didática para validar dados na entrada da aplicação sem brechas de tipo, lógica ou abuso de recursos.

---

## 1. Princípios fundamentais

1. **Toda entrada externa é não confiável:** incluindo campos ocultos de formulário, `select` com opções fixas no front-end, `req.params`, `req.query`, headers customizados e metadados de arquivo.
2. **Allowlist > Blocklist:**
   - *Blocklist* ("rejeitar `<script>` ou `admin`") sempre deixa passar variações.
   - *Allowlist* ("aceitar apenas `["feminino", "masculino", "calcados", "bolsas", "acessorios"]` e `int > 0`") fecha a porta na raiz.
3. **Falhar cedo e com erro útil:** valide na entrada da rota e devolva `400` (ou `422`) com o campo problemático, sem executar regra de negócio nem query no banco antes disso.

---

## 2. Schema Validation (`zod`) e Anti-Mass Assignment

### O perigo do *Mass Assignment*
```ts
// Vulnerável: se o cliente mandar { "perfil": "ADMIN_MASTER", "status": "pago" }, ele altera tudo!
await repo.atualizar(id, req.body);
```

### Jeito seguro (whitelist explícita pelo schema)
```ts
const esquemaEditarAnuncio = z.object({
  titulo: z.string().trim().min(1, "informe o título.").max(100),
  descricao: z.string().trim().min(1, "informe a descrição.").max(2000),
  categoria: z.enum(["feminino", "masculino", "calcados", "bolsas", "acessorios"]),
  precoCentavos: z.number().int().positive().max(100_000_000),
});

// `dados` contém APENAS as 4 propriedades validadas (extras são descartadas)
const dados = esquemaEditarAnuncio.parse(req.body);
```
> **Dica:** use `.strict()` quando quiser rejeitar explicitamente campos desconhecidos em vez de apenas ignorá-los, conforme a política da API.

---

## 3. O que validar em cada ponto da requisição

| Origem | O que validar | Armadilha comum |
| --- | --- | --- |
| **`req.body` (JSON)** | Tipos exatos (`number` vs `"8990"`), limites `min`/`max`, enums fechados, tamanho de arrays (`min 1`, `max 5`), duplicidade (`new Set(f).size === f.length`) | Confiança em `typeof` sem checar `NaN`, `Infinity`, float ou número negativo |
| **`req.params`** | Formato do ID (UUID ou `/^[\w-]+$/` com tamanho máximo) | Passar ID com `../` ou caracteres inesperados para caminho de arquivo ou log |
| **`req.query`** | Paginação com `min(1)` e `max(48)` (teto!), `ordem` em enum fechado | Query string virar `string[]` (ex.: `?busca=a&busca=b` no Express) e quebrar `.trim()` |
| **`Content-Type` e corpo** | Limite de tamanho do body (`express.json({ limit: "100kb" })`) | Receber JSON gigante de dezenas de MB e travar o event loop |
| **Uploads** | Tipo MIME permitido, tamanho em bytes, assinatura (*magic bytes*) e posse | Confiar só na extensão `.png` ou no `Content-Type` declarado pelo navegador |

### Cuidado clássico no Express: `req.query.campo` pode ser array!
Se alguém chamar `/pecas?busca=vestido&busca=saia`, no Express `req.query.busca` pode chegar como `string[]` em vez de `string`. Validar com `z.string()` (ou tratar `Array.isArray`) evita `TypeError: busca.trim is not a function` (`500`).

---

## 4. Normalização e regras de negócio

- **Ordem correta:** **normalizar → validar formato → aplicar regra de negócio**.
  - Ex. e-mail: `trim().toLowerCase()` antes de validar e consultar no banco.
  - Ex. CPF/CEP: remover pontuação se aceita máscara, validar comprimento e dígitos verificadores.
- **Unidades sem erro de conversão:** receba dinheiro em centavos inteiros no contrato da API (`precoCentavos`), validando `Number.isSafeInteger(v) && v > 0`.
- **Diferencie erro de formato (`400`) de erro de regra/estado (`403`/`409`):**
  - Preço `-10` ou falta de título → `400 Bad Request`.
  - Usuário sem chave Pix tentando anunciar → `403 Forbidden`.
  - Peça já reservada/vendida ou e-mail duplicado → `409 Conflict`.
