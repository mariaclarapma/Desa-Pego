# Como contribuir

Guia de trabalho do grupo do Desa Pego. Os requisitos e critérios de aceitação estão no [REQUISITOS.md](REQUISITOS.md) e as decisões técnicas no [Documento de Arquitetura](docs/ARQUITETURA.md).

## Fluxo de trabalho

1. Pegue sua issue no [quadro do projeto](https://github.com/users/mariaclarapma/projects/2) e mova para **In Progress**.
2. Trabalhe na branch do requisito, no padrão `feature/<numero>-<slug>`:
   ```bash
   git checkout feature/001-cadastro-login
   ```
3. Faça commits pequenos e com mensagens claras.
4. Abra um Pull Request para a `main` usando o template e escreva `Closes #<numero>`. Mova a issue para **Review**.
5. O PR só entra na `main` com **CI verde** e **1 aprovação**.

## Revisão em rodízio

Cada pessoa revisa os PRs do módulo seguinte ao seu. O GitHub pede a revisão automaticamente pelo arquivo `.github/CODEOWNERS`.

```
01 revisa 02  →  02 revisa 03  →  03 revisa 04  →  04 revisa 05  →  05 revisa 01
```

## Definição de pronto

- [ ] critérios de aceitação atendidos
- [ ] validação no backend (o frontend só esconde opções, nunca é a barreira)
- [ ] testes do requisito passando na CI da branch
- [ ] endpoint documentado no OpenAPI (quando houver)
- [ ] revisado por outra integrante

## Regras do grupo

- Cada módulo funciona sozinho. Nos testes, as interfaces de `app/core` são mockadas.
- Não altere `app/core` sem justificativa e aprovação do grupo.
- Nunca suba o `.env` ou chaves. Use o [`.env.example`](.env.example) como modelo. A CI roda o gitleaks para detectar segredos.

## Integração contínua

O workflow [`ci.yml`](.github/workflows/ci.yml) roda em todo push para `feature/**` e em todo PR para a `main`:

| Job | O que faz |
| --- | --- |
| **Lint e testes** | Node 20 com cache, `npm ci`, lint e Jest, com PostgreSQL e Redis como serviços |
| **Detecção de segredos** | gitleaks em todo o histórico do repositório |
