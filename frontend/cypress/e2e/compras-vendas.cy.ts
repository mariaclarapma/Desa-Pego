/**
 * Req. 013: acompanhar o pedido da compra até a entrega, nas telas /conta/compras e /conta/vendas.
 * O pedido entra pela rota interna do Módulo 05 (com a API key), como o checkout do Módulo 04 fará.
 */
const SENHA = "garimpo123";

type Conta = { id: string; email: string; nome: string };

function criarConta(nome: string): Cypress.Chainable<Conta> {
  const email = `${nome.split(" ")[0].toLowerCase()}-${Date.now()}-${Cypress._.random(1e6)}@exemplo.com`;
  return cy.request("POST", "/api/auth/cadastro", { nome, email, senha: SENHA }).then(({ body }) => {
    cy.clearCookies();
    return cy.wrap({ id: body.usuario.id as string, email, nome });
  });
}

function entrar(conta: Conta) {
  cy.clearCookies();
  cy.visit("/entrar");
  cy.findCampo("e-mail").type(conta.email);
  cy.findCampo("senha").type(SENHA);
  cy.contains("button[type=submit]", /^entrar$/).click();
  cy.location("pathname").should("eq", "/conta");
}

const interno = () => ({ "X-API-Key": Cypress.env("API_KEY") });

/** Pedido pago da compradora para a vendedora (o "checkout" e o "webhook do Pix"). */
function pedidoPago(compradora: Conta, vendedora: Conta): Cypress.Chainable<string> {
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
    .then(({ body }) =>
      cy
        .request({ method: "POST", url: `/api/gestao/interno/pedidos/${body.id}/pagamento-confirmado`, headers: interno() })
        .then(() => body.id as string),
    );
}

describe("compras e vendas (Req. 013)", () => {
  it("da compra paga até o recebimento: cada uma vê e faz só a sua parte", () => {
    criarConta("Vendedora Teste").then((vendedora) => {
      criarConta("Compradora Teste").then((compradora) => {
        pedidoPago(compradora, vendedora).then((id) => {
          const titulo = `pedido #${id.slice(0, 6)}`;

          // compradora: vê a compra paga, sem endereço e sem o botão de enviar
          entrar(compradora);
          cy.get("main").contains("a", "minhas compras").click();
          cy.location("pathname").should("eq", "/conta/compras");
          cy.get(`article[aria-labelledby="titulo-${id}"]`).within(() => {
            cy.contains("h2", titulo);
            cy.contains("Saia midi plissada");
            cy.contains("R$ 109,80");
            cy.contains("Rua das Flores").should("not.exist");
            cy.contains("button", "marcar como enviado").should("not.exist");
            cy.get('[aria-current="step"]').should("contain.text", "pago");
          });
          cy.checarAcessibilidade();

          // vendedora: vê o endereço e quanto recebe, e marca como enviado
          entrar(vendedora);
          cy.visit("/conta/vendas");
          cy.get(`article[aria-labelledby="titulo-${id}"]`).within(() => {
            cy.contains("Rua das Flores, 10");
            cy.contains("você recebe");
            cy.contains("button", "marcar como enviado").click();
            cy.contains("button", "sim, já enviei").should("have.focus").click();
            cy.get('[aria-current="step"]').should("contain.text", "enviado");
          });
          cy.contains("pedido marcado como enviado");
          cy.checarAcessibilidade();

          // compradora: confirma o recebimento
          entrar(compradora);
          cy.visit("/conta/compras");
          cy.get(`article[aria-labelledby="titulo-${id}"]`).within(() => {
            cy.contains("button", "confirmar recebimento").click();
            cy.contains("não dá para desfazer");
            cy.contains("button", "sim, recebi").click();
            cy.get('[aria-current="step"]').should("contain.text", "recebido");
          });
          cy.contains("recebimento confirmado");

          // filtro por status
          cy.contains("button", /^recebido$/).click().should("have.attr", "aria-pressed", "true");
          cy.contains("h2", titulo);
          cy.contains("button", /^cancelado$/).click();
          cy.contains("nada com esse status");
        });
      });
    });
  });

  it("quem não participa do pedido recebe 403 do backend", () => {
    criarConta("Vendedora Dois").then((vendedora) => {
      criarConta("Compradora Dois").then((compradora) => {
        pedidoPago(compradora, vendedora).then((id) => {
          criarConta("Intrusa Teste").then((intrusa) => {
            cy.request("POST", "/api/auth/login", { email: intrusa.email, senha: SENHA }).then(({ body }) => {
              const headers = { Authorization: `Bearer ${body.accessToken}` };
              cy.request({ method: "POST", url: `/api/gestao/pedidos/${id}/enviar`, headers, failOnStatusCode: false })
                .its("status")
                .should("eq", 403);
              cy.request({ url: `/api/gestao/pedidos/${id}`, headers, failOnStatusCode: false }).its("status").should("eq", 403);
            });
          });
        });
      });
    });
  });

  it("sem compras: mostra o convite para a vitrine (e a página é acessível)", () => {
    cy.cadastrar();
    cy.visit("/conta/compras");
    cy.contains("nada por aqui ainda");
    cy.contains("a", "garimpar na vitrine");
    cy.checarAcessibilidade();
  });
});
