import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // os testes do Cypress (cypress/) não rodam no Vitest
    include: ["src/**/*.test.{ts,tsx}"],
    // `npm run cobertura`: formato do Istanbul, para juntar com a cobertura do Cypress
    coverage: {
      provider: "istanbul",
      reporter: ["json", "text-summary"],
      reportsDirectory: "coverage-unit",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    },
  },
});
