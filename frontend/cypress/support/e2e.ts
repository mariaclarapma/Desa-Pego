import "@cypress/code-coverage/support";
import "cypress-axe";
import "./comandos";

// Toda violação da Content Security Policy derruba o teste: assim os E2E também validam a CSP.
Cypress.on("window:before:load", (janela) => {
  janela.document.addEventListener("securitypolicyviolation", (evento) => {
    throw new Error(`CSP bloqueou ${evento.violatedDirective}: ${evento.blockedURI}`);
  });
});
