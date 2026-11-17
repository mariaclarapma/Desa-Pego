# Diagramas UML do Desa Pego

Esta pasta reúne os 14 diagramas UML do Desa Pego, o brechó online do nosso grupo: 6 de classes, 6 de sequência, 1 de componentes e 1 de implantação. Eles foram feitos a partir do [README](../../README.md), do [REQUISITOS.md](../../REQUISITOS.md) e do [documento de arquitetura](../ARQUITETURA.md).

Cada diagrama tem o arquivo-fonte em PlantUML (`.puml`) e a imagem gerada (`.svg`).

## Situação do projeto

O projeto ainda está em planejamento. Os requisitos, a arquitetura e a CI estão prontos, mas o backend ainda não tem código, e do frontend só existe a página inicial (na branch `feature/frontend-home`). Por isso os diagramas mostram como pretendemos construir o sistema, e não um sistema já implementado.

| Definido pelo grupo na documentação | Proposto por nós ao fazer os diagramas |
| --- | --- |
| Os 15 requisitos e seus critérios de aceitação | Os nomes das classes e dos métodos |
| Monolito modular em NestJS com 5 módulos | As interfaces de `app/core` além de `CatalogoPort`, `CarteiraPort` e `PagamentoProvider` |
| Comunicação entre módulos só pelas interfaces de `app/core` | A forma de agrupar os requisitos em 6 casos de uso |
| Next.js, PostgreSQL, Redis + BullMQ, S3, Mercado Pago via `PagamentoProvider` | As hipóteses listadas no fim deste arquivo |
| Reserva atômica, webhook idempotente, carteira como livro-razão, máquina de estados do pedido | |
| Infraestrutura planejada: Docker, ECS Fargate, Cloudflare | |

## Casos de uso

O grupo não tinha casos de uso formais, então organizamos seis seguindo o caminho de uma venda, do cadastro até a liberação do saldo. Juntos, eles cobrem os cinco módulos e os três perfis (comprador, vendedor e admin).

| UC | Caso de uso | Ator | Requisitos | Módulo |
| --- | --- | --- | --- | --- |
| UC01 | Cadastrar conta e autenticar-se | Visitante | 001 | 01 |
| UC02 | Publicar anúncio com simulação de ganho | Vendedor | 004, 005 e regra do 002 | 02 |
| UC03 | Buscar peças na vitrine e consultar detalhes | Comprador | 007, 008 | 03 |
| UC04 | Reservar peça no checkout e gerar cobrança Pix | Comprador | 010, 011 | 04 |
| UC05 | Processar confirmação do pagamento Pix | Mercado Pago | 011, 014 | 04 e 05 |
| UC06 | Atualizar entrega do pedido e liberar saldo | Vendedor e comprador | 013, 014 | 05 |

O UC05 ficou separado do UC04 porque quem inicia o fluxo é o Mercado Pago, e não o comprador. As telas do admin (comissão, repasse e ocultar anúncio) não viraram um caso de uso próprio, mas aparecem nos diagramas: a configuração de comissão e frete é usada no UC02 e no UC04, e o tipo de lançamento `REPASSE` está no UC06.

## Diagramas

| Tipo | UC01 | UC02 | UC03 | UC04 | UC05 | UC06 |
| --- | --- | --- | --- | --- | --- | --- |
| Classes | [svg](classes/uc01-cadastrar-conta-autenticar.svg) | [svg](classes/uc02-publicar-anuncio-simulador.svg) | [svg](classes/uc03-buscar-pecas-vitrine.svg) | [svg](classes/uc04-checkout-reserva-pix.svg) | [svg](classes/uc05-confirmar-pagamento-pix.svg) | [svg](classes/uc06-confirmar-recebimento-liberar-saldo.svg) |
| Sequência | [svg](sequencia/uc01-cadastrar-conta-autenticar.svg) | [svg](sequencia/uc02-publicar-anuncio-simulador.svg) | [svg](sequencia/uc03-buscar-pecas-vitrine.svg) | [svg](sequencia/uc04-checkout-reserva-pix.svg) | [svg](sequencia/uc05-confirmar-pagamento-pix.svg) | [svg](sequencia/uc06-confirmar-recebimento-liberar-saldo.svg) |

Arquitetura geral: [componentes](componentes/componentes-desa-pego.svg) e [implantação](implantacao/implantacao-desa-pego.svg).

### Classes

Cada diagrama mostra só as classes do seu caso de uso: o controller (recebe a requisição), o service (aplica as regras), as entidades com seus atributos e as interfaces de `app/core` usadas para falar com outro módulo. As notas explicam as regras de negócio que não aparecem só pelos atributos.

- **UC01:** `Usuario` tem o perfil `USUARIO` ou `ADMIN`. Não existe perfil "vendedor": a conta passa a vender quando cadastra a chave Pix.
- **UC02:** `Anuncio` é composto por 1 a 5 `FotoAnuncio`. A `CalculadoraPreco` fica em `app/core` porque o mesmo cálculo roda no simulador do navegador e no backend.
- **UC03:** o catálogo lê os anúncios pelo `AnunciosPort`, porque a tabela de anúncios pertence ao Módulo 02.
- **UC04:** o `Carrinho` fica no frontend e não reserva nada. A reserva é criada no checkout pelo `CatalogoPort`. `MercadoPagoProvider` e `PixSimuladoProvider` implementam a mesma interface.
- **UC05:** `EventoWebhook` tem o `idEventoExterno` único, o que impede processar o mesmo pagamento duas vezes.
- **UC06:** a regra de transição de status fica no próprio `Pedido`. O saldo não é um campo: ele é calculado somando os `LancamentoCarteira`.

Alguns tipos usados nos métodos (`NovoAnuncio`, `Pagina`, `ResumoCheckout`, `Taxas` etc.) são apenas os dados que a API recebe ou devolve, e não foram desenhados para não poluir os diagramas.

### Sequência

Os diagramas mostram o ator, o frontend, o controller, o service e os outros módulos com que ele conversa, sempre na mesma ordem. Usamos `alt` para os erros previstos nos requisitos, `opt` para passos opcionais, `loop` quando o mesmo passo se repete e `break` no UC04, porque uma peça indisponível interrompe a reserva das demais.

- **UC01:** cadastro com CPF inválido ou repetido; login com bloqueio por tentativas e mensagem de erro genérica.
- **UC02:** o simulador calcula no navegador a cada tecla; as fotos vão direto para o S3; a publicação exige chave Pix.
- **UC03:** busca com filtros e página de detalhes, com a compra desabilitada se a peça estiver reservada ou vendida.
- **UC04:** reserva atômica de cada peça, criação do pedido, geração do Pix e expiração da reserva quando o prazo acaba.
- **UC05:** o webhook responde rápido e coloca o evento numa fila; depois o pagamento é aplicado numa única transação.
- **UC06:** só o vendedor marca o envio e só o comprador confirma o recebimento; a confirmação libera o saldo.

### Componentes

Mostra o frontend, a API NestJS com os 5 módulos e `app/core`, e os serviços que a API usa. Os módulos aparecem dentro de um único componente porque são partes da mesma aplicação (monolito modular), e não serviços separados. Os estereótipos indicam a situação de cada parte: `«em desenvolvimento»` para o frontend e `«planejado»` para a API.

### Implantação

Mostra a infraestrutura planejada para produção: o navegador acessa o sistema pelo Cloudflare, que encaminha para o load balancer da AWS. Os dois contêineres (frontend e backend) rodam no ECS Fargate, e os dados ficam no RDS (PostgreSQL), no ElastiCache (Redis) e no S3. Mercado Pago, ViaCEP e Cloudflare são serviços externos. A legenda explica o que já existe hoje: apenas a CI.

Deixamos fora do diagrama os serviços de operação citados na arquitetura (Secrets Manager, CloudWatch, Sentry e Grafana Cloud), porque não mudam o funcionamento do sistema.

## Hipóteses

Alguns pontos não estão definidos na documentação do grupo. Para fechar os diagramas, assumimos:

1. Cada pedido tem um único vendedor (o Req. 013 fala em "o vendedor do pedido").
2. A cobrança Pix expira junto com a reserva (15 minutos por padrão).
3. Os workers do BullMQ rodam no mesmo contêiner do backend.
4. Ainda não está decidido se o frete fixo vai para o vendedor nem o que fazer com um Pix pago depois que a reserva expirou.

## Como gerar as imagens

É preciso ter Java, Graphviz e PlantUML instalados (no macOS, `brew install plantuml` instala os três). Depois, na raiz do repositório:

```bash
./docs/uml/gerar-diagramas.sh
```

O script confere a sintaxe dos 14 arquivos e gera um `.svg` ao lado de cada `.puml`. Para gerar PNG, use `FORMATO=png ./docs/uml/gerar-diagramas.sh`. Os `.puml` também podem ser abertos no VS Code com a extensão PlantUML.
