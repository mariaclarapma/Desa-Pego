# Documentação UML do Desa Pego

Modelagem UML do MVP do Desa Pego, brechó online comunitário em que qualquer pessoa anuncia peças, vê quanto vai receber pela venda e o comprador paga com Pix. A plataforma reserva a peça, cobra o Pix, divide o valor entre vendedor, comissão e taxa e registra o repasse ao vendedor.

Os diagramas foram construídos a partir do [README](../../README.md), do [REQUISITOS.md](../../REQUISITOS.md) (15 requisitos do MVP) e do [Documento de Arquitetura v2.0](../ARQUITETURA.md) com os ADRs 001 a 008. Até a data desta modelagem, o repositório ainda não tem código de backend; portanto, os nomes de classes, métodos e endpoints são uma **proposta de projeto** coerente com a arquitetura documentada, e não engenharia reversa de código existente.

São 14 diagramas, todos em PlantUML, com o arquivo-fonte `.puml` e a versão visual `.svg` lado a lado.

## Estrutura da pasta

```
docs/uml/
├── README.md
├── _estilo.iuml              estilo visual comum (incluído por todos os diagramas)
├── gerar-diagramas.sh        valida a sintaxe e gera os SVGs
├── classes/                  6 diagramas de classes (um por caso de uso)
├── sequencia/                6 diagramas de sequência (um por caso de uso)
├── componentes/              1 diagrama de componentes (arquitetura geral)
└── implantacao/              1 diagrama de implantação (infraestrutura planejada)
```

## Os seis casos de uso

O repositório não formaliza casos de uso: ele organiza o MVP em 15 requisitos (10 funcionais e 5 de testes). Os seis casos de uso abaixo foram organizados a partir dos 10 requisitos funcionais, seguindo o fluxo de venda descrito no README ("Como funciona uma venda") e a seção 5.1 da arquitetura. O critério foi cobrir os cinco módulos, os três perfis de usuário e as regras de negócio mais críticas (peça única, webhook idempotente, livro-razão e máquina de estados).

| UC | Caso de uso | Ator principal | Requisitos | Módulos |
| --- | --- | --- | --- | --- |
| UC01 | Cadastrar conta e autenticar-se | Visitante | 001 | 01 |
| UC02 | Publicar anúncio com simulação de ganho | Vendedor | 004, 005 (e regra do 002) | 02, consome 01 e 05 |
| UC03 | Buscar peças na vitrine e consultar detalhes | Comprador | 007, 008 | 03, consome 01 e 02 |
| UC04 | Reservar peça no checkout e gerar cobrança Pix | Comprador | 010, 011 | 04, consome 03 e 05 |
| UC05 | Processar confirmação do pagamento Pix (webhook) | Provedor Pix (Mercado Pago) | 011, 014 | 04 e 05 |
| UC06 | Atualizar entrega do pedido e liberar saldo | Vendedor e Comprador | 013, 014 | 05 |

**Justificativa da seleção**

- **UC01** é o ponto de entrada de todos os perfis e concentra as regras de segurança do Req. 001 (CPF validado e comparado por hash, Argon2id, JWT + refresh token, bloqueio por tentativas).
- **UC02** reúne o anúncio (Req. 004) e o simulador (Req. 005), e mostra a regra do Req. 002 de que só quem tem chave Pix publica. É o caso que ilustra o ADR-002: o mesmo cálculo de `app/core/pricing` roda no navegador e no servidor.
- **UC03** cobre todo o Módulo 03: busca full-text, filtros, cache e a regra de que a disponibilidade da peça é lida do banco.
- **UC04** é o ponto mais crítico da arquitetura (ADR-003): reserva atômica da peça única, prazo de expiração e geração do Pix pelo `PagamentoProvider`.
- **UC05** modela o webhook assinado e idempotente (ADR-005) e o registro dos lançamentos no livro-razão (ADR-006). Foi separado do UC04 porque tem outro ator (o provedor de pagamento) e acontece de forma assíncrona.
- **UC06** cobre a máquina de estados do pedido (Req. 013) e a liberação do saldo pendente (Req. 014).

**O que ficou de fora e por quê.** O cadastro da chave Pix (Req. 002) aparece como regra consumida no UC02, por meio de `ContasPort.possuiChavePixValida`. As funções do admin (definir comissão, taxa e frete, registrar repasse e ocultar anúncio, Req. 014) não ganharam um caso de uso próprio porque o limite é de seis e elas são cadastros simples, sem fluxo concorrente. Ainda assim aparecem no modelo: `ConfiguracaoPlataforma`/`ConfiguracaoPort` é usada nos UC02 e UC04, o status `OCULTO` está no UC02 e no UC03, o tipo de lançamento `REPASSE` está no UC05 e no UC06, e o painel do admin aparece no diagrama de componentes.

## Relação dos 14 diagramas

| # | Tipo | Diagrama | Fonte | Imagem |
| --- | --- | --- | --- | --- |
| 1 | Classes | UC01 · Cadastrar conta e autenticar-se | [.puml](classes/uc01-cadastrar-conta-autenticar.puml) | [.svg](classes/uc01-cadastrar-conta-autenticar.svg) |
| 2 | Classes | UC02 · Publicar anúncio com simulação de ganho | [.puml](classes/uc02-publicar-anuncio-simulador.puml) | [.svg](classes/uc02-publicar-anuncio-simulador.svg) |
| 3 | Classes | UC03 · Buscar peças na vitrine e consultar detalhes | [.puml](classes/uc03-buscar-pecas-vitrine.puml) | [.svg](classes/uc03-buscar-pecas-vitrine.svg) |
| 4 | Classes | UC04 · Reservar peça no checkout e gerar cobrança Pix | [.puml](classes/uc04-checkout-reserva-pix.puml) | [.svg](classes/uc04-checkout-reserva-pix.svg) |
| 5 | Classes | UC05 · Processar confirmação do pagamento Pix | [.puml](classes/uc05-confirmar-pagamento-pix.puml) | [.svg](classes/uc05-confirmar-pagamento-pix.svg) |
| 6 | Classes | UC06 · Atualizar entrega do pedido e liberar saldo | [.puml](classes/uc06-confirmar-recebimento-liberar-saldo.puml) | [.svg](classes/uc06-confirmar-recebimento-liberar-saldo.svg) |
| 7 | Sequência | UC01 · Cadastrar conta e autenticar-se | [.puml](sequencia/uc01-cadastrar-conta-autenticar.puml) | [.svg](sequencia/uc01-cadastrar-conta-autenticar.svg) |
| 8 | Sequência | UC02 · Publicar anúncio com simulação de ganho | [.puml](sequencia/uc02-publicar-anuncio-simulador.puml) | [.svg](sequencia/uc02-publicar-anuncio-simulador.svg) |
| 9 | Sequência | UC03 · Buscar peças na vitrine e consultar detalhes | [.puml](sequencia/uc03-buscar-pecas-vitrine.puml) | [.svg](sequencia/uc03-buscar-pecas-vitrine.svg) |
| 10 | Sequência | UC04 · Reservar peça no checkout e gerar cobrança Pix | [.puml](sequencia/uc04-checkout-reserva-pix.puml) | [.svg](sequencia/uc04-checkout-reserva-pix.svg) |
| 11 | Sequência | UC05 · Processar confirmação do pagamento Pix | [.puml](sequencia/uc05-confirmar-pagamento-pix.puml) | [.svg](sequencia/uc05-confirmar-pagamento-pix.svg) |
| 12 | Sequência | UC06 · Atualizar entrega do pedido e liberar saldo | [.puml](sequencia/uc06-confirmar-recebimento-liberar-saldo.puml) | [.svg](sequencia/uc06-confirmar-recebimento-liberar-saldo.svg) |
| 13 | Componentes | Arquitetura geral do Desa Pego | [.puml](componentes/componentes-desa-pego.puml) | [.svg](componentes/componentes-desa-pego.svg) |
| 14 | Implantação | Infraestrutura planejada de produção | [.puml](implantacao/implantacao-desa-pego.puml) | [.svg](implantacao/implantacao-desa-pego.svg) |

## Explicação de cada diagrama

### Diagramas de classes

Cada diagrama mostra apenas as classes que participam do caso de uso, organizadas em pacotes: o módulo dono do caso de uso, `app/core` (interfaces e tipos compartilhados), as implementações em outros módulos e os adaptadores. As interfaces de `app/core` mostram as operações relevantes ao caso de uso. Os estereótipos (`<<controller>>`, `<<service>>`, `<<entity>>`, `<<repository>>`, `<<DTO>>`, `<<value object>>`) seguem a organização em camadas do NestJS.

1. **UC01** · `AuthController` → `AuthService`, que coordena `Cpf` (valida os dígitos verificadores), `CriptografiaCampoService` (criptografia e hash do CPF), `HashSenhaService` (Argon2id), `TokenService` (JWT e refresh token) e `LimitadorTentativasLogin` (contadores no Redis). `Usuario` tem perfil `USUARIO` ou `ADMIN`; o papel de vendedor é ativado pelo cadastro da chave Pix.
2. **UC02** · Duas entradas: `SimuladorController` (parâmetros de comissão, taxa e faixa sugerida) e `AnuncioController` (URLs pré-assinadas e publicação). `Anuncio` compõe de 1 a 5 `FotoAnuncio`. O componente React `FormularioAnuncio` depende de `CalculadoraPreco`, mostrando que o simulador roda no navegador com o mesmo código do backend.
3. **UC03** · `CatalogoService` consulta anúncios por `AnunciosPort` (implementada pelo Módulo 02, dono da tabela de anúncios) e o perfil público por `ContasPort`. `CacheVitrine` guarda só listagens; `DetalhesPeca` calcula a disponibilidade a partir do banco.
4. **UC04** · O carrinho existe só no frontend (`CarrinhoStore`, Zustand), porque não reserva nada. `CheckoutService` usa `CatalogoPort.reservarPeca` (atualização atômica), registra `Reserva`, cria o pedido por `PedidosPort`, gera a cobrança por `PagamentoProvider` e agenda a expiração em `FilaExpiracao`, consumida por `ExpiracaoCheckoutWorker`.
5. **UC05** · `WebhookPixController` valida a assinatura e grava `EventoWebhook` com `idEventoExterno` único (idempotência). `ConfirmacaoPagamentoWorker` aplica o pagamento numa transação, usando `PedidosPort`, `CatalogoPort` e `CarteiraPort`. No Módulo 05, `CarteiraService` gera os `LancamentoCarteira` imutáveis com `CalculadoraPreco`.
6. **UC06** · `PedidoService` valida a posse do pedido (`ehVendedor`/`ehComprador`) e delega a mudança de status a `MaquinaEstadosPedido`. Ao confirmar o recebimento, `CarteiraService.liberarSaldo` insere lançamentos de liberação; o saldo é sempre a soma do livro-razão (`SaldoCarteira`).

### Diagramas de sequência

Todos têm numeração automática das mensagens, separadores (`==`) para as fases do fluxo, retornos tracejados e os fragmentos `alt`, `opt`, `loop`, `break` e `group` (este último para marcar transações de banco).

7. **UC01** · Cadastro com `alt` para CPF inválido (400) e e-mail/CPF duplicado (409); login com `alt` para conta bloqueada (429) e credenciais inválidas (401 genérico); `opt` de logout que revoga o refresh token.
8. **UC02** · `loop` do simulador a cada tecla, sem chamar a API; envio das fotos direto ao S3; publicação com `alt` para falta de chave Pix (403), dados inválidos (400) e foto ausente no S3.
9. **UC03** · Cache na borda (Cloudflare) e no Redis com `alt` de acerto e falta; validação de filtros; detalhes com `alt` para peça inexistente ou oculta (404) e para habilitar ou desabilitar a compra conforme a disponibilidade.
10. **UC04** · Reserva dentro de uma transação com `loop` por peça e `break` para compra da própria peça (422) e peça já reservada (409); endereço com `opt` de ViaCEP; criação do pedido com comissão congelada; `alt` para falha do provedor; fase assíncrona de expiração que cancela o pedido e libera a peça.
11. **UC05** · Recebimento rápido com `alt` de assinatura inválida (401) e evento repetido (200 sem efeito); processamento assíncrono com `alt` para pagamento aprovado, Pix expirado e evento sem efeito; `opt` de retentativa do BullMQ.
12. **UC06** · Dois atores. Envio pelo vendedor e confirmação pelo comprador, com `break` para pedido inexistente (404), `alt` para quem não é dono (403) e transição inválida (409); liberação do saldo na mesma transação; `opt` de consulta da carteira.

### Diagrama de componentes

13. Mostra a arquitetura em camadas, de cima para baixo: usuário, frontend Next.js, API NestJS, `app/core`, adaptadores e, na base, os serviços de dados e externos. A API é **um único componente** com duas portas de entrada (REST e webhook Pix); dentro dela estão os cinco módulos, o núcleo `app/core` com as nove interfaces, os adaptadores dos fornecedores externos e a infraestrutura comum (Prisma, BullMQ, guard JWT). Cada módulo tem uma cor: a linha sólida até o círculo indica a interface que ele **fornece** e a seta tracejada na mesma cor indica a interface que ele **requer**. Assim cada dependência pode ser seguida até o módulo de origem. A biblioteca `app/core/pricing` fica fora da API porque também roda no navegador.

### Diagrama de implantação

14. Representa o ambiente de produção planejado, na ordem em que uma requisição percorre a infraestrutura: dispositivo do usuário → Cloudflare (proxy, cache e WAF) → ALB na AWS sa-east-1 → cluster ECS Fargate (serviços web, worker e api, cada um em contêiner Docker) → dados (RDS PostgreSQL multi-AZ, ElastiCache Redis e S3). Secrets Manager e CloudWatch ficam à esquerda, junto do Sentry e do Grafana Cloud (observabilidade); Mercado Pago e ViaCEP ficam à direita, ao lado do serviço api, que os chama. Nós externos têm borda tracejada e os hospedados pela aplicação, borda contínua. A legenda lista as hipóteses.

## Principais decisões de modelagem

- **Monolito modular, não microsserviços.** O diagrama de componentes mostra os módulos como partes de um único componente e processo, conforme o ADR-001. Os módulos conversam por interfaces de `app/core`, e as transações que envolvem vários módulos (reserva, pagamento, carteira) são transações locais do PostgreSQL, representadas com `group` nos diagramas de sequência.
- **Interfaces de `app/core`.** O documento de arquitetura cita `CatalogoPort.reservarPeca()`, `CarteiraPort.registrarVenda()` e `PagamentoProvider`. As demais (`ContasPort`, `AnunciosPort`, `PedidosPort`, `ConfiguracaoPort`, `ArmazenamentoArquivos`, `CepProvider`) foram derivadas da regra "um módulo não acessa tabelas de outro" e do princípio de que cada fornecedor fica atrás de uma interface própria (seção 5.2). Os nomes são os mesmos em todos os diagramas.
- **Classe de domínio, não tabela.** Os diagramas de classes têm métodos, visibilidade, DTOs, serviços e exceções; não são o diagrama ER do README. Composição foi usada só quando a parte não existe sem o todo (`Anuncio` e `FotoAnuncio`, `Pedido` e `ItemPedido`); agregação para coleções de DTOs; herança não foi necessária, e a variação de comportamento aparece como realização de interface (`MercadoPagoProvider` e `PixSimuladoProvider` realizam `PagamentoProvider`).
- **Dinheiro em centavos inteiros.** Todos os valores monetários são `int` em centavos e os percentuais são `Decimal`, conforme a seção 4.2. `DivisaoValor` explicita a invariante comissão + taxa + líquido = preço.
- **Livro-razão imutável.** `LancamentoCarteira` não tem métodos de alteração. A liberação do saldo é representada por dois novos lançamentos (−valor pendente, +valor disponível), de modo que o saldo é sempre a soma dos lançamentos (ADR-006).
- **Disponibilidade da peça.** O enum `StatusAnuncio` (`DISPONIVEL`, `PAUSADO`, `RESERVADO`, `VENDIDO`, `OCULTO`) une os estados citados nos Req. 004, 007, 008 e 010. A atualização atômica do ADR-003 aparece como nota no UC04.
- **Processamento assíncrono.** Seguindo a seção 5.3, o webhook só valida, registra e enfileira; o efeito (pedido pago, peça vendida, lançamentos) ocorre no worker. Os lançamentos foram colocados na mesma transação que marca o pedido como pago, para que nunca exista pedido pago sem lançamento.

## Hipóteses assumidas

A documentação não define os pontos abaixo. Eles foram assumidos para fechar os diagramas e devem ser confirmados pela equipe:

1. **Um vendedor por pedido.** O Req. 013 diz que "só o vendedor do pedido marca como enviado", o que pressupõe um único vendedor por pedido. Por isso `Pedido` tem `vendedorId`. Se o carrinho tiver peças de vendedores diferentes, o checkout precisará gerar um pedido por vendedor.
2. **Taxa Pix congelada no pedido.** O ER do README só mostra `comissao_vigente`; o modelo também guarda `taxaPixPercentual`, pelo mesmo motivo (o valor exibido no simulador deve ser o valor recebido). A taxa Pix foi tratada como percentual.
3. **Frete e repasse.** A documentação não diz se o frete fixo é repassado ao vendedor. Os lançamentos do UC05 foram descritos sem fixar esse ponto.
4. **Prazo da cobrança Pix igual ao da reserva.** A cobrança é criada com `expiraEm` igual ao fim da reserva, para que a peça e o Pix expirem juntos.
5. **Pagamento após a expiração.** Se o Pix for pago depois que a reserva expirou, o UC05 apenas registra o caso para conferência pelo admin; estorno e conciliação não estão definidos no MVP.
6. **Workers como serviço ECS separado**, usando a mesma imagem da API (diagrama de implantação). Portas internas, sub-redes da VPC e o registro de imagens Docker (por exemplo, Amazon ECR) também não estão definidos e não foram detalhados.
7. **Perfil de acesso.** `PerfilAcesso` tem apenas `USUARIO` e `ADMIN`, porque uma mesma conta compra e vende; ser vendedor é derivado de ter chave Pix.
8. **Endpoints e nomes de métodos** (`POST /checkout`, `PATCH /pedidos/{id}/envio` etc.) são propostas de projeto, já que a API ainda não existe.

## Rastreabilidade

| Regra ou decisão | Fonte | Onde aparece |
| --- | --- | --- |
| CPF por hash, Argon2id, JWT + refresh httpOnly, bloqueio | Req. 001; README "Segurança e LGPD" | UC01 (classes e sequência) |
| Só publica quem tem chave Pix | Req. 002 | UC02 |
| 1 a 5 fotos, JPG/PNG/WebP, URL pré-assinada, preço > 0 | Req. 004; arquitetura 5.2 | UC02 |
| Mesmo cálculo no front e no back | Req. 005; ADR-002 | UC02, UC05, componentes |
| Full-text sem acento, filtros, paginação | Req. 007; arquitetura 4.3 | UC03 |
| Disponibilidade lida do banco, não do cache | Req. 008; arquitetura 7.2 | UC03, UC04 |
| Reserva atômica, expiração por job | Req. 010; ADR-003 | UC04 |
| Pedido aguardando pagamento com comissão congelada | Req. 011; ADR-006 | UC04, UC06 |
| Webhook assinado e idempotente | Req. 011; ADR-005 | UC05 |
| Máquina de estados e posse do pedido | Req. 013 | UC06 |
| Livro-razão, saldo pendente e disponível | Req. 014; ADR-006 | UC05, UC06 |
| Monolito modular e `app/core` | ADR-001; arquitetura 3.1 | componentes |
| Docker, ECS Fargate, RDS, ElastiCache, S3, Cloudflare | ADR-007; arquitetura 4.4, 7.3, 8 | implantação |

## Como visualizar e gerar os diagramas

**Visualizar:** abra os arquivos `.svg` direto no GitHub ou em qualquer navegador. Também é possível abrir os `.puml` no VS Code com a extensão *PlantUML* (jebbs.plantuml), que mostra a pré-visualização com `Alt+D`.

**Gerar novamente** (necessário após editar um `.puml`):

1. Instale Java 11+, Graphviz (usado no layout dos diagramas de classes, componentes e implantação) e o PlantUML. No macOS, `brew install plantuml` instala os três; em outros sistemas, instale Java e Graphviz pelo gerenciador de pacotes e baixe o `plantuml.jar` em [plantuml.com/download](https://plantuml.com/download).
2. Na raiz do repositório, execute:

```bash
./docs/uml/gerar-diagramas.sh
```

O script valida a sintaxe dos 14 arquivos (`-checkonly`) e gera um `.svg` ao lado de cada `.puml`. Para gerar PNG, use `FORMATO=png ./docs/uml/gerar-diagramas.sh`. Para usar o `.jar`, defina `PLANTUML="java -jar /caminho/plantuml.jar"`.

Os SVGs desta versão foram gerados com o PlantUML 1.2026.10 e o Graphviz 16.1.1.
