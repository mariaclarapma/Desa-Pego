import { describe, expect, it } from "vitest";
import { lerConfig } from "./config.js";

const SEGREDO = "um-segredo-de-producao-com-mais-de-32-caracteres";
const ORIGENS = "https://desapego.onrender.com";

describe("lerConfig", () => {
  it("em produção exige JWT_SECRET forte e DATABASE_URL", () => {
    expect(() => lerConfig({ NODE_ENV: "production", CORS_ORIGENS: ORIGENS, DATABASE_URL: "postgresql://u:s@h/db" })).toThrow(/JWT_SECRET/);
    expect(() => lerConfig({ NODE_ENV: "production", CORS_ORIGENS: ORIGENS, JWT_SECRET: SEGREDO })).toThrow(/DATABASE_URL/);
    const config = lerConfig({ NODE_ENV: "production", CORS_ORIGENS: ORIGENS, JWT_SECRET: SEGREDO, DATABASE_URL: "postgresql://u:s@h/db" });
    expect(config.urlBanco).toBe("postgresql://u:s@h/db");
    expect(config.cookieSeguro).toBe(true);
    expect(config.origens).toEqual([ORIGENS]);
  });

  it("em desenvolvimento roda sem banco configurado (memória)", () => {
    const config = lerConfig({ NODE_ENV: "development" });
    expect(config.urlBanco).toBeUndefined();
    expect(config.cookieSeguro).toBe(false);
  });

  it("TRUST_PROXY: padrão loopback; número vira saltos; lista passa como texto", () => {
    expect(lerConfig({}).trustProxy).toBe("loopback");
    expect(lerConfig({ TRUST_PROXY: "2" }).trustProxy).toBe(2);
    expect(lerConfig({ TRUST_PROXY: "loopback, uniquelocal" }).trustProxy).toBe("loopback, uniquelocal");
  });
});
