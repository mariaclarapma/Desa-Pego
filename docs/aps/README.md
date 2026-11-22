# APS · Entregáveis do Desa Pego

Índice de tudo o que a APS pede, com o link de cada item. Os diagramas ficam em [docs/uml](../uml) (fonte em PlantUML
`.puml` e imagem `.svg`), e os textos ficam nesta pasta.

## Checklist dos entregáveis

| # | Entregável pedido | Onde está |
| --- | --- | --- |
| 1 | Diagrama de casos de uso (mínimo de 6) | [casos-de-uso-desa-pego.svg](../uml/casos-de-uso/casos-de-uso-desa-pego.svg): 6 casos de uso descritos e mais o UC07 (administração) |
| 2 | Descrição de 6 casos de uso do MVP | [casos-de-uso.md](casos-de-uso.md) (UC01 a UC06) |
| 3 | Pelo menos uma história de usuário com critérios de aceitação por caso de uso | [casos-de-uso.md](casos-de-uso.md), no fim de cada caso de uso |
| 4 | Diagrama de classes conceitual | [conceitual-desa-pego.svg](../uml/classes/conceitual-desa-pego.svg) |
| 5 | 3 diagramas de sequência dos principais casos de uso | [UC04 checkout](../uml/sequencia/uc04-checkout-reserva-pix.svg), [UC05 pagamento Pix](../uml/sequencia/uc05-confirmar-pagamento-pix.svg) e [UC06 entrega e saldo](../uml/sequencia/uc06-confirmar-recebimento-liberar-saldo.svg). Também há o [UC01](../uml/sequencia/uc01-cadastrar-conta-autenticar.svg), o [UC03](../uml/sequencia/uc03-buscar-pecas-vitrine.svg) e o [UC02](../uml/sequencia/uc02-publicar-anuncio-simulador.svg) (planejado) |
| 6 | Diagrama de componentes | [componentes-desa-pego.svg](../uml/componentes/componentes-desa-pego.svg) |
| 7 | Diagrama de implantação | [implantacao-desa-pego.svg](../uml/implantacao/implantacao-desa-pego.svg) |
| 8 | Padrão de projeto e sua aplicação | [padrao-de-projeto.md](padrao-de-projeto.md) (Facade) e [estrutura do Facade](../uml/padroes/facade-compra.svg) |

Os diagramas mostram o sistema **como ele está hoje** no código e no ar ([desapego.onrender.com](https://desapego.onrender.com)).
O único caso de uso ainda não implementado é o UC02 (anúncios, Módulo 02), que segue o planejamento. As versões
planejadas da arquitetura (NestJS na AWS) continuam guardadas para comparação: veja o [README dos diagramas](../uml/README.md).

## Apresentação

O roteiro completo está em [roteiro-apresentacao.md](roteiro-apresentacao.md). Ele tem 20 minutos divididos entre
4 pessoas, a ordem dos blocos, o que mostrar em cada slide, as frases de passagem entre as pessoas, a preparação e as
perguntas prováveis.
