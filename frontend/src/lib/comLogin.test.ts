import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErro } from "@/lib/api/cliente";
import type { Sessao } from "@/lib/api/contas";
import { comLogin, SemLogin } from "@/lib/comLogin";
import { enviosSacola, rotuloFrete } from "@/lib/sacola";
import { useSessao } from "@/lib/sessao";

const renovarSessao = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/contas", () => ({ renovarSessao }));

const sessao = (token: string): Sessao => ({ usuario: { id: "u1", nome: "Ana", email: "ana@exemplo.com" }, accessToken: token, expiraEm: "" });

describe("comLogin: a sacola e a compra exigem conta", () => {
  beforeEach(() => useSessao.getState().definir(null));
  afterEach(() => renovarSessao.mockReset());

  it("usa o token da sessão em memória", async () => {
    useSessao.getState().definir(sessao("tok-1"));
    const operacao = vi.fn().mockResolvedValue("ok");
    expect(await comLogin(operacao)).toBe("ok");
    expect(operacao).toHaveBeenCalledWith("tok-1");
    expect(renovarSessao).not.toHaveBeenCalled();
  });

  it("sem sessão na memória, recupera pelo cookie; sem cookie, pede para entrar (SemLogin)", async () => {
    renovarSessao.mockResolvedValueOnce(sessao("tok-cookie"));
    const operacao = vi.fn().mockResolvedValue("ok");
    await comLogin(operacao);
    expect(operacao).toHaveBeenCalledWith("tok-cookie");
    expect(useSessao.getState().sessao?.accessToken).toBe("tok-cookie");

    useSessao.getState().definir(null);
    renovarSessao.mockRejectedValueOnce(new Error("sem cookie"));
    await expect(comLogin(operacao)).rejects.toBeInstanceOf(SemLogin);
  });

  it("token vencido (401): renova uma vez e repete; outros erros passam direto", async () => {
    useSessao.getState().definir(sessao("velho"));
    renovarSessao.mockResolvedValueOnce(sessao("novo"));
    const operacao = vi.fn().mockRejectedValueOnce(new ApiErro(401, "/pecas")).mockResolvedValueOnce("ok");
    expect(await comLogin(operacao)).toBe("ok");
    expect(operacao.mock.calls.map((c) => c[0])).toEqual(["velho", "novo"]);

    const falha = vi.fn().mockRejectedValue(new ApiErro(409, "/pecas"));
    await expect(comLogin(falha)).rejects.toMatchObject({ status: 409 });
    expect(renovarSessao).toHaveBeenCalledTimes(1);
  });
});

describe("frete por vendedora", () => {
  it("conta um envio por vendedora (peça sem vendedora conta sozinha)", () => {
    expect(enviosSacola([])).toBe(0);
    expect(enviosSacola([{ id: "a", vendedoraId: "v1" }, { id: "b", vendedoraId: "v1" }])).toBe(1);
    expect(enviosSacola([{ id: "a", vendedoraId: "v1" }, { id: "b", vendedoraId: "v2" }, { id: "c" }])).toBe(3);
    expect(rotuloFrete(1)).toBe("frete fixo");
    expect(rotuloFrete(2)).toBe("frete fixo (2 vendedoras)");
  });
});
