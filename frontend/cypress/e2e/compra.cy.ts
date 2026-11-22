/**
 * Fluxo de compra pelo site (issue #31): a sacola e o checkout exigem conta; o pedido criado
 * no checkout chega ao Módulo 05 e, depois do Pix, aparece em "minhas compras".
 */
const preencherEntrega = () => {
  // sem internet para o ViaCEP nos testes: o endereço é digitado à mão
  cy.intercept("GET", "https://viacep.com.br/**", { statusCode: 200, body: { erro: true } });
  cy.findCampo("CEP").type("70000-000").blur();
  cy.findCampo("rua / avenida").type("Rua das Flores");
  cy.findCampo("número").type("10");
  cy.findCampo("bairro").type("Centro");
  cy.findCampo("cidade").type("Brasília");
  cy.findCampo("UF").type("DF");
};

describe("compra", () => {
  it("sem conta, a sacola pede para entrar e a peça continua disponível", () => {
    cy.clearCookies();
    cy.pecaDisponivel().then((peca) => {
      cy.visit(`/peca/${peca.id}`);
      cy.contains("button", "colocar na sacola").click();
      cy.contains('[role="alert"]', "pra reservar, entre na sua conta");
      cy.contains("a", "entrar").should("have.attr", "href", "/entrar");
      cy.checarAcessibilidade();
      cy.request(`/api/pecas/${peca.id}`).its("body.status").should("eq", "disponivel");
    });
  });

  it("colocar na sacola e remover libera a peça", () => {
    cy.criarConta();
    cy.pecaDisponivel().then((peca) => {
      cy.visit(`/peca/${peca.id}`);
      cy.contains("button", "colocar na sacola").click();
      cy.location("pathname").should("eq", "/carrinho");
      cy.contains(peca.titulo);
      cy.checarAcessibilidade();

      cy.get(`button[aria-label="remover ${peca.titulo} da sacola"]`).click();
      cy.contains("h1", "nada por aqui ainda");
      cy.request(`/api/pecas/${peca.id}`).its("body.status").should("eq", "disponivel");
    });
  });

  it("checkout cria o pedido, mostra o Pix, confirma o pagamento e a compra aparece em minhas compras", () => {
    cy.criarConta("Compradora Teste");
    cy.pecaDisponivel().then((peca) => {
      cy.visit(`/peca/${peca.id}`);
      cy.contains("button", "colocar na sacola").click();
      cy.location("pathname").should("eq", "/carrinho");
      cy.contains("a", "fechar com Pix").click();

      cy.location("pathname").should("eq", "/checkout");
      // nome e e-mail já vêm da conta
      cy.findCampo("nome completo").should("have.value", "Compradora Teste");
      cy.checarAcessibilidade();
      preencherEntrega();
      cy.contains("button", "gerar Pix").click();

      cy.location("pathname").should("match", /^\/pedido\//);
      cy.contains("pague com Pix pra garantir");
      cy.contains(peca.titulo);
      cy.checarAcessibilidade();
      cy.request(`/api/pecas/${peca.id}`).its("body.status").should("eq", "reservada");

      cy.contains("button", "simular pagamento").click();
      cy.contains("h1", "confirmado");
      cy.request(`/api/pecas/${peca.id}`).its("body.status").should("eq", "vendida");

      // Módulo 05: a compra paga está em "minhas compras"
      cy.contains("a", "acompanhar em minhas compras").click();
      cy.location("pathname").should("eq", "/conta/compras");
      cy.contains("article", peca.titulo).should("contain.text", "pago");
    });
  });

  it("o checkout sem conta manda para o login", () => {
    cy.clearCookies();
    cy.visit("/checkout");
    cy.location("pathname").should("match", /^\/(entrar|carrinho)$/);
  });

  it("uma peça reservada por outra pessoa não pode ser reservada de novo", () => {
    cy.pecaDisponivel().then((peca) => {
      cy.criarConta("Outra Pessoa").then((outra) => {
        const comToken = { Authorization: `Bearer ${outra.accessToken}` };
        cy.request({ method: "POST", url: `/api/pecas/${peca.id}/reservar`, headers: comToken });
        cy.clearCookies();
        cy.visit(`/peca/${peca.id}`);
        cy.contains("reservada por outra pessoa");
        cy.request({ method: "POST", url: `/api/pecas/${peca.id}/liberar`, headers: comToken });
      });
    });
  });

  it("API: sacola e pedido sem login são recusados (401)", () => {
    cy.clearCookies();
    cy.pecaDisponivel().then((peca) => {
      cy.request({ method: "POST", url: `/api/pecas/${peca.id}/reservar`, failOnStatusCode: false }).its("status").should("eq", 401);
      cy.request({ method: "POST", url: "/api/pedidos", body: {}, failOnStatusCode: false }).its("status").should("eq", 401);
    });
  });
});
