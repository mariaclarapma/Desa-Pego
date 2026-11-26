// Empacota cada serviço (contas, catálogo, pedidos) num único arquivo JavaScript, para rodar com `node`
// em produção, sem o tsx compilando TypeScript na memória do servidor. As dependências de
// node_modules ficam de fora do pacote (inclusive as nativas, como o argon2); só o @desapego/core, que
// é TypeScript, entra junto.
//
// A saída fica em <serviço>/dist/servidor.js, na mesma profundidade de <serviço>/src/, para os caminhos
// relativos ao arquivo (".env" da raiz, db.json, db.seed.json, fotos/) continuarem iguais.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pacote = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const externos = Object.keys({ ...pacote.dependencies, ...pacote.devDependencies }).filter((nome) => nome !== "@desapego/core");

for (const servico of ["contas", "catalogo", "pedidos"]) {
  await build({
    entryPoints: [new URL(`./${servico}/src/servidor.ts`, import.meta.url).pathname],
    outfile: new URL(`./${servico}/dist/servidor.js`, import.meta.url).pathname,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: externos,
    sourcemap: true,
    logLevel: "warning",
  });
  console.log(`[empacotar] ${servico}/dist/servidor.js`);
}
