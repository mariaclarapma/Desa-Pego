import { afterEach, describe, expect, it, vi } from "vitest";
import { ContaErro, renovarSessao, type Sessao } from "./contas";

const sessao: Sessao = {
  usuario: { id: "u1", nome: "Lúcia", email: "lucia@exemplo.com" },
  accessToken: "token-novo",
  expiraEm: "2026-11-26T12:15:00.000Z",
};

const resposta = (status: number, corpo: unknown = null) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renovarSessao", () => {
  it("chamadas simultâneas fazem um único POST /auth/refresh e recebem a mesma sessão", async () => {
    let responder: (r: Response) => void = () => {};
    const fetchMock = vi.fn(() => new Promise<Response>((r) => (responder = r)));
    vi.stubGlobal("fetch", fetchMock);

    const pedidos = [renovarSessao(), renovarSessao(), renovarSessao()];
    responder(resposta(200, sessao));

    const resultados = await Promise.all(pedidos);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/refresh", expect.objectContaining({ method: "POST" }));
    expect(resultados.every((s) => s.accessToken === "token-novo")).toBe(true);
  });

  it("depois que a renovação termina, a próxima faz um pedido novo", async () => {
    const fetchMock = vi.fn(async () => resposta(200, sessao));
    vi.stubGlobal("fetch", fetchMock);

    await renovarSessao();
    await renovarSessao();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uma falha chega a todas as chamadas que esperavam e não fica presa para a próxima", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(resposta(401, { erro: "sessão expirada." })).mockResolvedValueOnce(resposta(200, sessao));
    vi.stubGlobal("fetch", fetchMock);

    const pedidos = [renovarSessao(), renovarSessao()];
    for (const pedido of pedidos) await expect(pedido).rejects.toMatchObject({ status: 401 });
    await expect(pedidos[0]).rejects.toBeInstanceOf(ContaErro);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(renovarSessao()).resolves.toMatchObject({ accessToken: "token-novo" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
