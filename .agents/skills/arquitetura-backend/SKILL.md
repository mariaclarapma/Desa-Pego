---
name: arquitetura-backend
description: >-
  Guia prático e didático de arquitetura de software e engenharia de back-end.
  Use esta skill ao projetar módulos, APIs e integrações, revisar código de
  servidor, diagnosticar problemas de concorrência/consistência/segurança ou
  estudar padrões de arquitetura e back-end.
---

# Arquitetura e Back-end

Skill para **projetar, revisar e explicar** decisões de arquitetura e implementação de back-end, combinando checklist de engenharia com material de referência didático.

## Quando usar

- Ao desenhar novos módulos, serviços, endpoints ou integrações entre serviços.
- Ao revisar código de back-end (segurança, validação, atomicidade, consistência, erros e testes).
- Ao explicar ou estudar conceitos de arquitetura (monólito modular, portas e adaptadores, ADRs, máquinas de estado, livro-razão, idempotência).

## Fluxo de trabalho

1. **Entender o contexto e a fronteira:** identifique quem chama (navegador, outro serviço, webhook, job), qual módulo é dono dos dados e onde estão os contratos públicos.
2. **Aplicar o checklist abaixo** antes de escrever ou aprovar código.
3. **Consultar as referências conforme a necessidade:**
   - Padrões estruturais, fronteiras de módulos, comunicação síncrona/assíncrona e ADRs: [Padrões de Arquitetura](./references/padroes-arquitetura.md)
   - Validação, posse, concorrência, idempotência, dinheiro em inteiros, segurança e testes: [Back-end Confiável](./references/backend-confiavel.md)

## Checklist de revisão de Arquitetura e Back-end

### 1. Fronteiras e responsabilidades
- Cada módulo/serviço tem **dono claro de dados** (sem escrita direta na tabela/estado interno de outro domínio).
- Regras compartilhadas entre front e back (ex.: cálculos financeiros) vivem em um **núcleo único** (`core`), nunca duplicadas.
- Dependências externas (storage, gateway de pagamento, banco, outro serviço) ficam atrás de **interfaces/adaptadores** para permitir troca e testes sem rede.

### 2. Segurança e validação na fronteira
- **Backend é a barreira:** o frontend só melhora a UX; toda validação de tipo, faixa, formato e regra de negócio roda no servidor.
- **Autenticação != Autorização:** verificar token válido (`401`) é diferente de verificar papel/permissão ou posse do recurso (`403`).
- Segredos, tokens e senhas nunca aparecem em respostas da API, logs ou código versionado; senhas usam hash forte (`Argon2id` / `scrypt`) e comparações de assinatura usam tempo constante (`timingSafeEqual`).

### 3. Consistência, concorrência e estado
- Operações críticas contra corrida usam **atualização atômica**, transação ou fila serializada (nunca "ler, checar no JS e gravar depois" sem proteção).
- Fluxos com etapas (ex.: pedidos, reservas) usam **máquina de estados explícita**, rejeitando transições inválidas com `409`.
- Rotas de callback/webhook são **idempotentes** (evento repetido não duplica efeito nem saldo).

### 4. Dinheiro, erros e observabilidade
- Valores monetários usam **centavos inteiros** (nunca `float`) e percentuais em **pontos-base** (ex.: `1000 = 10,00%`), garantindo soma exata sem perda de centavo.
- Erros de domínio devolvem status HTTP semântico e mensagem segura ao cliente; falhas internas inesperadas são logadas sem vazar stack trace ou segredos.

### 5. Verificabilidade
- Cada regra crítica tem testes cobrindo caminho feliz, entradas inválidas, tentativa por outro usuário, transições inválidas e concorrência/repetição.
- Contratos HTTP novos ou alterados são refletidos na documentação da API (ex.: `docs/openapi.yaml`).
