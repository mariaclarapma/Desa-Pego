import { criarApp } from "./app.js";
import { abrirBanco } from "./banco.js";
import { lerConfig } from "./config.js";

// backend/.env (fora do Git), se existir. Na hospedagem as variáveis vêm do painel do Render.
try {
  process.loadEnvFile(".env");
} catch {
  // sem .env: segue com as variáveis do ambiente
}

const config = lerConfig();
const banco = await abrirBanco(config.urlBanco);
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
