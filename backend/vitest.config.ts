import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["contas/src/**/*.test.ts", "catalogo/src/**/*.test.ts", "comum/**/*.test.ts"],
  },
});
