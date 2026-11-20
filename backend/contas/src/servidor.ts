import { fileURLToPath } from "node:url";
import { carregarEnv } from "../../comum/seguranca.js";
import { criarApp } from "./app.js";
import { abrirBanco } from "./banco.js";
import { lerConfig } from "./config.js";
import { garantirAdminMaster } from "./seed.js";

// .env da raiz do repositório (fora do Git), se existir. Na hospedagem as variáveis vêm do painel.
carregarEnv(fileURLToPath(new URL("../../../.env", import.meta.url)));

const config = lerConfig();
const banco = await abrirBanco(config.urlBanco);
const seed = await garantirAdminMaster(banco, process.env);
if (seed === "sem-config") console.warn("[contas] ADMIN_MASTER_EMAIL/ADMIN_MASTER_PASSWORD não definidos: sem administradora master.");
else if (seed !== "ok") console.log(`[contas] administradora master ${seed}.`);
if (!config.urlBanco) {
  console.warn("[contas] DATABASE_URL não definido: banco em memória (as contas somem ao reiniciar).");
}

const servidor = criarApp(banco, config).listen(config.porta, "127.0.0.1", () => {
  console.log(`[contas] serviço de contas em http://localhost:${config.porta}/auth`);
});

for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, () => {
    servidor.close(() => {
      banco.fechar().finally(() => process.exit(0));
    });
  });
}
