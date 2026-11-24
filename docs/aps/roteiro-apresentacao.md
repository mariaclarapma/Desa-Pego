# Roteiro da apresentação da APS (cerca de 20 minutos, 4 pessoas)

**O que a professora pediu:** cerca de 20 minutos por grupo. Não precisamos mostrar todos os diagramas: basta **um ou dois
exemplos de cada tipo**, explicando os pontos principais. Também precisamos mostrar **como os diagramas se ligam às
funcionalidades do brechó** e **como o padrão escolhido ajuda a organizar o sistema**.

**Fio condutor:** contar a história de **uma venda no Desa Pego**. A compradora acha a peça, reserva, paga com Pix, a
vendedora envia e recebe o dinheiro. Cada diagrama entra quando a história chega na parte que ele explica.

## Visão geral

| Ordem | Quem | Bloco | Tempo | O que mostrar |
| --- | --- | --- | --- | --- |
| 1 | Pessoa 1 | Abertura e casos de uso | 5 min | o problema, o MVP, o diagrama de casos de uso e o UC04 descrito com a história de usuário |
| 2 | Pessoa 2 | Classes e sequência | 5 min | o diagrama de classes conceitual e a sequência do UC04 (checkout) |
| 3 | Pessoa 3 | Padrão de projeto | 5 min | o Facade: o problema, a estrutura, o código e a sequência do UC05 (pagamento) |
| 4 | Pessoa 4 | Arquitetura e demonstração | 5 min | os diagramas de componentes e de implantação, a demonstração no site e o fechamento |

> **Quem fica com cada bloco:** o mais natural é cada pessoa apresentar a parte que conhece melhor. Por exemplo: quem
> fez os diagramas UML fica com o bloco 2, quem fez o checkout e o Facade fica com o bloco 3, e quem cuidou da
> hospedagem fica com o bloco 4.

---

## Bloco 1 · Abertura e casos de uso (Pessoa 1, 5 min)

**Slides:** capa → problema e proposta → [diagrama de casos de uso](../uml/casos-de-uso/casos-de-uso-desa-pego.svg) → [UC04 e a história de usuário](casos-de-uso.md#uc04--reservar-peças-e-fechar-a-compra-com-pix)

1. **Problema (1 min).** Muita roupa parada no armário. Vender é trabalhoso, e a pessoa não sabe quanto vai receber.
2. **Proposta (1 min).** O Desa Pego é um brechó online comunitário: qualquer pessoa anuncia, vê quanto vai receber e
   a compradora paga com Pix. O site está no ar em desapego.onrender.com.
3. **Diagrama de casos de uso (1,5 min).**
   - Atores: visitante, compradora, vendedora, administradora e o provedor Pix, que é um sistema externo.
   - Os 6 casos de uso seguem o caminho de uma venda, do cadastro até o saldo liberado.
   - O «include» marca passos obrigatórios: reservar a peça e gerar o Pix dentro do checkout.
   - O «extend» marca o que acontece só às vezes: o Pix vencido cancela o pedido.
4. **UC04 descrito (1,5 min).** Ator, pré-condição (estar logada), fluxo principal em 6 passos e dois fluxos
   alternativos: a peça que outra pessoa reservou antes e o Pix que venceu. Em seguida, a história de usuário:
   *"Como compradora, quero reservar as peças que escolhi e pagar com Pix, para garantir peças únicas sem que outra
   pessoa compre antes de mim"*. Ler 2 ou 3 critérios de aceitação.

**Passagem para a Pessoa 2:** "Para esse fluxo funcionar, a gente precisou definir quais informações o sistema guarda.
É isso que o diagrama de classes mostra."

---

## Bloco 2 · Classes e sequência (Pessoa 2, 5 min)

**Slides:** [classes conceitual](../uml/classes/conceitual-desa-pego.svg) → [sequência do UC04](../uml/sequencia/uc04-checkout-reserva-pix.svg)

1. **Diagrama de classes conceitual (2,5 min).** Mostrar três ideias e não ler as classes uma por uma:
   - **Peça única:** a `Peca` tem status (disponível, reservada ou vendida) e uma `Reserva` de 15 minutos. Como cada
     peça só existe uma vez, a reserva impede que duas pessoas comprem a mesma.
   - **Compra x Pedido:** a compra tem um Pix só, mas vira **um pedido por vendedora**, porque cada uma envia a sua
     parte e cobra o seu frete.
   - **Carteira como livro-razão:** o saldo não é um campo. É a soma dos lançamentos, que nunca são apagados.
     Mostrar a fórmula da legenda: *valor da vendedora = peças + frete − comissão − taxa do Pix*.
2. **Sequência do UC04, o checkout (2,5 min).** Seguir a numeração:
   - De 1 a 9, a reserva. Mostrar os blocos `alt` (sem login, peça de outra pessoa).
   - De 14 a 23, o checkout: o site chama as rotas, as rotas chamam **só o `CompraFacade`**, e ele cria um pedido no
     Módulo 05 para cada vendedora.
   - De 24 a 26, o Módulo 05 fora do ar: nada fica pela metade.
   - No fim, a varredura a cada minuto que cancela o Pix vencido.

**Passagem para a Pessoa 3:** "Repararam que as rotas não falam com o Módulo 05 direto, só com o `CompraFacade`? Esse é
o padrão de projeto que a gente escolheu."

---

## Bloco 3 · Padrão de projeto: Facade (Pessoa 3, 5 min)

**Slides:** o problema → [estrutura do Facade](../uml/padroes/facade-compra.svg) → trecho do código → [sequência do UC05](../uml/sequencia/uc05-confirmar-pagamento-pix.svg) → [os outros padrões](padrao-de-projeto.md#e-os-outros-padrões-sugeridos)

1. **Problema (1 min).** Fechar uma compra mexe em três partes: o catálogo (reserva e peças), o serviço de pedidos
   (pedido, comissão e carteira) e o Pix. Antes, a compra ficava só no catálogo e nunca aparecia em "minhas vendas".
2. **Estrutura (1 min).** Clientes (as rotas e o servidor) → **fachada** (`CompraFacade`) → subsistemas (`Loja`,
   `GestaoPedidos` e as regras do Pix). As rotas chamam só três operações: `criarCompra`, `confirmarPagamento` e
   `expirarVencidos`.
3. **Código (1 min).** Mostrar a rota `POST /pedidos`, que cabe em três linhas e só valida e chama
   `compras.criarCompra(...)`. Toda a coordenação está na fachada.
4. **Sequência do UC05, o pagamento (1 min).** A fachada avisa o Módulo 05 **antes** de mudar o catálogo. Se algo
   falhar, nada fica pela metade e o Pix pode repetir. Confirmar duas vezes não duplica o dinheiro (idempotência).
5. **Os outros padrões (1 min).**
   - **Strategy** fica como evolução: trocar o Pix simulado pelo Mercado Pago ou pelo cartão.
   - **Observer** serviria para notificar a mudança de status, mas as notificações estão fora do MVP.
   - **Chain of Responsibility** já aparece na cadeia de middlewares do Express: CORS, limite, login e validação.

**Passagem para a Pessoa 4:** "Agora que vocês viram como a compra funciona por dentro, vamos ver onde cada parte roda
e o sistema funcionando."

---

## Bloco 4 · Arquitetura e demonstração (Pessoa 4, 5 min)

**Slides:** [componentes](../uml/componentes/componentes-desa-pego.svg) → [implantação](../uml/implantacao/implantacao-desa-pego.svg) → demonstração → encerramento

1. **Componentes (1 min).** O site em Next.js, com um proxy `/api`, e três serviços: contas, catálogo e pedidos. As
   rotas entre serviços usam uma API key, que nunca vai para o navegador. O `CompraFacade` aparece dentro do catálogo.
2. **Implantação (1 min).**
   - Um serviço web no Render roda os quatro processos.
   - O PostgreSQL fica no Supabase.
   - O deploy é automático a cada push na `main`.
   - Comentar em uma frase: "no planejamento era AWS; para o MVP, escolhemos uma hospedagem gratuita".
3. **Demonstração (2,5 min).** Entrar com uma conta → colocar uma peça na sacola → fechar com Pix → "simular
   pagamento" → "acompanhar em minhas compras" mostra o pedido pago.
4. **Encerramento (30 s).** Retomar a frase da abertura e abrir para perguntas.

---

## Preparação (antes de apresentar)

- [ ] **Acordar o site 5 minutos antes.** O plano gratuito do Render "dorme" e pode levar até 1 minuto para abrir.
- [ ] Deixar uma **conta de demonstração** criada e logada numa aba, e conferir que há peças disponíveis na vitrine.
- [ ] **Nenhum merge na `main` no dia:** cada merge faz um novo deploy no Render, que apaga os anúncios e as fotos
      criados no site (o catálogo ainda fica no disco do servidor). Se houver merge, crie o anúncio da demonstração
      depois dele.
- [ ] Se sobrar tempo no bloco 4: publicar um anúncio em "anunciar peça" e mostrar o simulador calculando o valor
      líquido enquanto digita o preço (UC02).
- [ ] **Plano B:** prints ou um vídeo curto da compra, caso a internet ou o site falhem.
- [ ] Exportar os SVGs dos diagramas para os slides, com um diagrama por slide e zoom na parte que está sendo explicada.
- [ ] Ensaiar com cronômetro. Se passar do tempo, o primeiro corte é o diagrama de componentes, e o segundo é a
      sequência do UC05: basta citá-la.

## Perguntas prováveis

| Pergunta | Resposta curta |
| --- | --- |
| Por que Facade e não Strategy? | O Facade resolve um problema que já tínhamos (coordenar três partes na compra) e está implementado e testado. O Strategy só faria sentido com mais de uma forma de pagamento, e hoje só existe o Pix. |
| E se duas pessoas clicarem em "colocar na sacola" ao mesmo tempo? | As alterações passam por uma fila: só uma reserva passa e a outra recebe "acabou de ser reservada". Isso está testado. |
| E se o Pix for confirmado duas vezes? | A confirmação é idempotente: a segunda chamada responde 200 e não lança o valor de novo na carteira. |
| Por que um pedido por vendedora? | Cada vendedora envia a sua parte e recebe o seu dinheiro. Assim, "minhas vendas", a carteira e o frete ficam separados. |
| Os diagramas mudaram em relação ao planejamento? | Sim. O planejado era NestJS na AWS, e o construído são serviços Express no Render. As duas versões estão no repositório, e explicamos a diferença no README dos diagramas. |
| O que ainda falta? | Guardar as fotos dos anúncios e o catálogo fora do disco do Render, que é apagado a cada deploy: Supabase Storage e PostgreSQL (PR #48, com migração) ou Amazon S3 (PR #45). |
| Como a vendedora sabe quanto vai receber? | O simulador do anúncio usa a mesma função (`calcularRepasse`, em `core`) que o serviço de pedidos usa para lançar na carteira: o valor mostrado é o valor lançado. |
