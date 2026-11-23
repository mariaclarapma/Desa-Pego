/** CRUD da própria conta em /conta: ver (READ), editar e trocar senha (UPDATE), excluir (DELETE). */
describe("CRUD da conta", () => {
  it("READ: mostra nome e e-mail da conta logada", () => {
    cy.cadastrar().then((email) => {
      cy.contains("dd", "Teste Cypress");
      cy.contains("dd", email);
    });
  });

  it("UPDATE: edita o nome sem senha e o e-mail com a senha atual", () => {
    cy.cadastrar().then((email) => {
      cy.contains("button", "editar dados").click();
      cy.findCampo("nome completo").should("have.focus").clear().type("Teste Editado");
      cy.contains("button", "salvar alterações").click();
      cy.get("[role=status]").should("contain.text", "seus dados foram atualizados");
      cy.contains("dd", "Teste Editado");

      // trocar o e-mail pede a senha atual
      const novo = email.replace("@", "+novo@");
      cy.contains("button", "editar dados").click();
      cy.findCampo("e-mail").clear().type(novo);
      cy.findCampo("senha atual").should("be.visible");
      cy.contains("button", "salvar alterações").click();
      cy.contains("confirme sua senha atual");
      cy.findCampo("senha atual").type("garimpo123");
      cy.contains("button", "salvar alterações").click();
      cy.contains("dd", novo);
      cy.checarAcessibilidade();
    });
  });

  it("UPDATE: troca a senha e entra de novo com a senha nova", () => {
    cy.cadastrar().then((email) => {
      cy.contains("button", "alterar senha").click();
      cy.findCampo("senha atual").type("senhaErrada1");
      cy.findCampo("nova senha").type("brecho2026");
      cy.findCampo("confirmar nova senha").type("brecho2026");
      cy.contains("button", "trocar senha").click();
      cy.get("[role=alert]").should("contain.text", "senha atual incorreta");

      cy.findCampo("senha atual").type("garimpo123");
      cy.contains("button", "trocar senha").click();
      cy.get("[role=status]").should("contain.text", "senha alterada");

      cy.get("main").contains("button", "sair da conta").click();
      cy.location("pathname").should("eq", "/entrar");
      cy.findCampo("e-mail").type(email);
      cy.findCampo("senha").type("brecho2026");
      cy.contains("button[type=submit]", /^entrar na minha conta$/).click();
      cy.location("pathname").should("eq", "/conta");
    });
  });

  it("DELETE: pede confirmação e senha, exclui a conta e encerra a sessão", () => {
    cy.cadastrar().then((email) => {
      cy.contains("button", "excluir minha conta").click();
      cy.contains("h3", "tem certeza?").should("have.focus");
      // Esc cancela e devolve o foco ao botão
      cy.focused().type("{esc}");
      cy.contains("button", "excluir minha conta").should("have.focus").click();

      cy.contains("button", "excluir de vez").should("be.disabled");
      cy.contains("label", "entendo que a exclusão é definitiva").click();
      cy.findCampo("sua senha").type("garimpo123");
      cy.checarAcessibilidade();
      cy.contains("button", "excluir de vez").click();
      cy.contains("sua conta foi excluída");

      // a conta não existe mais
      cy.visit("/entrar");
      cy.findCampo("e-mail").type(email);
      cy.findCampo("senha").type("garimpo123");
      cy.contains("button[type=submit]", /^entrar na minha conta$/).click();
      cy.get("[role=alert]").should("contain.text", "e-mail ou senha incorretos");
    });
  });
});
