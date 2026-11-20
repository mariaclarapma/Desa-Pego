// Testes E2E (Cypress): build do site, sobe site + contas + catálogo e roda o Cypress.
//   node scripts/e2e.mjs              → roda os testes
//   node scripts/e2e.mjs --cobertura  → build instrumentado, grava a cobertura em frontend/.nyc_output
//   node scripts/e2e.mjs --abrir      → abre o Cypress interativo (sem build novo)
import { execSync, spawn } from "node:child_process";
import { copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const args = new Set(process.argv.slice(2));
const cobertura = args.has("--cobertura");
const abrir = args.has("--abrir");
const segredo = () => randomBytes(32).toString("base64url");

// ambiente só dos testes: banco de contas em memória e segredos descartáveis
const env = {
  ...process.env,
  DATABASE_URL: "",
  JWT_SECRET: process.env.JWT_SECRET || segredo(),
  API_KEYS: process.env.API_KEYS || segredo(),
  CORS_ORIGENS: "http://localhost:3000",
  PORT: "3000",
  ...(cobertura ? { COBERTURA: "1" } : {}),
};
// o VS Code define ELECTRON_RUN_AS_NODE=1 nos processos que abre; com ela, o Cypress (Electron) não inicia
delete env.ELECTRON_RUN_AS_NODE;
const rodar = (comando) => execSync(comando, { stdio: "inherit", env });

copyFileSync("backend/db.seed.json", "backend/db.json"); // catálogo sempre no estado inicial
if (!abrir) rodar("npm run build -w frontend");

const servidores = [
  "npm run start:contas -w backend",
  "npm run start:catalogo -w backend",
  "npm run start -w frontend",
];
const cypress = `wait-on -t 120000 http://localhost:3000 http://localhost:3001/pecas http://localhost:3002/auth/saude && npm run ${abrir ? "cypress:abrir" : "cypress:rodar"} -w frontend`;
const filho = spawn(
  "npx",
  ["concurrently", "-k", "-s", "command-cypress", "-n", "contas,catalogo,site,cypress", ...servidores.map((s) => `"${s}"`), `"${cypress}"`],
  { stdio: "inherit", env, shell: true },
);
filho.on("exit", (codigo) => {
  copyFileSync("backend/db.seed.json", "backend/db.json");
  process.exit(codigo ?? 1);
});
