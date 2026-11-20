/** Navegação (mobile e desktop), acessibilidade das páginas públicas e cabeçalhos de segurança. */
describe("navegação", () => {
  it("home → menu (teclado) → vitrine → peça", () => {
    cy.visit("/");
    cy.checarAcessibilidade();

    // menu do celular (<dialog> nativo, que também fecha com Esc): abre, fecha e devolve o foco ao botão
    cy.get('button[aria-label="Abrir menu"]').click();
    cy.get('dialog[aria-label="Menu"]').should("be.visible");
    cy.checarAcessibilidade('dialog[aria-label="Menu"]');
    cy.get('[aria-label="Fechar menu"]').click();
    cy.get('dialog[aria-label="Menu"]').should("not.be.visible");
    cy.get('button[aria-label="Abrir menu"]').should("have.focus");

    cy.visit("/catalogo");
    cy.checarAcessibilidade();
    cy.pecaDisponivel().then((peca) => {
      cy.get(`a[href="/peca/${peca.id}"]`).first().click();
      cy.location("pathname").should("eq", `/peca/${peca.id}`);
      cy.contains("h1", peca.titulo);
      cy.checarAcessibilidade();
    });
  });

  it("busca na vitrine sem diferenciar acentos", () => {
    cy.visit("/catalogo");
    cy.get('input[name="busca"]').filter(":visible").first().type("JAQUETA{enter}");
    cy.location("search").should("contain", "busca=JAQUETA");
    cy.contains(/jaqueta/i);
  });

  it("peça que não existe mostra a página de não encontrado", () => {
    cy.visit("/peca/nao-existe", { failOnStatusCode: false });
    cy.contains("h1", "essa página ainda tá");
  });

  it("no desktop, mostra as categorias no cabeçalho", () => {
    cy.viewport(1280, 800);
    cy.visit("/");
    cy.get('nav[aria-label="Categorias"]').first().should("be.visible");
    cy.get('button[aria-label="Abrir menu"]').should("not.be.visible");
    cy.checarAcessibilidade();
  });

  for (const [nome, preferencias] of [
    ["escuro", { tema: "escuro", altoContraste: false, escalaFonte: 1 }],
    ["alto contraste", { tema: "claro", altoContraste: true, escalaFonte: 1 }],
  ] as const) {
    it(`tema ${nome} continua acessível (contraste WCAG AA)`, () => {
      cy.visit("/", {
        onBeforeLoad(janela) {
          janela.localStorage.setItem("desapego-preferencias", JSON.stringify({ state: preferencias, version: 0 }));
        },
      });
      cy.checarAcessibilidade();
    });
  }
});

describe("segurança HTTP", () => {
  it("páginas saem com CSP e os cabeçalhos de segurança, sem x-powered-by", () => {
    cy.request("/").then(({ headers }) => {
      expect(headers["content-security-policy"]).to.contain("default-src 'self'").and.contain("frame-ancestors 'none'");
      expect(headers["x-frame-options"]).to.eq("DENY");
      expect(headers["x-content-type-options"]).to.eq("nosniff");
      expect(headers["referrer-policy"]).to.eq("strict-origin-when-cross-origin");
      expect(headers).not.to.have.property("x-powered-by");
    });
  });

  it("API: rotas genéricas fechadas e integração exige X-API-Key", () => {
    cy.pecaDisponivel().then((peca) => {
      cy.request({ method: "DELETE", url: `/api/pecas/${peca.id}`, failOnStatusCode: false }).its("status").should("eq", 404);
      cy.request({ method: "PATCH", url: `/api/pecas/${peca.id}`, body: { status: "vendida" }, failOnStatusCode: false })
        .its("status")
        .should("eq", 404);
    });
    cy.request({ url: "/api/integracao/pedidos", failOnStatusCode: false }).its("status").should("eq", 401);
    cy.request({ url: "/api/integracao/pedidos", headers: { "X-API-Key": "errada" }, failOnStatusCode: false })
      .its("status")
      .should("eq", 401);
  });

  it("CORS: origem de fora é recusada", () => {
    cy.pecaDisponivel().then((peca) => {
      cy.request({
        method: "POST",
        url: `/api/pecas/${peca.id}/liberar`,
        headers: { Origin: "https://site-malicioso.com" },
        failOnStatusCode: false,
      })
        .its("status")
        .should("eq", 403);
    });
  });
});
