---
name: seguranca-aplicacao-entrada-segredos
description: >-
  Guia prático e didático de segurança de aplicação focado em validação de
  entrada (Zod, allowlists, anti-mass-assignment, query/params/uploads) e gestão
  de segredos (.env, variáveis públicas vs privadas, fail-fast, rotação e
  gitleaks). Use esta skill ao criar schemas de validação de rotas, tratar
  inputs/uploads, configurar variáveis de ambiente ou revisar exposição de
  chaves e tokens.
---

# Segurança de Aplicação: Validação de Entrada e Gestão de Segredos

Skill para **blindar a borda da aplicação contra entradas maliciosas** e **evitar exposição de chaves, senhas e credenciais** em código, logs, front-end e Git.

## Quando usar

- Ao criar ou revisar endpoints (`req.body`, `req.query`, `req.params`, `req.headers`, uploads).
- Ao definir schemas de validação (ex.: `zod`) e mensagens de erro da API.
- Ao adicionar novas variáveis de ambiente (`.env`, `.env.example`, `render.yaml`, CI/CD).
- Ao revisar se alguma chave privada pode vazar no cliente (`NEXT_PUBLIC_*`), logs ou commits.

## Fluxo de trabalho

1. **Mapear entradas e segredos:** identifique tudo que vem de fora (usuário, URL, arquivo, webhook) e todas as credenciais necessárias no servidor.
2. **Aplicar o checklist abaixo** antes de salvar ou aprovar a mudança.
3. **Consultar as referências:**
   - Schemas na borda, *allowlist*, *mass assignment*, limites e uploads: [Validação de Entrada Segura](./references/validacao-de-entrada.md)
   - Classificação, armazenamento por ambiente, *fail-fast*, rotação e `gitleaks`: [Gestão de Segredos](./references/gestao-de-segredos.md)

## Checklist rápido

### Validação de Entrada
- **Valide 100% na borda do servidor:** trate `body`, `query`, `params` e `headers` como não confiáveis; o front-end nunca é barreira de segurança.
- **Prefira *allowlist* a *blocklist*:** aceite apenas tipos, enums, faixas numéricas e formatos esperados (em vez de tentar filtrar caracteres ruins).
- **Evite *Mass Assignment*:** nunca passe `req.body` direto para `Object.assign`, `INSERT` ou `prisma.model.update({ data: req.body })`; extraia somente os campos validados pelo schema.
- **Imponha limites:** defina `max` em strings, tamanho máximo de arrays, teto em `porPagina` e limite em bytes de arquivos para evitar abuso de memória/DoS.
- **Normalize antes de validar:** aplique `trim()`, remova máscara de CPF/CEP ou padronize e-mail conforme a regra, mantendo coerência entre front e back.

### Gestão de Segredos
- **Nunca exponha segredos ao navegador:** chaves secretas (`DATABASE_URL`, `JWT_SECRET`, `SUPABASE_SECRET_KEY`, `API_KEYS`) ficam só no servidor; nunca use prefixo público (`NEXT_PUBLIC_*`) para segredo.
- **Fail fast em produção:** se uma variável secreta obrigatória faltar (ou for curta/fraca) com `NODE_ENV === "production"`, aborte a subida do servidor — nunca use valor padrão fraco em produção.
- **Separe chaves por finalidade:** não reutilize a mesma chave para JWT, HMAC de CPF e AES de Pix.
- **Zero segredo no Git e nos logs:** mantenha `.env` no `.gitignore`, documente só nomes/exemplos fictícios no `.env.example`, rode scanner (`gitleaks`) na CI e nunca logue tokens, senhas ou `Authorization`.
