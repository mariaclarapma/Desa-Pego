// `npm start` em produção: sobe os três serviços (num processo) e o site (noutro) com `node`, sem os processos
// intermediários do `npm run`, do `concurrently` e do `tsx`. No plano grátis do Render (512 MB) esses
// intermediários somavam centenas de MB e o serviço caía por falta de memória.
//
// Se um processo sair, os outros são encerrados e este também sai com erro, para o Render reiniciar o
// serviço inteiro (o mesmo comportamento do `concurrently -k` de antes).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const nextBin = createRequire(new URL("../frontend/package.json", import.meta.url)).resolve("next/dist/bin/next");

// --max-old-space-size: o Node calcula o limite do heap pela memória da máquina inteira, não pela do
// contêiner, e demora a coletar o lixo. Com um teto, ele coleta antes de passar dos 512 MB.
const processos = [
  // contas, catálogo e pedidos, cada um na sua porta, no mesmo processo (backend/servicos.mjs)
  { nome: "servicos", args: ["--max-old-space-size=160", "backend/servicos.mjs"] },
  // o Render informa a porta pública em PORT; o `next start` já a lê sozinho
  { nome: "site", args: ["--max-old-space-size=200", nextBin, "start"], cwd: "frontend" },
];

const filhos = [];
let encerrando = false;

function encerrar(codigo) {
  if (encerrando) return;
  encerrando = true;
  for (const filho of filhos) if (filho.exitCode === null) filho.kill("SIGTERM");
  // dá alguns segundos para fecharem as conexões com o banco
  setTimeout(() => process.exit(codigo), 5000).unref();
  Promise.all(filhos.map((f) => (f.exitCode === null ? new Promise((ok) => f.once("exit", ok)) : null))).then(() => process.exit(codigo));
}

for (const { nome, args, cwd } of processos) {
  const filho = spawn(process.execPath, args, { cwd: cwd ? `${raiz}${cwd}` : raiz, stdio: "inherit", env: process.env });
  filho.on("exit", (codigo, sinal) => {
    if (!encerrando) console.error(`[iniciar] ${nome} saiu (${sinal ?? `código ${codigo}`}); encerrando os outros.`);
    encerrar(1);
  });
  filhos.push(filho);
}

for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => encerrar(0));
