import { gerarCpf } from "../support/cpf";

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
    cy.get("main").contains("button", "sair da conta").click();
    cy.location("pathname").should("eq", "/entrar");
    cy.visit("/conta");
    cy.location("pathname").should("eq", "/entrar");
  });

  it("sair também fica no menu (celular) e no cabeçalho (computador)", () => {
    cy.cadastrar();
    cy.get('button[aria-label="Abrir menu"]').click();
    cy.get("dialog[open]").within(() => {
      cy.contains("Teste Cypress");
      cy.contains("a", "painel da administração").should("not.exist");
      cy.contains("button", "sair da conta").click();
    });
    cy.location("pathname").should("eq", "/entrar");
    cy.visit("/conta");
    cy.location("pathname").should("eq", "/entrar");

    cy.viewport(1280, 800);
    cy.cadastrar();
    cy.get('nav[aria-label="Atalhos da conta"]').contains("button", /^sair$/).click();
    cy.location("pathname").should("eq", "/entrar");
  });

  it("login com a senha certa entra; com a errada mostra mensagem genérica", () => {
    cy.cadastrar().then((email) => {
      cy.get("main").contains("button", "sair da conta").click();
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
      cy.get("main").contains("button", "sair da conta").click();
      cy.location("pathname").should("eq", "/entrar");
      cy.visit("/cadastro");
      cy.findCampo("nome completo").type("Outra Pessoa");
      cy.findCampo("e-mail").type(email);
      cy.findCampo("CPF").type(gerarCpf());
      cy.findCampo("senha").type("garimpo123");
      cy.findCampo("confirmar senha").type("garimpo123");
      cy.contains("button[type=submit]", /criar minha conta/i).click();
      cy.get("[role=alert]").should("contain.text", "já existe uma conta");
    });
  });

  it("CPF: máscara, validação no formulário e CPF repetido recusado sem criar outra conta (Req. 001)", () => {
    const cpf = gerarCpf();
    const email = `cpf-${Date.now()}-${Cypress._.random(1e6)}@exemplo.com`;
    cy.request("POST", "/api/auth/cadastro", { nome: "Dona Do Cpf", email, cpf, senha: "garimpo123" }).then(({ body }) => {
      // a resposta nunca devolve o CPF
      expect(JSON.stringify(body)).not.to.contain(cpf);
    });
    cy.clearCookies();

    cy.visit("/cadastro");
    cy.findCampo("CPF").type("5299822472").should("have.value", "529.982.247-2");
    cy.findCampo("nome completo").type("Outra Pessoa");
    cy.findCampo("e-mail").type(`outra-${email}`);
    cy.findCampo("senha").type("garimpo123");
    cy.findCampo("confirmar senha").type("garimpo123");
    cy.contains("button[type=submit]", /criar minha conta/i).click();
    cy.findCampo("CPF").should("have.attr", "aria-invalid", "true").and("have.focus");
    cy.contains("o CPF precisa ter 11 dígitos");

    // o mesmo CPF da primeira conta (digitado sem pontuação): o backend recusa
    cy.findCampo("CPF").clear().type(cpf).should("have.value", cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"));
    cy.contains("button[type=submit]", /criar minha conta/i).click();
    cy.get("[role=alert]").should("contain.text", "CPF já está vinculado").and("not.contain.text", cpf);
    cy.location("pathname").should("eq", "/cadastro");
    cy.checarAcessibilidade();
  });

  it("telas de login e cadastro são acessíveis (WCAG 2.1 AA)", () => {
    cy.visit("/entrar");
    cy.checarAcessibilidade();
    cy.visit("/cadastro");
    cy.checarAcessibilidade();
  });
});
