import { criarApp } from "./app.js";
import { abrirBanco } from "./banco.js";
import { lerConfig } from "./config.js";

const config = lerConfig();
const banco = abrirBanco(config.arquivoBanco);
const servidor = criarApp(banco, config).listen(config.porta, "127.0.0.1", () => {
  console.log(`[contas] serviço de contas em http://localhost:${config.porta}/auth`);
});

for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, () => {
    servidor.close(() => {
      banco.fechar();
      process.exit(0);
    });
  });
}
