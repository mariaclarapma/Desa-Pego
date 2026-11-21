import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["contas/src/**/*.test.ts", "catalogo/src/**/*.test.ts", "pedidos/src/**/*.test.ts", "comum/**/*.test.ts"],
    // `npm run cobertura`: formato do Istanbul, para juntar com a cobertura do Cypress
    coverage: {
      provider: "istanbul",
      reporter: ["json", "text-summary"],
      reportsDirectory: "coverage-unit",
      include: ["contas/src/**/*.ts", "catalogo/src/**/*.ts", "pedidos/src/**/*.ts", "comum/**/*.ts"],
      exclude: ["**/*.test.ts", "contas/src/banco-teste.ts"],
    },
  },
});
