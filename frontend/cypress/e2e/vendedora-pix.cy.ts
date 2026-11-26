/** Req. 002: perfil de vendedora e chave Pix em /conta/vendedora (ponta a ponta, com o serviço de contas). */
describe("perfil de vendedora e chave Pix", () => {
  it("cadastra perfil e chave, troca a chave e continua salvo depois de sair e entrar", () => {
    cy.cadastrar().then((email) => {
      cy.contains("a", "perfil de vendedora").click();
      cy.location("pathname").should("eq", "/conta/vendedora");
      cy.contains("não dá para publicar anúncios");
      cy.checarAcessibilidade();

      // nome público e cidade
      cy.contains("button", "editar perfil").click();
      cy.findCampo("nome público (opcional)").should("have.focus").type("Brechó Cypress");
      cy.findCampo("cidade").type("Brasília/DF");
      cy.contains("button", "salvar perfil").click();
      cy.get("[role=status]").should("contain.text", "seu perfil de vendedora foi atualizado");
      cy.contains("dd", "Brechó Cypress");

      // chave Pix: inválida, senha errada e, por fim, certa
      cy.contains("button", "cadastrar chave Pix").click();
      cy.findCampo("CPF").check();
      cy.findCampo("chave Pix (CPF)").type("529.982.247-24");
      cy.findCampo("senha atual").type("garimpo123");
      cy.contains("form button[type=submit]", "cadastrar chave Pix").click();
      cy.contains("CPF inválido");
      cy.checarAcessibilidade();

      cy.findCampo("chave Pix (CPF)").clear().type("529.982.247-25");
      cy.findCampo("senha atual").clear().type("senhaErrada1");
      cy.contains("form button[type=submit]", "cadastrar chave Pix").click();
      cy.get("[role=alert]").should("contain.text", "senha atual incorreta");

      cy.findCampo("senha atual").type("garimpo123");
      cy.contains("form button[type=submit]", "cadastrar chave Pix").click();
      cy.get("[role=status]").should("contain.text", "chave Pix cadastrada");
      cy.contains("dd", "***.982.247-**");
      cy.contains("529.982.247-25").should("not.exist");

      // troca para celular
      cy.contains("button", "trocar chave Pix").click();
      cy.findCampo("celular").check();
      cy.findCampo("chave Pix (celular)").type("(61) 91234-5678");
      cy.findCampo("senha atual").type("garimpo123");
      cy.contains("form button[type=submit]", "trocar chave Pix").click();
      cy.get("[role=status]").should("contain.text", "sua chave Pix foi trocada");
      cy.contains("dd", "(61) *****-5678");

      // sai e entra de novo: tudo salvo
      cy.visit("/conta");
      // o cabeçalho também tem "sair da conta" (menu do celular, escondido): usa o botão da página
      cy.get("main").contains("button", "sair da conta").click();
      cy.location("pathname").should("eq", "/entrar");
      cy.findCampo("e-mail").type(email);
      cy.findCampo("senha").type("garimpo123");
      cy.contains("button[type=submit]", /^entrar na minha conta$/).click();
      cy.location("pathname").should("eq", "/conta");
      cy.visit("/conta/vendedora");
      cy.contains("dd", "Brechó Cypress");
      cy.contains("dd", "Brasília/DF");
      cy.contains("dd", "(61) *****-5678");
    });
  });

  it("a API nunca devolve a chave completa, e o perfil público não mostra dados pessoais", () => {
    cy.cadastrar().then((email) => {
      cy.request("POST", "/api/auth/login", { email, senha: "garimpo123" }).then(({ body }) => {
        const auth = { Authorization: `Bearer ${body.accessToken}` };
        cy.request({ method: "PUT", url: "/api/auth/me/pix", headers: auth, body: { tipo: "cpf", chave: "52998224725", senhaAtual: "garimpo123" } })
          .its("body")
          .then((resposta) => {
            expect(JSON.stringify(resposta)).not.to.contain("52998224725");
            cy.request(`/api/auth/vendedoras/${resposta.vendedora.id}`).its("body").then((publico) => {
              expect(Object.keys(publico.vendedora).sort()).to.deep.equal(["cidade", "id", "nomePublico"]);
              expect(JSON.stringify(publico)).not.to.contain(email);
            });
          });
      });
    });
  });
});
