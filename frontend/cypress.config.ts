import codeCoverageTask from "@cypress/code-coverage/task";
import { defineConfig } from "cypress";

const cobertura = process.env.COBERTURA === "1";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    // mobile primeiro: os fluxos rodam num celular de 375 px; um teste confere também o desktop
    viewportWidth: 375,
    viewportHeight: 812,
    defaultCommandTimeout: 8000,
    retries: { runMode: 1, openMode: 0 },
    setupNodeEvents(on, config) {
      codeCoverageTask(on, config);
      on("task", {
        log(mensagem: string) {
          console.log(mensagem);
          return null;
        },
      });
      return config;
    },
    env: {
      // cobertura só no `npm run cobertura` (build instrumentado)
      coverage: cobertura,
      codeCoverage: { url: "http://localhost:3000/cobertura-e2e", exclude: ["cypress/**/*.*"] },
    },
  },
  video: false,
  screenshotOnRunFailure: true,
});
