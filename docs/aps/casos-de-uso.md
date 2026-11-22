# Casos de uso e histórias de usuário

Os seis casos de uso seguem o caminho de uma venda no Desa Pego, do cadastro até o saldo liberado. Juntos, eles cobrem os
cinco módulos do MVP e os três perfis: compradora, vendedora e administradora.

- **Diagrama de casos de uso:** [casos-de-uso-desa-pego.svg](../uml/casos-de-uso/casos-de-uso-desa-pego.svg)
- **Diagramas de sequência:** um por caso de uso, em [docs/uml/sequencia](../uml/sequencia).
- **Requisitos de origem:** [REQUISITOS.md](../../REQUISITOS.md).

| UC | Caso de uso | Ator principal | Requisitos | Situação |
| --- | --- | --- | --- | --- |
| UC01 | Cadastrar conta e autenticar-se | Visitante | 001 | implementado |
| UC02 | Publicar anúncio com simulação de ganho | Vendedora | 004, 005 (regra do 002) | em desenvolvimento (Módulo 02) |
| UC03 | Buscar peças na vitrine e consultar detalhes | Visitante ou compradora | 007, 008 | implementado |
| UC04 | Reservar peças e fechar a compra com Pix | Compradora | 010, 011 | implementado (padrão Facade) |
| UC05 | Confirmar o pagamento Pix | Provedor Pix | 011, 014 | implementado (padrão Facade, Pix simulado) |
| UC06 | Acompanhar a entrega e liberar o saldo | Vendedora e compradora | 013, 014 | implementado |

O diagrama também mostra o **UC07 · Administrar a plataforma** (comissão, frete, taxa do Pix, repasses, ocultar anúncios
e bloquear contas). Ele aparece para mostrar o ator Administradora, mas não está entre as seis descrições pedidas.

---

## UC01 · Cadastrar conta e autenticar-se

| Item | Descrição |
| --- | --- |
| **Ator principal** | Visitante |
| **Objetivo** | Criar uma conta e entrar no sistema para poder comprar e vender. |
| **Pré-condições** | Nenhuma. |
| **Pós-condições** | A conta existe. A pessoa tem um token de acesso (JWT de 15 minutos) e um cookie httpOnly para renovar a sessão. |
| **Inclui** | Validar CPF. |

**Fluxo principal (cadastro)**
1. A visitante abre `/cadastro` e informa nome, e-mail, CPF e senha.
2. O site confere o formato no navegador: dígitos do CPF e senha forte.
3. O serviço de contas valida de novo. Ele guarda o CPF cifrado (AES-256-GCM), com um hash HMAC para garantir que cada CPF seja único, e a senha com Argon2id.
4. O sistema cria a conta e a sessão e leva a pessoa para `/conta`.

**Fluxo principal (login)**
1. A pessoa informa e-mail e senha em `/entrar`.
2. O serviço confere a senha e devolve o token de acesso e o cookie de renovação.

**Fluxos alternativos**
- **A1 · Dados inválidos:** o sistema mostra o campo com erro (400).
- **A2 · E-mail ou CPF já cadastrados:** o sistema mostra uma mensagem clara (409). Quem garante é o banco.
- **A3 · Credenciais erradas:** o sistema mostra um erro genérico, sem dizer se o e-mail existe (401).
- **A4 · Muitas tentativas:** cinco erros em 15 minutos bloqueiam o login temporariamente (429). Mais de dez cadastros por hora vindos do mesmo IP também são recusados.
- **A5 · Conta bloqueada pela administração:** o login é recusado (403).

**História de usuário**
> Como **visitante**, quero **criar minha conta com CPF e entrar com e-mail e senha**, para **comprar e vender peças com segurança**.

**Critérios de aceitação**
- [x] O cadastro pede nome, e-mail, CPF e senha, e o CPF é validado pelos dígitos verificadores.
- [x] Um e-mail ou CPF repetido é recusado com mensagem clara.
- [x] A senha é guardada com Argon2id e nunca volta numa resposta. O CPF também nunca volta.
- [x] O login gera um JWT de 15 minutos e um refresh token num cookie httpOnly, que troca a cada uso.
- [x] Credenciais erradas mostram um erro genérico, e tentativas em excesso bloqueiam temporariamente.

---

## UC02 · Publicar anúncio com simulação de ganho

> **Situação:** o Módulo 02 está em desenvolvimento pelas colegas. A descrição segue os requisitos 004 e 005, e o
> diagrama de sequência deste caso de uso ainda mostra a versão planejada.

| Item | Descrição |
| --- | --- |
| **Ator principal** | Vendedora (usuária com chave Pix cadastrada) |
| **Objetivo** | Anunciar uma peça sabendo quanto vai receber pela venda. |
| **Pré-condições** | Estar logada e ter chave Pix cadastrada (Req. 002). |
| **Pós-condições** | A peça aparece na vitrine como disponível, ligada à conta da vendedora (`vendedoraId`). |
| **Inclui** | Simular ganho (preço sugerido). |

**Fluxo principal**
1. A vendedora abre "anunciar peça" e preenche título, descrição, categoria, tamanho, marca, condição e de 1 a 5 fotos.
2. Enquanto ela digita o preço, o simulador mostra a comissão, a taxa do Pix e o valor líquido, além da faixa de preço sugerida para a categoria e a condição.
3. A vendedora confirma e o anúncio é publicado.

**Fluxos alternativos**
- **A1 · Sem chave Pix:** o sistema pede o cadastro da chave antes de publicar.
- **A2 · Foto inválida:** formato diferente de JPG, PNG ou WebP, ou arquivo grande demais, é recusado.
- **A3 · Preço fora da sugestão:** o sistema só avisa. A vendedora pode manter o preço.
- **A4 · Editar ou excluir peça reservada ou vendida:** o sistema bloqueia.

**História de usuário**
> Como **vendedora**, quero **anunciar uma peça e ver quanto vou receber enquanto digito o preço**, para **decidir o
> preço sem surpresas**.

**Critérios de aceitação**
- [ ] O anúncio tem título, descrição, categoria, tamanho, marca, condição, preço em centavos (maior que zero) e de 1 a 5 fotos.
- [ ] O simulador mostra preço, comissão, taxa do Pix e valor líquido em tempo real. O cálculo é o mesmo do backend.
- [ ] O sistema sugere uma faixa de preço pela tabela da administração, e a vendedora pode ignorar a sugestão.
- [ ] A vendedora só edita, pausa ou exclui os próprios anúncios, e nunca uma peça reservada ou vendida.

---

## UC03 · Buscar peças na vitrine e consultar detalhes

| Item | Descrição |
| --- | --- |
| **Ator principal** | Visitante ou compradora (não precisa de login) |
| **Objetivo** | Encontrar uma peça e ver os detalhes dela antes de comprar. |
| **Pré-condições** | Nenhuma. |
| **Pós-condições** | Nenhuma: o caso de uso só lê dados. |

**Fluxo principal**
1. A pessoa abre `/catalogo` e busca por texto, filtra por categoria, tamanho, condição e faixa de preço, e escolhe a ordem.
2. O catálogo devolve só as peças ativas, já paginadas.
3. A pessoa abre uma peça e vê fotos, medidas, condição, preço, nome público e cidade da vendedora.
4. Se a peça estiver disponível, o botão "colocar na sacola" aparece e leva ao UC04.

**Fluxos alternativos**
- **A1 · Parâmetro inválido** (por exemplo, preço mínimo maior que o máximo): o sistema devolve 400 indicando o campo.
- **A2 · Peça inexistente ou ocultada pela administração:** aparece uma página de "não encontrada".
- **A3 · Peça reservada ou vendida:** o botão de compra é trocado pelo aviso correspondente.

**História de usuário**
> Como **compradora**, quero **buscar e filtrar as peças da vitrine e ver os detalhes de cada uma**, para **encontrar
> rápido algo do meu tamanho e do meu orçamento**.

**Critérios de aceitação**
- [x] A vitrine lista só peças ativas: sem vendidas e sem as ocultadas pela administração.
- [x] A busca por título, marca e descrição não diferencia maiúsculas, minúsculas e acentos.
- [x] Há filtros por categoria, tamanho, condição e faixa de preço, ordenação por mais recentes e por preço, e paginação.
- [x] A página da peça mostra se ela está disponível, reservada ou vendida, e desabilita a compra quando não está disponível.

---

## UC04 · Reservar peças e fechar a compra com Pix

| Item | Descrição |
| --- | --- |
| **Ator principal** | Compradora (logada) |
| **Objetivo** | Garantir peças únicas por alguns minutos e gerar o Pix para pagar. |
| **Pré-condições** | Estar logada. As peças estão disponíveis e têm vendedora cadastrada. |
| **Pós-condições** | Existe uma compra aguardando pagamento, com o Pix, e **um pedido por vendedora** no Módulo 05. |
| **Inclui** | Reservar peça por 15 minutos; gerar cobrança Pix. |
| **Estendido por** | Cancelar pedido com Pix vencido. |
| **Padrão de projeto** | Facade: as rotas chamam só o `CompraFacade`. Ver [padrao-de-projeto.md](padrao-de-projeto.md). |

**Fluxo principal**
1. A compradora clica em "colocar na sacola". A peça fica reservada no nome dela por 15 minutos.
2. Na sacola, ela vê as peças, o subtotal, o frete fixo (um por vendedora) e o total.
3. No checkout, o nome e o e-mail já vêm da conta. Ela informa o CEP e o ViaCEP completa o endereço.
4. Ela clica em "gerar Pix".
5. O `CompraFacade` confere as reservas e cria um pedido no Módulo 05 para cada vendedora da sacola, com a comissão e a taxa do Pix congeladas.
6. Ele grava a compra com o Pix copia-e-cola e o prazo. O site mostra o QR Code e a contagem regressiva.

**Fluxos alternativos**
- **A1 · Sem login:** o site pede para entrar ou criar conta (401).
- **A2 · Peça já reservada ou vendida por outra pessoa:** a reserva é recusada (409).
- **A3 · Peça da própria compradora:** a reserva é recusada (403).
- **A4 · Reserva vencida antes de gerar o Pix:** o sistema pede para voltar à sacola (409).
- **A5 · Serviço de pedidos fora do ar:** a fachada cancela os pedidos que já tinham entrado e não cria nada (502). A reserva continua e dá para tentar de novo.
- **A6 · Prazo do Pix acabou (extensão):** a cada minuto, o sistema cancela a compra, cancela os pedidos no Módulo 05 e devolve as peças à vitrine.

**História de usuário**
> Como **compradora**, quero **reservar as peças que escolhi e pagar com Pix**, para **garantir peças únicas sem que
> outra pessoa compre antes de mim**.

**Critérios de aceitação**
- [x] Só quem está logada reserva. A reserva dura 15 minutos e só quem reservou libera a peça.
- [x] Duas pessoas não conseguem reservar a mesma peça. A segunda recebe "acabou de ser reservada".
- [x] Preço, frete e total são calculados no servidor, nunca vêm do navegador.
- [x] A compra aparece em "minhas compras", e cada vendedora vê a sua parte em "minhas vendas".
- [x] Com o Pix vencido, o pedido é cancelado e as peças voltam à vitrine.

---

## UC05 · Confirmar o pagamento Pix

| Item | Descrição |
| --- | --- |
| **Ator principal** | Provedor Pix (sistema externo). No MVP, é simulado pelo botão "simular pagamento". |
| **Objetivo** | Registrar que a compra foi paga, marcar as peças como vendidas e lançar o valor na carteira das vendedoras. |
| **Pré-condições** | Existe uma compra aguardando pagamento (UC04). O provedor conhece a API key. |
| **Pós-condições** | A compra está paga, as peças estão vendidas, e cada pedido do Módulo 05 está PAGO, com os lançamentos de venda, comissão e taxa do Pix. |
| **Padrão de projeto** | Facade (`CompraFacade.confirmarPagamento`). |

**Fluxo principal**
1. O provedor avisa o pagamento em `POST /integracao/pagamentos/{id}/confirmar`, com a X-API-Key.
2. A fachada confirma cada pedido no Módulo 05, que muda o status para PAGO e lança o valor da vendedora como pendente.
3. Só depois disso a fachada marca a compra como paga e as peças como vendidas.

**Fluxos alternativos**
- **A1 · API key ausente ou errada:** o sistema recusa (401).
- **A2 · Aviso repetido:** o sistema responde 200 e não lança nada de novo, porque a operação é idempotente no catálogo e no Módulo 05.
- **A3 · Pagamento depois do prazo:** a compra é cancelada e o sistema responde 409.
- **A4 · Módulo 05 fora do ar:** nada muda no catálogo (502), e o provedor pode repetir com segurança.

**História de usuário**
> Como **vendedora**, quero **que o pagamento confirmado entre automaticamente na minha carteira**, para **saber que
> a venda foi paga e enviar a peça**.

**Critérios de aceitação**
- [x] Só uma chamada com a API key confirma um pagamento, e a chave nunca chega ao navegador.
- [x] Confirmar duas vezes não duplica o valor na carteira.
- [x] A comissão e a taxa usadas são as congeladas na hora da compra.
- [x] Se uma parte falhar, nada fica pela metade e a confirmação pode ser repetida.

---

## UC06 · Acompanhar a entrega e liberar o saldo

| Item | Descrição |
| --- | --- |
| **Atores** | Vendedora e compradora. A administradora paga o repasse. |
| **Objetivo** | Levar o pedido pago até a entrega e liberar o dinheiro da vendedora. |
| **Pré-condições** | O pedido está PAGO (UC05). |
| **Pós-condições** | O pedido está ENTREGUE e o valor passou de pendente para disponível na carteira. A vendedora pode pedir o repasse. |

**Fluxo principal**
1. A vendedora vê a venda em `/conta/vendas`, com o endereço de entrega, e clica em "marcar como enviado" (PAGO → ENVIADO).
2. A compradora acompanha em `/conta/compras` e, ao receber, clica em "confirmar recebimento" (ENVIADO → ENTREGUE).
3. A carteira lança a liberação: o valor sai do pendente e vai para o disponível.
4. A vendedora pede o repasse em `/conta/carteira`, e a administradora marca o repasse como pago no painel.

**Fluxos alternativos**
- **A1 · Quem não participa do pedido tenta mudar o status:** o sistema recusa (403).
- **A2 · Transição fora da ordem** (por exemplo, enviar antes de pagar): o sistema recusa (409).
- **A3 · Repasse maior que o saldo disponível:** o sistema recusa (422).

**História de usuário**
> Como **vendedora**, quero **marcar o envio e ver o saldo ser liberado quando a compradora confirmar o recebimento**,
> para **receber o dinheiro da venda com segurança para as duas partes**.

**Critérios de aceitação**
- [x] Status na ordem: aguardando pagamento → pago → enviado → entregue, ou cancelado.
- [x] Só a vendedora marca o envio, e só a compradora confirma o recebimento.
- [x] O endereço de entrega aparece só para a vendedora do pedido.
- [x] O saldo é a soma dos lançamentos (livro-razão) e só fica disponível depois da entrega.
- [x] O repasse não pode passar do saldo disponível.
