# Padrões de Arquitetura de Software

Referência prática e didática sobre organização de sistemas back-end, fronteiras entre módulos e comunicação.

---

## 1. Estilos arquiteturais e quando escolher cada um

### Monólito Modular
- **O que é:** uma única unidade de deploy (ou poucos processos) dividida internamente em módulos independentes com fronteiras explícitas.
- **Quando usar:** equipes pequenas/médias, MVP em evolução, necessidade de iterar rápido sem o custo operacional de rede distribuída.
- **Regra de ouro:** módulos conversam apenas por **interfaces/fachadas públicas**, nunca acessando tabelas ou arquivos internos uns dos outros.

### Serviços Independentes (por domínio)
- **O que é:** processos separados por contexto de negócio (ex.: `contas`, `catalogo`, `pedidos`), cada um com seu schema/armazenamento.
- **Trade-offs:**
  - **Prós:** isolamento de deploy, responsabilidade clara por equipe/módulo, escalabilidade seletiva.
  - **Contras:** latência de rede, necessidade de timeouts/retentativas, impossibilidade de `JOIN` ou transação ACID simples entre serviços.

### Arquitetura Hexagonal (Portas e Adaptadores)
- **Núcleo (domínio + casos de uso):** contém regras de negócio puras, sem depender de Express, banco SQL específico, S3 ou Supabase.
- **Portas (interfaces):** contratos definidos pelo domínio (ex.: `ArmazenamentoFotos`, `PagamentoProvider`, `PerfisVendedoras`).
- **Adaptadores (implementações):**
  - Produção: `ArmazenamentoSupabase`, PostgreSQL, gateway real.
  - Desenvolvimento/testes: `ArmazenamentoLocal`, banco em memória, provedor simulado.
- **Benefício direto:** você testa 100% da regra de negócio rápido e sem depender de serviços externos.

---

## 2. Comunicação entre módulos e serviços

| Tipo | Mecanismo | Quando usar | Cuidados obrigatórios |
| --- | --- | --- | --- |
| **Síncrona interna** | Chamada de função / fachada | Mesmo processo ou núcleo compartilhado (`core`) | Manter contrato estável e tipado |
| **Síncrona via rede** | HTTP/REST interno + `API Key` / mTLS | Leitura ou ação que precisa de resposta imediata de outro serviço | Timeout curto (`AbortSignal.timeout`), tratamento de `503`, nunca expor rota interna ao público |
| **Assíncrona** | Filas, eventos, webhooks, jobs periódicos | Expiração de reservas/Pix, limpeza de arquivos órfãos, notificações | Idempotência, *dead-letter*/log de falhas, reprocessamento seguro |

### Padrão BFF / API Gateway (Proxy na mesma origem)
- Em aplicações web com front-end SSR (ex.: Next.js), o front-end pode expor `/api/*` e encaminhar internamente para os serviços de back-end (`contas`, `catalogo`, `pedidos`).
- **Vantagens:**
  1. O navegador fala com uma única origem (elimina problemas de CORS no dia a dia).
  2. Endereços internos e chaves entre serviços ficam escondidos do navegador.
  3. Cookies `httpOnly` funcionam como *first-party*.

---

## 3. Núcleo compartilhado (`core`) vs duplicação

- Se uma conta ou regra precisa dar **exatamente o mesmo resultado** no simulador do front-end e no fechamento do pedido no back-end (ex.: comissão, taxa e repasse):
  - Coloque a lógica pura em um pacote compartilhado (`@desapego/core`).
  - Nunca reimplemente a fórmula manualmente em dois lugares — diferenças de arredondamento quebram confiança e auditoria.

---

## 4. Registro de Decisões Arquiteturais (ADR)

Antes de mudar uma escolha estrutural (banco, storage, protocolo, fila), registre em um ADR curto:
1. **Contexto:** qual problema precisava ser resolvido e quais restrições existiam (custo, equipe, prazo, LGPD).
2. **Decisão:** o que foi escolhido.
3. **Alternativas consideradas:** o que foi descartado e por quê.
4. **Consequências:** o que fica mais fácil, o que fica mais difícil e quais riscos precisam de mitigação.
