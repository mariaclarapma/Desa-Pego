# Testes de Contas e Perfil (Issue 003, Módulo 01)

Este documento liga cada critério da Issue 003 aos testes que o cobrem. Os testes foram escritos junto com as
Issues 001 (cadastro com CPF) e 002 (perfil de vendedora com chave Pix) e rodam na CI a cada PR
(`.github/workflows/ci.yml`: "Lint e testes" e "E2E (Cypress) e acessibilidade").

## Como rodar

```bash
npm test                 # backend e frontend (Vitest), com banco em memória
npm run e2e              # navegador (Cypress + axe); não rode com o `npm run dev` ligado
```

## Critério 1: cadastro válido, e-mail duplicado, CPF duplicado e CPF inválido

| Caso | Testes |
| --- | --- |
| Cadastro válido | `backend/contas/src/cpf.test.ts` ("CPF válido: cria a conta e guarda só o hash e a cifra"), `backend/contas/src/app.test.ts` ("cria a conta, guarda só o hash Argon2id…"), `frontend/cypress/e2e/autenticacao.cy.ts` ("cadastro abre a sessão e leva para /conta") |
| E-mail duplicado | `app.test.ts` ("rejeita e-mail repetido, sem diferenciar maiúsculas"), `cpf.test.ts` ("e-mail repetido continua com a mensagem de e-mail"), `autenticacao.cy.ts` ("e-mail repetido não cria outra conta") |
| CPF duplicado | `cpf.test.ts`: CPF já cadastrado em qualquer formato (409), duas tentativas simultâneas, corrida barrada pela restrição `UNIQUE` e `UNIQUE` direto no banco; `autenticacao.cy.ts` ("CPF repetido recusado sem criar outra conta") |
| CPF inválido | `backend/comum/cpf.test.ts` (quantidade de dígitos, dígitos verificadores, sequências repetidas, letras, vazio); `cpf.test.ts` (400 com erro no campo, sem criar a conta); `frontend/src/lib/validacao-conta.test.ts` e `frontend/src/components/conta/PaginaConta.test.tsx` (máscara e erro no formulário) |

Além disso, `cpf.test.ts` confere que o CPF não aparece em texto puro no banco, nas respostas, no token nem nos logs.

## Critério 2: login válido, inválido e bloqueio após tentativas em excesso

| Caso | Testes |
| --- | --- |
| Login válido | `app.test.ts` ("entra com e-mail … e senha corretos"), `cpf.test.ts` ("entra, renova, sai e não renova mais"), `autenticacao.cy.ts` ("login com a senha certa entra…") |
| Login inválido | `app.test.ts` ("usa a mesma mensagem para senha errada e e-mail inexistente"), `PaginaConta.test.tsx` ("mensagem genérica para credenciais inválidas"), `autenticacao.cy.ts` ("…com a errada mostra mensagem genérica") |
| Bloqueio | `app.test.ts` ("bloqueia por 15 minutos depois de 5 tentativas erradas": a 6ª tentativa, mesmo com a senha certa, recebe 429); também na troca de senha (`crud.test.ts`) e no cadastro da chave Pix (`vendedora.test.ts`) |

## Critério 3: chave Pix por tipo, exibição mascarada e bloqueio de anúncio sem chave

| Caso | Testes |
| --- | --- |
| Chave válida, por tipo | `backend/comum/chave-pix.test.ts` ("validação por tipo"): CPF, e-mail, telefone (3 formatos) e aleatória, com a chave normalizada |
| Chave inválida, por tipo | `chave-pix.test.ts`: CPF (dígito errado, sequência, 10 dígitos, letras), e-mail (sem domínio, sem @, longo demais, vazio), telefone (fixo, DDD inválido, sem DDD) e aleatória (sem traços, texto qualquer); `vendedora.test.ts` (400 e nada é salvo); `frontend/src/lib/validacao-vendedora.test.ts` e `PaginaVendedora.test.tsx` (formulário) |
| Exibição mascarada | `chave-pix.test.ts` ("máscara", um caso por tipo); `vendedora.test.ts` (a API devolve só a máscara); `PaginaVendedora.test.tsx` ("com chave: mostra só a máscara"); `frontend/cypress/e2e/vendedora-pix.cy.ts` ("a API nunca devolve a chave completa…") |
| Bloqueio de anúncio sem chave | `chave-pix.test.ts` ("regra para o Módulo 02"): `podeAnunciar` e o middleware `exigirChavePix` (sem chave: 403; com chave: passa; sem login: 401); `vendedora.test.ts` (o token só ganha `temChavePix` depois de cadastrar a chave) |

## Pendência fora do Módulo 01

A rota de publicar anúncio ainda não existe: ela é da Issue 004 (Módulo 02). Por isso o bloqueio é testado na regra
(`exigirChavePix` em `backend/comum/autenticacao.ts`), e não numa publicação de verdade. Quando a Issue 004 criar a
rota, ela deve usar `exigirLogin(segredo), exigirChavePix` (exemplo em `docs/CHAVE-PIX.md`) e ter um teste que tenta
publicar sem chave Pix e recebe 403.
