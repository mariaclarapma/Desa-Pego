/** Autenticação: cadastro, login, logout, erros e proteção da rota privada /conta. */
describe("autenticação", () => {
  it("cadastro abre a sessão e leva para /conta", () => {
    cy.cadastrar();
    cy.contains("h2", "seus dados");
    cy.contains("dd", "Teste Cypress");
    cy.checarAcessibilidade();
  });

  it("logout encerra a sessão e /conta volta a pedir login", () => {
    cy.cadastrar();
    cy.contains("button", "sair da conta").click();
    cy.location("pathname").should("eq", "/entrar");
    cy.visit("/conta");
    cy.location("pathname").should("eq", "/entrar");
  });

  it("login com a senha certa entra; com a errada mostra mensagem genérica", () => {
    cy.cadastrar().then((email) => {
      cy.contains("button", "sair da conta").click();
      cy.location("pathname").should("eq", "/entrar");

      cy.findCampo("e-mail").type(email);
      cy.findCampo("senha").type("senhaErrada9");
      cy.contains("button[type=submit]", /^entrar$/).click();
      // não revela se o e-mail existe
      cy.get("[role=alert]").should("contain.text", "e-mail ou senha incorretos");

      cy.findCampo("senha").clear().type("garimpo123");
      cy.contains("button[type=submit]", /^entrar$/).click();
      cy.location("pathname").should("eq", "/conta");
    });
  });

  it("valida o formulário de cadastro antes de enviar", () => {
    cy.visit("/cadastro");
    cy.contains("button[type=submit]", /criar minha conta/i).click();
    cy.get("[aria-invalid=true]").should("have.length.at.least", 2);
    cy.findCampo("nome completo").should("have.focus");
    cy.findCampo("nome completo").type("Ana");
    cy.findCampo("e-mail").type("ana@");
    cy.findCampo("senha").type("curta");
    cy.contains("button[type=submit]", /criar minha conta/i).click();
    cy.contains("informe nome e sobrenome");
  });

  it("e-mail repetido não cria outra conta", () => {
    cy.cadastrar().then((email) => {
      cy.contains("button", "sair da conta").click();
      cy.location("pathname").should("eq", "/entrar");
      cy.visit("/cadastro");
      cy.findCampo("nome completo").type("Outra Pessoa");
      cy.findCampo("e-mail").type(email);
      cy.findCampo("senha").type("garimpo123");
      cy.findCampo("confirmar senha").type("garimpo123");
      cy.contains("button[type=submit]", /criar minha conta/i).click();
      cy.get("[role=alert]").should("contain.text", "já existe uma conta");
    });
  });

  it("telas de login e cadastro são acessíveis (WCAG 2.1 AA)", () => {
    cy.visit("/entrar");
    cy.checarAcessibilidade();
    cy.visit("/cadastro");
    cy.checarAcessibilidade();
  });
});
