import { gerarCpf } from "../support/cpf";
/**
 * Módulo 05: painel da administração. A administradora master de teste é criada pela seed
 * com ADMIN_MASTER_EMAIL/ADMIN_MASTER_PASSWORD (scripts/e2e.mjs) e chega aqui por Cypress.env.
 */
const entrarComoAdmin = () => {
  cy.visit("/entrar");
  cy.findCampo("e-mail").type(Cypress.env("ADMIN_EMAIL"));
  cy.findCampo("senha").type(Cypress.env("ADMIN_SENHA"), { log: false });
  cy.contains("button[type=submit]", /^entrar$/).click();
  cy.location("pathname").should("eq", "/conta");
};

describe("painel da administração", () => {
  it("quem não é administradora: a tela mostra acesso restrito e o backend responde 403", () => {
    cy.cadastrar().then((email) => {
      cy.visit("/admin");
      cy.contains("h2", "acesso").should("contain.text", "restrito");
      cy.checarAcessibilidade();

      // o backend é a barreira: com o token de uma usuária comum, todas as rotas do painel dão 403
      cy.request("POST", "/api/auth/login", { email, senha: "garimpo123" }).then(({ body }) => {
        const headers = { Authorization: `Bearer ${body.accessToken}` };
        for (const url of [
          "/api/gestao/admin/resumo",
          "/api/auth/admin/usuarios",
          "/api/admin/pecas",
          "/api/gestao/admin/repasses",
          "/api/gestao/admin/configuracao",
          "/api/admin/frete",
        ]) {
          cy.request({ url, headers, failOnStatusCode: false }).its("status").should("eq", 403);
        }
        const alteracoes: [string, object][] = [
          ["/api/gestao/admin/comissao", { comissaoPontosBase: 0 }],
          ["/api/gestao/admin/taxa-pix", { taxaPixPontosBase: 0 }],
          ["/api/admin/frete", { freteCentavos: 0 }],
          ["/api/gestao/admin/precos-sugeridos", { faixas: [{ categoria: "bolsas", condicao: "otimo_estado", minimoCentavos: 1, maximoCentavos: 2 }] }],
        ];
        for (const [url, body] of alteracoes) {
          cy.request({ method: "PUT", url, headers, body, failOnStatusCode: false }).its("status").should("eq", 403);
        }
      });
    });
  });

  it("a administradora master entra no painel pela conta e vê todas as seções (acessível)", () => {
    entrarComoAdmin();
    cy.get("main").contains("a", "painel da administração").click();
    cy.location("pathname").should("eq", "/admin");
    for (const secao of ["visão geral", "usuárias", "anúncios", "pedidos", "comissão da plataforma", "taxa do Pix", "frete fixo", "preço sugerido", "repasses"]) {
      cy.contains("h2", secao);
    }
    cy.contains("percentual atual");
    cy.checarAcessibilidade();
  });

  it("altera a comissão, bloqueia e desbloqueia uma usuária, oculta e reexibe um anúncio", () => {
    // uma usuária para bloquear, criada pela API
    const email = `bloquear-${Date.now()}@exemplo.com`;
    cy.request("POST", "/api/auth/cadastro", { nome: "Usuária Bloqueável", email, cpf: gerarCpf(), senha: "garimpo123" });
    cy.clearCookies();
    entrarComoAdmin();
    cy.visit("/admin");

    // comissão: vale só para pedidos novos
    cy.findCampo("nova comissão (%)").should("have.value", "10,00").clear().type("12,5");
    cy.contains("button", "salvar comissão").click();
    cy.contains("comissão alterada para 12,50%");
    cy.findCampo("nova comissão (%)").clear().type("10");
    cy.contains("button", "salvar comissão").click();
    cy.contains("comissão alterada para 10,00%");

    // bloquear: a usuária não consegue mais entrar
    cy.get('button[aria-label="bloquear Usuária Bloqueável"]').click();
    cy.contains("Usuária Bloqueável foi bloqueada.");
    cy.request({ method: "POST", url: "/api/auth/login", body: { email, senha: "garimpo123" }, failOnStatusCode: false }).its("status").should("eq", 403);
    cy.get('button[aria-label="desbloquear Usuária Bloqueável"]').click();
    cy.contains("Usuária Bloqueável foi desbloqueada.");

    // anúncio: ocultar tira da vitrine
    cy.pecaDisponivel().then((peca) => {
      cy.get(`button[aria-label="ocultar ${peca.titulo}"]`).click();
      cy.contains(`“${peca.titulo}” foi ocultado.`);
      cy.request({ url: `/api/pecas/${peca.id}`, failOnStatusCode: false }).its("status").should("eq", 404);
      cy.get(`button[aria-label="reexibir ${peca.titulo}"]`).click();
      cy.contains(`“${peca.titulo}” voltou para a vitrine.`);
      cy.request(`/api/pecas/${peca.id}`).its("status").should("eq", 200);
    });
  });
});

describe("painel da administração: taxa do Pix, frete e preço sugerido", () => {
  it("altera os valores pelo painel, o site passa a usá-los e depois volta ao padrão", () => {
    entrarComoAdmin();
    cy.visit("/admin");

    // sem conferir o valor inicial: se uma tentativa anterior falhou no meio, ele pode não ser o padrão
    cy.findCampo("nova taxa do Pix (%)").should("not.have.value", "").clear().type("0,99");
    cy.contains("button", "salvar taxa").click();
    cy.contains("taxa do Pix alterada para 0,99%");
    cy.request("/api/gestao/config").its("body.taxaPixPontosBase").should("eq", 99);

    cy.findCampo("novo frete (R$)").should("not.have.value", "").clear().type("24,50");
    cy.contains("button", "salvar frete").click();
    cy.contains(/frete alterado para R\$\s24,50/);
    cy.request("/api/config").its("body.freteCentavos").should("eq", 2450);

    cy.get('input[aria-label="máximo de bolsas, ótimo estado"]').invoke("val").then((maximoOriginal) => {
      cy.get('input[aria-label="mínimo de bolsas, ótimo estado"]').invoke("val").then((minimoOriginal) => {
        cy.get('input[aria-label="mínimo de bolsas, ótimo estado"]').clear().type("999");
        cy.contains("button", "salvar tabela").click();
        cy.contains("confira a faixa de bolsas, ótimo estado");
        cy.get('input[aria-label="mínimo de bolsas, ótimo estado"]').clear().type(String(minimoOriginal));
        cy.get('input[aria-label="máximo de bolsas, ótimo estado"]').clear().type(String(maximoOriginal));
        cy.contains("button", "salvar tabela").click();
        cy.contains("tabela de preço sugerido salva");
      });
    });
    cy.checarAcessibilidade();

    // volta ao padrão para não afetar os outros testes
    cy.findCampo("nova taxa do Pix (%)").clear().type("0");
    cy.contains("button", "salvar taxa").click();
    cy.contains("taxa do Pix alterada para 0,00%");
    cy.findCampo("novo frete (R$)").clear().type("19,90");
    cy.contains("button", "salvar frete").click();
    cy.contains(/frete alterado para R\$\s19,90/);
  });
});

describe("painel da administração: painel de vendas", () => {
  it("mostra vendas, comissão, estados, categorias e vendedoras; a demonstração vem marcada como fictícia", () => {
    cy.viewport(1280, 900);
    entrarComoAdmin();
    cy.visit("/admin#vendas");
    cy.get("#vendas").within(() => {
      cy.contains("h3", "vendas");
      cy.contains("h3", "comissão da plataforma");
      cy.contains("h3", "para onde vão as peças");
      cy.contains("h3", "o que mais vende");
      cy.contains("h3", "cidades que mais recebem");
      cy.contains("h3", "vendedoras que mais vendem");
      // força a demonstração (o banco dos testes pode ter ou não vendas reais)
      cy.get("button[aria-pressed]").then(($b) => {
        if ($b.attr("aria-pressed") === "false") cy.wrap($b).click();
      });
      cy.contains("dados fictícios");
      cy.contains("estes números são fictícios");
      cy.contains("li", "SP");
    });
    // a rota é só da administradora
    cy.request({ url: "/api/gestao/admin/dashboard?demo=1", failOnStatusCode: false }).its("status").should("eq", 401);
    cy.checarAcessibilidade();
    // capturas para conferir o visual (só da área visível, sem o cabeçalho fixo por cima)
    const foto = (nome: string, alvo = "#vendas") => {
      cy.get("header").invoke("css", "visibility", "hidden");
      cy.get(alvo).first().scrollIntoView({ offset: { top: -10, left: 0 } });
      cy.screenshot(nome, { capture: "viewport", overwrite: true });
      cy.get("header").invoke("css", "visibility", "visible");
    };
    // nada pode passar da largura da tela (sem rolagem horizontal)
    cy.window().then((win) => {
      const largos = [...win.document.querySelectorAll("#vendas *")]
        .filter((e) => e.getBoundingClientRect().right > win.innerWidth + 1)
        .map((e) => `${e.tagName.toLowerCase()}.${String(e.getAttribute("class")).slice(0, 40)}`);
      expect(largos, "elementos mais largos que a tela").to.deep.equal([]);
    });
    foto("painel-de-vendas-desktop");
    cy.get("#vendas").find('rect[role="img"]').eq(10).focus();
    cy.get('[role="tooltip"]').should("be.visible");
    foto("painel-de-vendas-tooltip", "#vendas figure");
    cy.get("#vendas").find('rect[role="img"]').eq(10).blur();
    foto("painel-de-vendas-rankings", "#vendas ul[aria-label='para onde vão as peças']");

    cy.viewport(375, 812);
    foto("painel-de-vendas-celular", "#vendas figure");

    cy.viewport(1280, 900);
    cy.document().then((doc) => doc.documentElement.setAttribute("data-tema", "escuro"));
    foto("painel-de-vendas-escuro", "#vendas dl");
  });
});
