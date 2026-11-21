import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFrete } from "./useFrete";

afterEach(() => vi.unstubAllGlobals());

describe("useFrete", () => {
  it("usa o frete definido pela administração", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ freteCentavos: 2500, reservaMinutos: 15 }))));
    const { result } = renderHook(() => useFrete());
    expect(result.current).toBe(1990); // enquanto carrega, o padrão
    await waitFor(() => expect(result.current).toBe(2500));
  });

  it("sem resposta do servidor, fica com o padrão", async () => {
    const fetchFalso = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchFalso);
    const { result } = renderHook(() => useFrete());
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(result.current).toBe(1990);
  });
});
