# Diagramas UML do Desa Pego

Esta pasta reúne os diagramas UML do Desa Pego, o brechó online do nosso grupo. Cada diagrama tem o arquivo-fonte em
PlantUML (`.puml`) e a imagem gerada (`.svg`). O índice dos entregáveis da APS, com as descrições dos casos de uso, as
histórias de usuário e o padrão de projeto, está em [docs/aps](../aps/README.md).

## Situação

Os primeiros diagramas (PR #22) foram feitos no planejamento, quando o backend ainda não tinha código. Desde então,
o sistema foi construído e ficou diferente do planejado em alguns pontos:

| Planejado | Como ficou |
| --- | --- |
| Uma API NestJS com 5 módulos | Três serviços em Express (contas, catálogo e pedidos), todos em TypeScript |
| AWS (ECS Fargate, RDS, Redis, S3) e Cloudflare | Um serviço web no Render e o PostgreSQL no Supabase |
| Mercado Pago com webhook e fila (BullMQ) | Pix simulado; a confirmação passa pelo `CompraFacade` (padrão Facade) |
| Um pedido por compra | Um pedido por vendedora; a compra tem um Pix só |

Por isso, os diagramas de **casos de uso, classes conceitual, sequência (UC01, UC03 a UC06), componentes e implantação**
mostram o sistema **como está hoje**. As versões planejadas foram mantidas para comparação:

- **Mantidos do planejamento:** os seis diagramas de classes por caso de uso (modelo de projeto inicial), a sequência do UC02 (o Módulo 02 ainda está em desenvolvimento) e as versões planejadas de componentes e implantação.

## Organização

| Pasta | Diagramas |
| --- | --- |
| [casos-de-uso](casos-de-uso) | [casos de uso do MVP](casos-de-uso/casos-de-uso-desa-pego.svg) |
| [classes](classes) | [**conceitual**](classes/conceitual-desa-pego.svg) (entidades do domínio) e os seis diagramas de projeto por caso de uso (`uc01` a `uc06`, do planejamento) |
| [sequencia](sequencia) | um por caso de uso: [UC01](sequencia/uc01-cadastrar-conta-autenticar.svg), [UC02](sequencia/uc02-publicar-anuncio-simulador.svg) (planejado), [UC03](sequencia/uc03-buscar-pecas-vitrine.svg), [UC04](sequencia/uc04-checkout-reserva-pix.svg), [UC05](sequencia/uc05-confirmar-pagamento-pix.svg) e [UC06](sequencia/uc06-confirmar-recebimento-liberar-saldo.svg) |
| [componentes](componentes) | [**atual**](componentes/componentes-desa-pego.svg) e [planejado (NestJS)](componentes/componentes-planejado-nestjs.svg) |
| [implantacao](implantacao) | [**atual** (Render + Supabase)](implantacao/implantacao-desa-pego.svg) e [planejado (AWS)](implantacao/implantacao-planejada-aws.svg) |
| [padroes](padroes) | [estrutura do Facade](padroes/facade-compra.svg) (`CompraFacade`) |

## Casos de uso

| UC | Caso de uso | Ator | Requisitos | Onde está no código |
| --- | --- | --- | --- | --- |
| UC01 | Cadastrar conta e autenticar-se | Visitante | 001 | `backend/contas` |
| UC02 | Publicar anúncio com simulação de ganho | Vendedora | 004, 005 e regra do 002 | Módulo 02, em desenvolvimento |
| UC03 | Buscar peças na vitrine e consultar detalhes | Visitante ou compradora | 007, 008 | `backend/catalogo` e `frontend/src/app/catalogo` |
| UC04 | Reservar peças e fechar a compra com Pix | Compradora | 010, 011 | `backend/catalogo/src/compra-facade.ts` |
| UC05 | Confirmar o pagamento Pix | Provedor Pix | 011, 014 | `CompraFacade` + `backend/pedidos` |
| UC06 | Acompanhar a entrega e liberar o saldo | Vendedora e compradora | 013, 014 | `backend/pedidos` |

O UC05 é separado do UC04 porque quem inicia o fluxo é o provedor do Pix, e não a compradora. O diagrama de casos de uso
também mostra o UC07 (administração), que não está entre as seis descrições.

## O que cada diagrama mostra

- **Casos de uso:** os atores (visitante, compradora, vendedora, administradora e o provedor Pix) e os casos de uso, com «include» (validar CPF, simular ganho, reservar peça, gerar cobrança Pix) e «extend» (cancelar o pedido com o Pix vencido).
- **Classes conceitual:** as entidades do domínio e como se relacionam, sem controllers nem serviços. Destaques: a compra tem um Pix e se divide em um pedido por vendedora; a carteira é um livro-razão (o saldo é a soma dos lançamentos); comissão e taxa ficam congeladas no pedido.
- **Sequência:** os participantes reais (site, rotas, `CompraFacade`, banco) e os erros previstos em blocos `alt`. O UC04 e o UC05 mostram o Facade coordenando o catálogo e o serviço de pedidos.
- **Componentes:** o site (com o proxy `/api`) e os três serviços, com as interfaces REST de cada um e as rotas com API key (`/interno` e `/integracao`).
- **Implantação:** o serviço web no Render rodando os quatro processos, o PostgreSQL no Supabase e o deploy automático a partir do GitHub.
- **Facade:** a fachada, os clientes (rotas e servidor) e os subsistemas (`Loja`, `GestaoPedidos` e as regras do Pix).

## Como gerar as imagens

É preciso ter Java e PlantUML. Os diagramas novos usam o layout interno do PlantUML (`!pragma layout smetana`) e
não precisam do Graphviz. Os diagramas de classes por caso de uso e as versões planejadas de componentes e implantação
precisam do Graphviz (no macOS, `brew install plantuml` instala tudo). Na raiz do repositório:

```bash
./docs/uml/gerar-diagramas.sh
# ou, com o plantuml.jar:
PLANTUML="java -jar /caminho/plantuml.jar" ./docs/uml/gerar-diagramas.sh
```

O script confere a sintaxe de todos os `.puml` e gera um `.svg` ao lado de cada um. Para gerar PNG, use
`FORMATO=png ./docs/uml/gerar-diagramas.sh`. Os `.puml` também podem ser abertos no VS Code com a extensão PlantUML.
