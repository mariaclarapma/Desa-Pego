/**
 * Req. 014: carteira da vendedora. Venda paga fica pendente, a entrega libera o saldo, o saque
 * nunca passa do disponível e o Pix manual da administração debita o saldo.
 * O pedido entra pela rota interna do Módulo 05 (API key), como o checkout do Módulo 04 fará.
 */
export {};

const SENHA = "garimpo123";

type Conta = { id: string; email: string; token: string };

function criarConta(nome: string): Cypress.Chainable<Conta> {
  const email = `${nome.split(" ")[0].toLowerCase()}-${Date.now()}-${Cypress._.random(1e6)}@exemplo.com`;
  return cy.request("POST", "/api/auth/cadastro", { nome, email, senha: SENHA }).then(({ body }) => {
    cy.clearCookies();
    return cy.wrap({ id: body.usuario.id as string, email, token: body.accessToken as string });
  });
}

const interno = () => ({ "X-API-Key": Cypress.env("API_KEY") });
const comToken = (c: Conta) => ({ Authorization: `Bearer ${c.token}` });

/** Pedido de R$ 89,90 + R$ 19,90 de frete, pago, enviado e recebido. Devolve o pedido. */
function vendaEntregue(compradora: Conta, vendedora: Conta) {
  return cy
    .request({
      method: "POST",
      url: "/api/gestao/interno/pedidos",
      headers: interno(),
      body: {
        compradoraId: compradora.id,
        vendedoraId: vendedora.id,
        itens: [{ id: "peca-e2e", titulo: "Saia midi plissada", precoCentavos: 8990 }],
        freteCentavos: 1990,
        endereco: { cep: "70000-000", logradouro: "Rua das Flores", numero: "10", bairro: "Asa Sul", cidade: "Brasília", uf: "DF" },
      },
    })
    .then(({ body: pedido }) => {
      cy.request({ method: "POST", url: `/api/gestao/interno/pedidos/${pedido.id}/pagamento-confirmado`, headers: interno() });
      cy.request({ method: "POST", url: `/api/gestao/pedidos/${pedido.id}/enviar`, headers: comToken(vendedora) });
      cy.request({ method: "POST", url: `/api/gestao/pedidos/${pedido.id}/confirmar-recebimento`, headers: comToken(compradora) });
      return cy.wrap(pedido as { id: string; vendedoraCentavos: number; comissaoCentavos: number; taxaPixCentavos: number; totalCentavos: number });
    });
}

const reais = (centavos: number) => `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;

describe("carteira da vendedora (Req. 014)", () => {
  it("venda entregue fica disponível, o extrato separa comissão e taxa, e o saque respeita o saldo", () => {
    criarConta("Vendedora Carteira").then((vendedora) => {
      criarConta("Compradora Carteira").then((compradora) => {
        vendaEntregue(compradora, vendedora).then((pedido) => {
          // os três lançamentos da venda somam o total cobrado
          expect(pedido.vendedoraCentavos + pedido.comissaoCentavos + pedido.taxaPixCentavos).to.eq(pedido.totalCentavos);

          cy.visit("/entrar");
          cy.findCampo("e-mail").type(vendedora.email);
          cy.findCampo("senha").type(SENHA);
          cy.contains("button[type=submit]", /^entrar$/).click();
          cy.location("pathname").should("eq", "/conta");
          cy.get("main").contains("a", "minha carteira").click();
          cy.location("pathname").should("eq", "/conta/carteira");

          cy.get('section[aria-labelledby="titulo-saldo"]').within(() => {
            cy.contains("dt", "disponível").next().should("have.text", reais(pedido.vendedoraCentavos));
            cy.contains("dt", "pendente").next().should("have.text", "R$ 0,00");
          });
          cy.get('ul[aria-label="lançamentos"]').within(() => {
            cy.contains("comissão da plataforma");
            cy.contains("taxa do Pix");
            cy.contains("entrega confirmada");
          });
          cy.checarAcessibilidade();

          // a tela barra antes, e o backend também (422) se alguém pular a tela
          cy.findCampo("valor do saque (R$)").type("9999");
          cy.contains("button", "pedir saque").click();
          cy.contains("passa do que você pode sacar");
          cy.request({
            method: "POST",
            url: "/api/gestao/carteira/repasses",
            headers: comToken(vendedora),
            body: { valorCentavos: pedido.vendedoraCentavos + 1 },
            failOnStatusCode: false,
          })
            .its("status")
            .should("eq", 422);

          cy.findCampo("valor do saque (R$)").clear().type("50");
          cy.contains("button", "pedir saque").click();
          cy.contains("saque de R$ 50,00 pedido");
          cy.contains("aguardando o Pix");
          cy.contains("dt", "pode sacar").next().should("have.text", reais(pedido.vendedoraCentavos - 5000));
        });
      });
    });
  });

  it("a carteira é privada: sem login vai para a tela de entrar e a API responde 401", () => {
    cy.visit("/conta/carteira");
    cy.location("pathname").should("eq", "/entrar");
    cy.request({ url: "/api/gestao/carteira", failOnStatusCode: false }).its("status").should("eq", 401);
  });
});
