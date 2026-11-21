import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PerfilVendedora } from "@/lib/api/contas";
import { useSessao } from "@/lib/sessao";
import { PaginaVendedora } from "./PaginaVendedora";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const ANA = { id: "1", nome: "Ana Souza", email: "ana@exemplo.com" };
const sessao = { usuario: ANA, accessToken: "token-ana", expiraEm: "" };
const SEM_CHAVE: PerfilVendedora = { id: "1", nomePublico: null, nomeNaVitrine: "Ana", cidade: null, pix: null, pixIndisponivel: false };
const ILEGIVEL: PerfilVendedora = { ...SEM_CHAVE, cidade: "Recife", pixIndisponivel: true };
const COM_CHAVE: PerfilVendedora = {
  ...SEM_CHAVE,
  cidade: "Recife",
  pix: { tipo: "cpf", mascarada: "***.982.247-**", atualizadaEm: "2026-11-20T12:00:00.000Z" },
};

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

const chamadas = (fetchFalso: ReturnType<typeof vi.fn>) =>
  (fetchFalso.mock.calls as [string, RequestInit][]).map(([url, init]) => ({
    url,
    metodo: init.method,
    auth: (init.headers as Record<string, string> | undefined)?.Authorization,
    corpo: init.body ? JSON.parse(String(init.body)) : undefined,
  }));

/** fetch falso que responde em ordem. */
function respostas(...lista: Response[]) {
  const fetchFalso = vi.fn();
  for (const r of lista) fetchFalso.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

beforeEach(() => {
  useSessao.setState({ sessao });
});

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockClear();
  useSessao.setState({ sessao: null });
});

describe("READ: perfil de vendedora", () => {
  it("sem chave: mostra o primeiro nome, avisa que não dá para anunciar e oferece cadastrar", async () => {
    const fetchFalso = respostas(json({ vendedora: SEM_CHAVE }));
    render(<PaginaVendedora />);

    const vitrine = await screen.findByRole("region", { name: "na vitrine" });
    expect(within(vitrine).getByText("Ana")).toBeInTheDocument();
    expect(within(vitrine).getByText("não informada")).toBeInTheDocument();
    const pix = screen.getByRole("region", { name: "chave Pix" });
    expect(within(pix).getByText(/não dá para publicar anúncios/)).toBeInTheDocument();
    expect(within(pix).getByRole("button", { name: "cadastrar chave Pix" })).toBeInTheDocument();
    expect(chamadas(fetchFalso)[0]).toEqual({ url: "/api/auth/me/vendedora", metodo: "GET", auth: "Bearer token-ana", corpo: undefined });
  });

  it("com chave: mostra só a máscara", async () => {
    respostas(json({ vendedora: COM_CHAVE }));
    render(<PaginaVendedora />);
    const pix = await screen.findByRole("region", { name: "chave Pix" });
    expect(within(pix).getByText("***.982.247-**")).toBeInTheDocument();
    expect(within(pix).getByText("CPF")).toBeInTheDocument();
    expect(within(pix).getByRole("button", { name: "trocar chave Pix" })).toBeInTheDocument();
  });

  it("chave ilegível: avisa que precisa cadastrar de novo, sem tela de erro, e abre o formulário", async () => {
    const user = userEvent.setup();
    const fetchFalso = respostas(json({ vendedora: ILEGIVEL }), json({ vendedora: COM_CHAVE, accessToken: "token-com-pix", expiraEm: "x" }));
    render(<PaginaVendedora />);

    const pix = await screen.findByRole("region", { name: "chave Pix" });
    expect(within(pix).getByRole("alert")).toHaveTextContent("sua chave Pix está indisponível e precisa ser cadastrada de novo");
    expect(within(pix).queryByText(/você ainda não cadastrou/)).not.toBeInTheDocument();
    // o resto do perfil continua na tela
    expect(screen.getByText("Recife")).toBeInTheDocument();

    await user.click(within(pix).getByRole("button", { name: "cadastrar de novo" }));
    await user.click(screen.getByRole("radio", { name: "CPF" }));
    await user.type(screen.getByLabelText("chave Pix (CPF)"), "529.982.247-25");
    await user.type(screen.getByLabelText("senha atual"), "garimpo123");
    await user.click(screen.getByRole("button", { name: "cadastrar chave Pix" }));

    expect(await screen.findByRole("status")).toHaveTextContent("chave Pix cadastrada");
    expect(screen.getByText("***.982.247-**")).toBeInTheDocument();
    expect(screen.queryByText(/está indisponível/)).not.toBeInTheDocument();
    expect(chamadas(fetchFalso)[1]).toMatchObject({ url: "/api/auth/me/pix", metodo: "PUT" });
    expect(useSessao.getState().sessao?.accessToken).toBe("token-com-pix");
  });

  it("backend fora do ar: mostra o erro e deixa tentar de novo", async () => {
    const user = userEvent.setup();
    respostas(json({ erro: "x" }, 503), json({ vendedora: SEM_CHAVE }));
    render(<PaginaVendedora />);
    expect(await screen.findByRole("alert")).toHaveTextContent("fora do ar");
    await user.click(screen.getByRole("button", { name: "tentar de novo" }));
    expect(await screen.findByRole("region", { name: "na vitrine" })).toBeInTheDocument();
  });

  it("falha de rede: mensagem amigável", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<PaginaVendedora />);
    expect(await screen.findByRole("alert")).toHaveTextContent("verifique sua conexão");
  });
});

describe("UPDATE: nome público e cidade", () => {
  it("salva e mostra o retorno de sucesso", async () => {
    const user = userEvent.setup();
    const fetchFalso = respostas(
      json({ vendedora: SEM_CHAVE }),
      json({ vendedora: { ...SEM_CHAVE, nomePublico: "Brechó da Ana", nomeNaVitrine: "Brechó da Ana", cidade: "Recife" } }),
    );
    render(<PaginaVendedora />);

    await user.click(await screen.findByRole("button", { name: "editar perfil" }));
    await user.type(screen.getByLabelText("nome público (opcional)"), "Brechó da Ana");
    await user.type(screen.getByLabelText("cidade"), "Recife");
    await user.click(screen.getByRole("button", { name: "salvar perfil" }));

    expect(await screen.findByRole("status")).toHaveTextContent("seu perfil de vendedora foi atualizado.");
    expect(screen.getByText("Brechó da Ana")).toBeInTheDocument();
    expect(chamadas(fetchFalso)[1]).toEqual({
      url: "/api/auth/me/vendedora",
      metodo: "PATCH",
      auth: "Bearer token-ana",
      corpo: { nomePublico: "Brechó da Ana", cidade: "Recife" },
    });
  });

  it("valida antes de enviar (cidade obrigatória)", async () => {
    const user = userEvent.setup();
    const fetchFalso = respostas(json({ vendedora: SEM_CHAVE }));
    render(<PaginaVendedora />);
    await user.click(await screen.findByRole("button", { name: "editar perfil" }));
    // ao abrir, o foco vai para o primeiro campo
    await vi.waitFor(() => expect(screen.getByLabelText("nome público (opcional)")).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "salvar perfil" }));
    expect(screen.getByLabelText("cidade")).toHaveAccessibleDescription(/informe sua cidade/);
    expect(screen.getByLabelText("cidade")).toHaveFocus();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});

describe("UPDATE: chave Pix", () => {
  it("cadastra com a senha, guarda o token novo e mostra a máscara", async () => {
    const user = userEvent.setup();
    const fetchFalso = respostas(json({ vendedora: SEM_CHAVE }), json({ vendedora: COM_CHAVE, accessToken: "token-com-pix", expiraEm: "x" }));
    render(<PaginaVendedora />);

    await user.click(await screen.findByRole("button", { name: "cadastrar chave Pix" }));
    await user.click(screen.getByRole("radio", { name: "CPF" }));
    await user.type(screen.getByLabelText("chave Pix (CPF)"), "529.982.247-25");
    await user.type(screen.getByLabelText("senha atual"), "garimpo123");
    await user.click(screen.getByRole("button", { name: "cadastrar chave Pix" }));

    expect(await screen.findByRole("status")).toHaveTextContent("chave Pix cadastrada. você já pode anunciar suas peças.");
    expect(screen.getByText("***.982.247-**")).toBeInTheDocument();
    expect(screen.queryByText("529.982.247-25")).not.toBeInTheDocument();
    expect(chamadas(fetchFalso)[1]).toEqual({
      url: "/api/auth/me/pix",
      metodo: "PUT",
      auth: "Bearer token-ana",
      corpo: { tipo: "cpf", chave: "529.982.247-25", senhaAtual: "garimpo123" },
    });
    expect(useSessao.getState().sessao).toMatchObject({ accessToken: "token-com-pix", usuario: ANA });
  });

  it("valida no navegador: tipo, chave do tipo certo e senha", async () => {
    const user = userEvent.setup();
    const fetchFalso = respostas(json({ vendedora: SEM_CHAVE }));
    render(<PaginaVendedora />);
    await user.click(await screen.findByRole("button", { name: "cadastrar chave Pix" }));
    await vi.waitFor(() => expect(screen.getByRole("radio", { name: "CPF" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "cadastrar chave Pix" }));
    expect(screen.getByText("escolha o tipo da chave.")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "celular" }));
    await user.type(screen.getByLabelText("chave Pix (celular)"), "(61) 3123-4567");
    await user.click(screen.getByRole("button", { name: "cadastrar chave Pix" }));
    expect(screen.getByLabelText("chave Pix (celular)")).toHaveAccessibleDescription(/celular/);
    expect(screen.getByLabelText("senha atual")).toHaveAccessibleDescription(/informe sua senha atual/);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("senha errada: mostra o erro do backend e limpa a senha", async () => {
    const user = userEvent.setup();
    respostas(
      json({ vendedora: COM_CHAVE }),
      json({ erro: "senha atual incorreta.", campos: { senhaAtual: "senha atual incorreta." } }, 403),
    );
    render(<PaginaVendedora />);
    await user.click(await screen.findByRole("button", { name: "trocar chave Pix" }));
    await user.click(screen.getByRole("radio", { name: "e-mail" }));
    await user.type(screen.getByLabelText("chave Pix (e-mail)"), "ana@exemplo.com");
    await user.type(screen.getByLabelText("senha atual"), "errada123");
    await user.click(screen.getByRole("button", { name: "trocar chave Pix" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("senha atual incorreta.");
    expect(screen.getByLabelText("senha atual")).toHaveValue("");
  });

  it("chave recusada pelo backend: erro ao lado do campo", async () => {
    const user = userEvent.setup();
    respostas(
      json({ vendedora: SEM_CHAVE }),
      json({ erro: "confira os dados do formulário.", campos: { chave: "CPF inválido. confira os 11 números." } }, 400),
    );
    render(<PaginaVendedora />);
    await user.click(await screen.findByRole("button", { name: "cadastrar chave Pix" }));
    await user.click(screen.getByRole("radio", { name: "CPF" }));
    await user.type(screen.getByLabelText("chave Pix (CPF)"), "529.982.247-25");
    await user.type(screen.getByLabelText("senha atual"), "garimpo123");
    await user.click(screen.getByRole("button", { name: "cadastrar chave Pix" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText("chave Pix (CPF)")).toHaveAccessibleDescription(/CPF inválido/);
  });
});

it("sem sessão e sem cookie válido: vai para o login", async () => {
  useSessao.setState({ sessao: null });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 401)));
  render(<PaginaVendedora />);
  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/entrar"));
});
