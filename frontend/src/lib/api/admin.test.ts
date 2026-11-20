import { afterEach, describe, expect, it, vi } from "vitest";
import { admin, AdminErro, percentualParaPontosBase, pontosBaseParaTexto } from "./admin";

describe("comissão: texto do campo ↔ pontos-base (sem float)", () => {
  it.each([
    ["10", 1000],
    ["12,5", 1250],
    ["12.50", 1250],
    ["0,01", 1],
    ["33,33%", 3333],
    [" 7 ", 700],
  ])("%s → %i", (texto, pb) => {
    expect(percentualParaPontosBase(texto)).toBe(pb);
  });

  it.each(["", "abc", "1,234", "-5", "1e2", "12,"])("recusa %s", (texto) => {
    expect(percentualParaPontosBase(texto)).toBeNull();
  });

  it("formata para a tela", () => {
    expect(pontosBaseParaTexto(1250)).toBe("12,50%");
    expect(pontosBaseParaTexto(5)).toBe("0,05%");
  });
});

describe("chamadas do painel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mandam o token e usam o serviço certo de cada parte", async () => {
    const fetchFalso = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ usuarios: [] })));
    vi.stubGlobal("fetch", fetchFalso);
    await admin.usuarias("tok", "ana souza");
    await admin.pedidos("tok", "PAGO");
    await admin.ocultar("tok", "p1", true);
    expect(fetchFalso.mock.calls.map((c) => c[0])).toEqual([
      "/api/auth/admin/usuarios?busca=ana%20souza",
      "/api/gestao/admin/pedidos?status=PAGO",
      "/api/admin/pecas/p1/ocultar",
    ]);
    expect((fetchFalso.mock.calls[0][1]!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("transforma 403 do backend em erro com a mensagem dele", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: "acesso restrito à administração." }), { status: 403 })));
    await expect(admin.resumo("tok")).rejects.toMatchObject({ status: 403, message: "acesso restrito à administração." });
  });

  it("sem conexão: mensagem amigável", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(admin.resumo("tok")).rejects.toBeInstanceOf(AdminErro);
  });
});
