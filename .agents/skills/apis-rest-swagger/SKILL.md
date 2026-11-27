---
name: apis-rest-swagger
description: >-
  Guia prático e didático de design de APIs REST e documentação OpenAPI/Swagger
  (3.0 e 3.1). Use esta skill ao projetar novos endpoints REST, padronizar
  rotas/paginação/erros, escrever ou atualizar arquivos openapi.yaml/Swagger ou
  estudar boas práticas de contratos de API.
---

# APIs REST e Documentação Swagger (OpenAPI)

Skill para **projetar APIs REST consistentes** e **documentar contratos em OpenAPI/Swagger** com clareza, alinhando código, validação e documentação.

## Quando usar

- Ao criar ou alterar endpoints HTTP (rotas, query params, payloads, status codes e erros).
- Ao escrever, revisar ou manter especificações OpenAPI (`docs/openapi.yaml` / Swagger).
- Ao definir esquemas de autenticação (`Bearer JWT`, `API Key`, cookies) na documentação.
- Ao estudar ou revisar padrões RESTful e sintaxe OpenAPI 3.0 / 3.1.

## Fluxo de trabalho

1. **Definir o contrato REST antes (ou junto) do código:** identifique o recurso, o método HTTP semântico, os query/path params, os campos obrigatórios e todas as respostas possíveis (`2xx` e `4xx`).
2. **Aplicar o checklist abaixo** ao endpoint e ao `openapi.yaml`.
3. **Consultar as referências:**
   - Design RESTful, URLs, paginação, filtros, erros e versionamento: [Boas Práticas de APIs REST](./references/rest-boas-praticas.md)
   - Estrutura OpenAPI 3.0/3.1, Swagger UI, `$ref`, `securitySchemes` e exemplos completos: [Guia Prático de OpenAPI e Swagger](./references/openapi-swagger-guia.md)

## Checklist rápido de REST + OpenAPI/Swagger

### Design REST
- **Substantivos no plural para coleções:** `/pecas`, `/anuncios`, `/pedidos` (evite verbos na URL como `/criarAnuncio` ou `/getPecas`).
- **Ações de transição explícitas:** quando uma mudança de estado tem regra própria, prefira sub-recurso `POST` (ex.: `POST /anuncios/{id}/pausar`, `POST /pedidos/{id}/enviar`) em vez de um `PUT` genérico.
- **Filtros, busca, ordenação e paginação via query string** em `GET` (ex.: `GET /pecas?categoria=bolsas&ordem=menor_preco&pagina=1&porPagina=20`).
- **Unidades e formatos sem ambiguidade:** dinheiro em centavos inteiros (`precoCentavos`), datas em ISO-8601 (`date-time`), identificadores consistentes (`id`).

### Documentação OpenAPI / Swagger
- **Metadados completos:** `openapi` (`3.1.0` ou `3.0.3`), `info` (`title`, `version`, `description`), `servers` (dev e produção) e `tags` por domínio.
- **Zero duplicação via `$ref`:** extraia objetos, enums, parâmetros comuns e respostas de erro para `components/schemas`, `components/parameters` e `components/responses`.
- **Segurança explícita:** declare `components/securitySchemes` (`bearer` JWT, `apiKey`, `cookie`) e marque `security` em cada rota protegida (e o que ela retorna com `401` e `403`).
- **Todas as respostas documentadas:** não liste só `200`/`201`; documente `400`, `401`, `403`, `404` e `409` conforme as regras reais da rota.
- **Sincronia com o código:** campos `required`, enums, limites (`minLength`, `maxLength`, `minimum`) e status codes no YAML devem bater 100% com o validador do servidor (ex.: Zod) e nunca prometer dados sensíveis ocultos (ex.: senha, CPF completo, chave Pix inteira).
