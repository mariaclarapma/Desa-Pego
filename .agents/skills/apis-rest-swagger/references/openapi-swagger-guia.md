# Guia Prático de OpenAPI e Swagger

Referência prática e didática para escrever, organizar e manter especificações **OpenAPI 3.0 / 3.1** (ecossistema **Swagger**).

---

## 1. OpenAPI vs Swagger: qual a diferença?

- **OpenAPI Specification (OAS):** é o **padrão aberto** (arquivo `openapi.yaml` ou `openapi.json`) que descreve uma API REST de forma legível por humanos e máquinas.
- **Swagger:** é o conjunto de ferramentas em torno da especificação:
  - **Swagger UI:** interface web interativa onde desenvolvedores exploram rotas e testam requisições ("Try it out").
  - **Swagger Editor:** editor com validação em tempo real da sintaxe OpenAPI.
  - **Codegen / OpenAPI Generator:** gera clientes TypeScript, tipos e mocks a partir do YAML.

---

## 2. Anatomia de um `openapi.yaml` (3.1.0)

```yaml
openapi: 3.1.0
info:
  title: Minha API
  version: 1.0.0
  description: Visão geral de autenticação, unidades e convenções.

servers:
  - url: http://localhost:3000/api
    description: Desenvolvimento (proxy local)
  - url: https://api.exemplo.com/api
    description: Produção

tags:
  - name: anuncios
    description: Criação e gestão de anúncios

paths:
  /anuncios:
    post:
      tags: [anuncios]
      operationId: criarAnuncio
      summary: Publicar novo anúncio
      description: Exige login e chave Pix cadastrada.
      security:
        - token: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/NovoAnuncio"
      responses:
        "201":
          description: Anúncio criado
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Anuncio"
        "400":
          $ref: "#/components/responses/ErroValidacao"
        "401":
          $ref: "#/components/responses/NaoAutenticado"
        "403":
          description: Conta sem chave Pix ou perfil de vendedora

components:
  securitySchemes:
    token:
      type: http
      scheme: bearer
      bearerFormat: JWT
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key

  responses:
    ErroValidacao:
      description: Campos inválidos
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErroCampos"
    NaoAutenticado:
      description: Token ausente ou inválido
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErroSimples"

  schemas:
    ErroSimples:
      type: object
      required: [erro]
      properties:
        erro: { type: string }
    ErroCampos:
      type: object
      required: [erro]
      properties:
        erro: { type: string }
        campos:
          type: object
          additionalProperties: { type: string }
```

---

## 3. OpenAPI 3.0 vs OpenAPI 3.1 (atenção à sintaxe!)

| Recurso | OpenAPI 3.0.x | OpenAPI 3.1.0 (compatível com JSON Schema 2020-12) |
| --- | --- | --- |
| **Campo anulável** | `type: string` + `nullable: true` | `type: [string, "null"]` (ou `oneOf` com `{ type: "null" }`) |
| **Exemplos no schema** | `example: "bolsas"` (singular) | `examples: ["bolsas"]` (array; `example` ainda funciona em alguns casos) |
| **Webhooks fora de `paths`** | Não existia campo dedicado | Campo top-level `webhooks:` |

> **Dica:** nunca misture `nullable: true` (3.0) em um arquivo marcado como `openapi: 3.1.0` — validadores estritos rejeitam.

---

## 4. Recursos essenciais para documentação de qualidade

### 1. Reutilização com `$ref`
- Parâmetros repetidos (`id`, `pagina`, `status`) → `components/parameters`.
- Modelos de entrada/saída (`Anuncio`, `Pedido`) → `components/schemas`.
- Respostas padrão (`400`, `401`, `403`, `404`) → `components/responses`.

### 2. Autenticação bem definida (`securitySchemes`)
- **Bearer JWT:** `type: http`, `scheme: bearer`, `bearerFormat: JWT`.
- **API Key interna:** `type: apiKey`, `in: header`, `name: X-API-Key`.
- **Cookie de sessão:** `type: apiKey`, `in: cookie`, `name: refresh_token`.
- Coloque `security: [...]` apenas nas rotas que realmente exigem autenticação (ou use `security` global e sobrescreva rotas públicas com `security: []`).

### 3. Restrições e exemplos úteis
Documente os mesmos limites que o back-end aplica (`minLength`, `maxLength`, `minimum`, `maximum`, `minItems`, `maxItems`, `enum`, `format: uuid | date-time | email`):
```yaml
precoCentavos:
  type: integer
  minimum: 1
  description: Preço da peça em centavos inteiros (maior que zero).
  examples: [8990]
```

### 4. Boas práticas com Swagger UI em produção
- Se servir o **Swagger UI** em uma rota como `/docs`, **desative ou proteja** em produção caso a API seja privada/interna, e nunca embuta tokens reais de admin nos exemplos.
- Mantenha a política **CSP** compatível se hospedar Swagger UI no mesmo domínio (ele costuma exigir estilos/scripts próprios).

---

## 5. Como manter o Swagger sincronizado com o código

Existem duas abordagens principais:
1. **Spec-first (contrato primeiro):** você edita `docs/openapi.yaml`, revisa o contrato no PR com o time (front + back) e implementa o código respeitando o contrato.
2. **Code-first (gerado do código):** anotações/decorators (ex.: `@nestjs/swagger` ou `zod-to-openapi`) geram o JSON/YAML automaticamente a partir dos DTOs/schemas Zod.

### Checklist de sincronia em Pull Requests
Sempre que criar ou alterar uma rota no back-end, confira no `openapi.yaml`:
- [ ] Caminho e método HTTP existem e batem com o router real (considerando prefixo `/api` se houver proxy).
- [ ] Campos obrigatórios (`required`), opcionais/anuláveis e `enum` batem com a validação (`zod`/DTO).
- [ ] Todos os status codes lançados no código (`200/201/204/400/401/403/404/409`) estão listados.
- [ ] Nenhum campo sensível omitido pela API (senha, CPF, chave Pix aberta) aparece nos schemas de resposta.
