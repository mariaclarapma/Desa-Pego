// Cobertura combinada (meta: 80% de linhas e instruções):
// Vitest do frontend + Vitest do backend + Cypress E2E (build instrumentado), num relatório só.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";

const rodar = (comando, cwd = ".") => execSync(comando, { stdio: "inherit", cwd });
for (const pasta of [".nyc_output", "coverage", "frontend/.nyc_output", "frontend/coverage-unit", "backend/coverage-unit"]) {
  rmSync(pasta, { recursive: true, force: true });
}

// cada Vitest roda na pasta do próprio pacote (com --root a partir da raiz, o relatório falha)
rodar("npx vitest run --coverage", "frontend");
rodar("npx vitest run --coverage", "backend");
rodar("node scripts/e2e.mjs --cobertura");

mkdirSync(".nyc_output");
const partes = {
  "frontend/coverage-unit/coverage-final.json": "unit-frontend.json",
  "backend/coverage-unit/coverage-final.json": "unit-backend.json",
  "frontend/.nyc_output/out.json": "e2e-cypress.json",
};
for (const [origem, destino] of Object.entries(partes)) {
  if (!existsSync(origem)) throw new Error(`cobertura não encontrada: ${origem}`);
  copyFileSync(origem, `.nyc_output/${destino}`);
}
// relatório em coverage/index.html; falha se ficar abaixo de 80% (configurado em scripts/nyc-relatorio.json)
rodar("npx nyc report --nycrc-path scripts/nyc-relatorio.json");
