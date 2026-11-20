/**
 * Fluxo de compra (CRUD do pedido pelo site): reservar na sacola, remover, criar o pedido no
 * checkout, consultar o pedido e confirmar o pagamento Pix (integração com API key no servidor).
 */
describe("compra", () => {
  it("colocar na sacola e remover libera a peça", () => {
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

  it("checkout cria o pedido, mostra o Pix e confirma o pagamento", () => {
    cy.pecaDisponivel().then((peca) => {
      cy.visit(`/peca/${peca.id}`);
      cy.contains("button", "colocar na sacola").click();
      cy.location("pathname").should("eq", "/carrinho");
      cy.contains("a", "fechar com Pix").click();

      cy.location("pathname").should("eq", "/checkout");
      cy.checarAcessibilidade();
      cy.findCampo("nome completo").type("Compradora Teste");
      cy.findCampo("e-mail").type("compradora@exemplo.com");
      // sem internet para o ViaCEP nos testes: o endereço é digitado à mão
      cy.intercept("GET", "https://viacep.com.br/**", { statusCode: 200, body: { erro: true } });
      cy.findCampo("CEP").type("70000-000").blur();
      cy.findCampo("rua / avenida").type("Rua das Flores");
      cy.findCampo("número").type("10");
      cy.findCampo("bairro").type("Centro");
      cy.findCampo("cidade").type("Brasília");
      cy.findCampo("UF").type("DF");
      cy.contains("button", "gerar Pix").click();

      cy.location("pathname").should("match", /^\/pedido\//);
      cy.contains("pague com Pix pra garantir");
      cy.contains(peca.titulo);
      cy.checarAcessibilidade();
      cy.request(`/api/pecas/${peca.id}`).its("body.status").should("eq", "reservada");

      cy.contains("button", "simular pagamento").click();
      cy.contains("h1", "confirmado");
      cy.request(`/api/pecas/${peca.id}`).its("body.status").should("eq", "vendida");
    });
  });

  it("uma peça já reservada não pode ser reservada de novo", () => {
    cy.pecaDisponivel().then((peca) => {
      cy.request("POST", `/api/pecas/${peca.id}/reservar`);
      cy.visit(`/peca/${peca.id}`);
      cy.contains("reservada por outra pessoa");
      cy.request("POST", `/api/pecas/${peca.id}/liberar`);
    });
  });
});
