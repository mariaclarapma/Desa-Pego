import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { exigirApiKey, lerLista, lerOrigens, lerTrustProxy } from "./seguranca.js";

describe("configuração de segurança", () => {
  it("lerLista separa por vírgula e ignora espaços e vazios", () => {
    expect(lerLista(" a , b,,c ")).toEqual(["a", "b", "c"]);
    expect(lerLista(undefined)).toEqual([]);
  });

  it("CORS_ORIGENS: obrigatório em produção; padrão local em desenvolvimento", () => {
    expect(() => lerOrigens({ NODE_ENV: "production" })).toThrow(/CORS_ORIGENS/);
    expect(lerOrigens({ NODE_ENV: "production", CORS_ORIGENS: "https://desapego.onrender.com" })).toEqual(["https://desapego.onrender.com"]);
    expect(lerOrigens({})).toEqual(["http://localhost:3000"]);
  });

  it("TRUST_PROXY: padrão loopback; número vira saltos", () => {
    expect(lerTrustProxy()).toBe("loopback");
    expect(lerTrustProxy("2")).toBe(2);
    expect(lerTrustProxy("loopback, uniquelocal")).toBe("loopback, uniquelocal");
  });

  it("API key: aceita qualquer uma das chaves configuradas", async () => {
    const app = express().get("/x", exigirApiKey(["chave-um", "chave-dois"]), (_req, res) => {
      res.json({ ok: true });
    });
    await request(app).get("/x").set("X-API-Key", "chave-dois").expect(200);
    await request(app).get("/x").set("X-API-Key", "chave-tres").expect(401);
  });
});
