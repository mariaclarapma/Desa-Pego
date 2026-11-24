import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormularioAnuncio } from "./FormularioAnuncio";

/*
 * Valores de TESTE (os reais vêm do painel do admin): comissão 10%, taxa do Pix 0,99%, frete R$ 19,90.
 * Faixa sugerida de bolsas em ótimo estado: R$ 50 a R$ 250.
 */
const REGRAS = {
  comissaoPontosBase: 1000,
  taxaPixPontosBase: 99,
  precosSugeridos: [{ categoria: "bolsas", condicao: "otimo_estado", minimoCentavos: 5000, maximoCentavos: 25000 }],
};
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function servidorFalso({ regrasFalham = false } = {}) {
  let n = 0;
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/gestao/config") return regrasFalham ? new Response("{}", { status: 503 }) : new Response(JSON.stringify(REGRAS));
    if (url === "/api/config") return new Response(JSON.stringify({ freteCentavos: 1990, reservaMinutos: 15 }));
    if (url === "/api/anuncios/fotos") {
      const { arquivos } = JSON.parse(String(init?.body));
      const fotos = arquivos.map(() => {
        n++;
        return { chave: `00000000-0000-0000-0000-00000000000${n}.png`, urlUpload: `/api/fotos/x${n}`, metodo: "PUT", campos: {}, expiraEm: "2026-11-23T12:00:00.000Z", url: `/api/fotos/x${n}` };
      });
      return new Response(JSON.stringify({ fotos }), { status: 201 });
    }
    if (url.startsWith("/api/fotos/")) return new Response(null, { status: 204 });
    return new Response("{}", { status: 404 });
  });
}

/** Chamada autenticada de mentira: entrega um token qualquer. */
const chamar = (<T,>(operacao: (token: string) => Promise<T>) => operacao("token-de-teste")) as Parameters<typeof FormularioAnuncio>[0]["chamar"];

function montar(aoSalvar = vi.fn(), opcoes?: { regrasFalham?: boolean }) {
  vi.stubGlobal("fetch", servidorFalso(opcoes));
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:previa" }));
  render(<FormularioAnuncio chamar={chamar} textoBotao="publicar anúncio" textoEnviando="publicando…" aoSalvar={aoSalvar} />);
  return aoSalvar;
}

afterEach(() => vi.unstubAllGlobals());

const simulador = () => screen.getByRole("region", { name: "quanto você recebe" });

describe("simulador de ganho (Req. 005)", () => {
  it("usa a regra da carteira: comissão na peça, frete para a vendedora, Pix sobre peça + frete", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText("comissão da plataforma (10,00%)");
    expect(within(simulador()).getByText("taxa do Pix (0,99% sobre peça + frete)")).toBeInTheDocument();

    // R$ 100: comissão 10,00; frete + 19,90; Pix 0,99% de 119,90 = 1,187 → 1,19; recebe 100 − 10 + 19,90 − 1,19 = 108,71
    await user.type(screen.getByLabelText("preço de venda"), "100");
    const s = within(simulador());
    expect(s.getByText(/^R\$\s100,00$/)).toBeInTheDocument();
    expect(s.getByText(/−\sR\$\s10,00/)).toBeInTheDocument();
    expect(s.getByText(/\+\sR\$\s19,90/)).toBeInTheDocument();
    expect(s.getByText(/−\sR\$\s1,19/)).toBeInTheDocument();
    expect(s.getByText(/R\$\s108,71/)).toBeInTheDocument();
  });

  it("recalcula a cada tecla", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText("comissão da plataforma (10,00%)");
    const preco = screen.getByLabelText("preço de venda");
    await user.type(preco, "1");
    // R$ 1: comissão 0,10; Pix 0,99% de 20,90 = 0,207 → 0,21; recebe 1 − 0,10 + 19,90 − 0,21 = 20,59
    expect(within(simulador()).getByText(/R\$\s20,59/)).toBeInTheDocument();
    await user.type(preco, "0");
    // R$ 10: comissão 1,00; Pix 0,99% de 29,90 = 0,296 → 0,30; recebe 10 − 1 + 19,90 − 0,30 = 28,60
    expect(within(simulador()).getByText(/R\$\s28,60/)).toBeInTheDocument();
  });

  it("preço zero ou negativo não gera valores", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText("comissão da plataforma (10,00%)");
    await user.type(screen.getByLabelText("preço de venda"), "-5");
    expect(within(simulador()).getAllByText("—")).toHaveLength(5);
  });

  it("se as regras do admin não carregam, avisa sem inventar valores", async () => {
    montar(vi.fn(), { regrasFalham: true });
    expect(await screen.findByText(/simulador ficou fora do ar/)).toBeInTheDocument();
    expect(screen.queryByText(/comissão da plataforma \(/)).not.toBeInTheDocument();
  });
});

describe("formulário de anúncio (Req. 004)", () => {
  it("mostra a faixa sugerida do admin, mas publica com o preço que a vendedora escolher", async () => {
    const user = userEvent.setup();
    const aoSalvar = montar(vi.fn().mockResolvedValue(undefined));
    await user.upload(screen.getByLabelText(/escolher fotos/), new File([PNG], "bolsa.png", { type: "image/png" }));
    await screen.findByText("capa");
    await user.type(screen.getByLabelText("título"), "Bolsa de palha");
    await user.type(screen.getByLabelText("descrição"), "Palha trançada à mão.");
    await user.selectOptions(screen.getByLabelText("categoria"), "bolsas");
    await user.type(screen.getByLabelText("tamanho"), "único");
    await user.click(screen.getByRole("radio", { name: /ótimo estado/ }));
    expect(await screen.findByText(/costumam sair entre R\$\s50,00 e R\$\s250,00/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("preço de venda"), "400");
    await user.click(screen.getByRole("button", { name: "publicar anúncio" }));
    expect(aoSalvar).toHaveBeenCalledWith(
      expect.objectContaining({ precoCentavos: 40000, categoria: "bolsas", condicao: "otimo_estado", fotos: ["00000000-0000-0000-0000-000000000001.png"] }),
    );
  });

  it("mostra os erros e foca o primeiro campo, sem enviar", async () => {
    const user = userEvent.setup();
    const aoSalvar = montar();
    await screen.findByText("comissão da plataforma (10,00%)");
    await user.type(screen.getByLabelText("preço de venda"), "0");
    await user.click(screen.getByRole("button", { name: "publicar anúncio" }));
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(screen.getByText("envie pelo menos 1 foto.")).toBeInTheDocument();
    expect(screen.getByLabelText("título")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("preço de venda")).toHaveAccessibleDescription(/maior que zero/);
  });

  it("recusa arquivo que não é imagem e mais de 5 fotos, antes de enviar", async () => {
    const user = userEvent.setup({ applyAccept: false });
    montar();
    await user.upload(screen.getByLabelText(/escolher fotos/), new File(["%PDF"], "nota.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("“nota.pdf” não é JPG, PNG ou WebP.")).toBeInTheDocument();
    const seis = Array.from({ length: 6 }, (_, i) => new File([PNG], `f${i}.png`, { type: "image/png" }));
    await act(() => user.upload(screen.getByLabelText(/escolher fotos/), seis));
    expect(await screen.findByText(/aceita até 5 fotos; 1 ficaram de fora/)).toBeInTheDocument();
    expect(await screen.findAllByRole("button", { name: /remover foto/ })).toHaveLength(5);
  });

  it("mostra o erro do backend (ex.: sem chave Pix) sem perder o que foi digitado", async () => {
    const user = userEvent.setup();
    montar(vi.fn().mockRejectedValue(new Error("cadastre sua chave Pix na sua conta para publicar anúncios.")));
    await user.upload(screen.getByLabelText(/escolher fotos/), new File([PNG], "bolsa.png", { type: "image/png" }));
    await screen.findByText("capa");
    await user.type(screen.getByLabelText("título"), "Bolsa de palha");
    await user.type(screen.getByLabelText("descrição"), "Palha trançada à mão.");
    await user.selectOptions(screen.getByLabelText("categoria"), "bolsas");
    await user.type(screen.getByLabelText("tamanho"), "único");
    await user.click(screen.getByRole("radio", { name: /ótimo estado/ }));
    await user.type(screen.getByLabelText("preço de venda"), "90");
    await user.click(screen.getByRole("button", { name: "publicar anúncio" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cadastre sua chave Pix");
    expect(screen.getByLabelText("título")).toHaveValue("Bolsa de palha");
  });
});
