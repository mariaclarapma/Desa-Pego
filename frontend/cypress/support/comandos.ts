/// <reference types="cypress" />
import type { Result } from "axe-core";
import { gerarCpf } from "./cpf";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Auditoria WCAG 2.1 A e AA com o axe na página atual (falha se houver violação). */
      checarAcessibilidade(contexto?: string): Chainable<void>;
      /** Cria uma conta nova pela tela /cadastro (com um CPF válido e único) e devolve o e-mail usado. */
      cadastrar(senha?: string): Chainable<string>;
      /** Primeira peça disponível na vitrine (lida da API). */
      pecaDisponivel(): Chainable<{ id: string; titulo: string; precoCentavos: number }>;
      /**
       * Cria uma conta pela API (mais rápido que a tela). O cookie da sessão fica no navegador,
       * então a pessoa já está logada; devolve o id e o token de acesso.
       */
      criarConta(nome?: string): Chainable<{ id: string; email: string; accessToken: string }>;
    }
  }
}

const listar = (violacoes: Result[]) =>
  violacoes.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n");

Cypress.Commands.add("checarAcessibilidade", (contexto?: string) => {
  cy.injectAxe();
  cy.checkA11y(
    // elementos [data-decorativo] (marca d'água do rodapé) são pura decoração: WCAG 1.4.3 os isenta
    { include: [[contexto ?? "html"]], exclude: [["[data-decorativo]"]] },
    { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } },
    (violacoes) => {
      cy.task("log", `\n[axe] ${violacoes.length} violação(ões):\n${listar(violacoes)}`);
    },
  );
});

Cypress.Commands.add("cadastrar", (senha = "garimpo123") => {
  const email = `e2e-${Date.now()}-${Cypress._.random(1e6)}@exemplo.com`;
  cy.visit("/cadastro");
  cy.findCampo("nome completo").type("Teste Cypress");
  cy.findCampo("e-mail").type(email);
  cy.findCampo("CPF").type(gerarCpf());
  cy.findCampo("senha").type(senha);
  cy.findCampo("confirmar senha").type(senha);
  cy.contains("button[type=submit]", /criar minha conta/i).click();
  cy.location("pathname").should("eq", "/conta");
  return cy.wrap(email);
});

Cypress.Commands.add("criarConta", (nome = "Compradora Cypress") => {
  const email = `e2e-${Date.now()}-${Cypress._.random(1e6)}@exemplo.com`;
  return cy
    .request("POST", "/api/auth/cadastro", { nome, email, cpf: gerarCpf(), senha: "garimpo123" })
    .then(({ body }) => ({ id: body.usuario.id as string, email, accessToken: body.accessToken as string }));
});

Cypress.Commands.add("pecaDisponivel", () =>
  // a vitrine é paginada ({ itens, total, pagina, porPagina }): pede a página maior possível
  cy.request("/api/pecas?porPagina=48").then(({ body }) => {
    const agora = Date.now();
    type PecaApi = { id: string; titulo: string; precoCentavos: number; status: string; reservadaAte?: string };
    const livre = (body as { itens: PecaApi[] }).itens.find(
      (p) => p.status === "disponivel" || (p.status === "reservada" && !!p.reservadaAte && new Date(p.reservadaAte).getTime() <= agora),
    );
    if (!livre) throw new Error("nenhuma peça disponível na vitrine");
    return { id: livre.id, titulo: livre.titulo, precoCentavos: livre.precoCentavos };
  }),
);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Campo de formulário pelo texto do <label> (é assim que um leitor de tela encontra). */
      findCampo(rotulo: string): Chainable<JQuery<HTMLElement>>;
    }
  }
}

Cypress.Commands.add("findCampo", (rotulo: string) =>
  cy
    .contains("label", new RegExp(`^\s*${Cypress._.escapeRegExp(rotulo)}\s*$`, "i"))
    .invoke("attr", "for")
    .then((id) => cy.get(`#${CSS.escape(String(id))}`)),
);

export {};
