# Padrão de projeto escolhido: Facade

**Onde está:** [backend/catalogo/src/compra-facade.ts](../../backend/catalogo/src/compra-facade.ts) (classe `CompraFacade`),
implementado na issue #31 (PR #38).
**Diagramas:** [estrutura do Facade](../uml/padroes/facade-compra.svg), [sequência do checkout (UC04)](../uml/sequencia/uc04-checkout-reserva-pix.svg)
e [sequência da confirmação do Pix (UC05)](../uml/sequencia/uc05-confirmar-pagamento-pix.svg).

## O problema

Fechar uma compra no Desa Pego mexe em três partes do sistema:

| Subsistema | O que faz na compra |
| --- | --- |
| **Catálogo** (`Loja`) | confere a reserva de cada peça, grava a compra e, depois do pagamento, marca as peças como vendidas |
| **Serviço de pedidos** (Módulo 05, interface `GestaoPedidos`) | cria um pedido por vendedora, congela a comissão e a taxa do Pix e lança os valores na carteira |
| **Pix** (simulado) | gera o código copia-e-cola e o prazo de pagamento |

Antes da fachada, a compra ficava só no catálogo e nunca chegava ao Módulo 05. Por isso "minhas vendas" e a carteira
ficavam vazias. Ligar as partes direto nas rotas espalharia pelas rotas a ordem das chamadas, o tratamento de falhas e
a forma de repetir com segurança.

## A solução

O **Facade** oferece uma interface simples para um conjunto de subsistemas. As rotas (os "clientes") conversam só com o
`CompraFacade`, por três operações de alto nível:

| Operação da fachada | Quem chama | O que ela coordena |
| --- | --- | --- |
| `criarCompra(compradoraId, dados)` | `POST /pedidos` (checkout) | confere as reservas, cria um pedido por vendedora no Módulo 05 e grava a compra com o Pix |
| `confirmarPagamento(compraId)` | `POST /integracao/pagamentos/{id}/confirmar` (webhook do Pix) | confirma os pedidos no Módulo 05 e só depois marca as peças como vendidas |
| `expirarVencidos()` | servidor, a cada minuto | cancela as compras com o Pix vencido, aqui e no Módulo 05, e devolve as peças à vitrine |

```ts
// backend/catalogo/src/app.ts: a rota não sabe nada de Módulo 05, de Pix nem da ordem das chamadas
app.post("/pedidos", escrita, login, async (req, res) => {
  const dados = esquemaPedido.parse(req.body);
  res.status(201).json(await compras.criarCompra(quem(res).id, dados));
});
```

### Participantes do padrão

| Papel no padrão | No Desa Pego |
| --- | --- |
| Fachada (Facade) | `CompraFacade` |
| Clientes | as rotas do catálogo (`app.ts`) e o servidor (`servidor.ts`) |
| Subsistemas | `Loja` (catálogo), `GestaoPedidos` (Módulo 05, implementada por `gestaoPorHttp`) e as regras do Pix (`regras.ts`) |

## O que ganhamos

- **Regra da compra num lugar só.** A ordem das operações, o "desfazer" quando o Módulo 05 falha e o cancelamento do Pix vencido ficam numa única classe.
- **Rotas simples.** Cada rota valida a entrada e chama uma operação da fachada.
- **Repetir com segurança.** A fachada avisa o Módulo 05 antes de mudar o catálogo. Se algo falhar, nada fica pela metade e o webhook pode repetir.
- **Fácil de testar.** Nos testes, `GestaoPedidos` é trocada por uma versão falsa, que pode falhar de propósito. Num teste de ponta a ponta, os dois serviços reais conversam por HTTP (`integracao-modulo05.test.ts`).
- **Baixo acoplamento entre módulos.** O catálogo não conhece as tabelas do Módulo 05: fala só com a interface `GestaoPedidos`, por HTTP com API key.

## E os outros padrões sugeridos?

| Padrão | Situação no projeto |
| --- | --- |
| **Strategy** | Planejado na arquitetura como `PagamentoProvider`, com duas estratégias: `PixSimuladoProvider` e `MercadoPagoProvider`. Hoje só existe o Pix simulado, então fica como evolução natural para incluir o Mercado Pago ou o cartão. |
| **Observer** | Encaixaria em avisar a compradora quando o status do pedido muda. As notificações (e-mail ou push) estão fora do MVP. |
| **Builder** | Não encontramos um objeto com tantos passos opcionais que justificasse o padrão. Os objetos são validados por esquemas (Zod). |
| **Chain of Responsibility** | As validações de cada requisição já são uma cadeia de middlewares do Express (CORS, limite por IP, login, API key, validação), que é uma forma desse padrão. Não criamos uma cadeia própria. |
