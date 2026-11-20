import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessao } from "@/lib/sessao";
import ContaPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const ANA = { id: "1", nome: "Ana Souza", email: "ana@exemplo.com" };
const sessao = { usuario: ANA, accessToken: "token-ana", expiraEm: "" };

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

/** Chamadas feitas ao fetch falso, com método, caminho, cabeçalhos e corpo. */
const chamadas = (fetchFalso: ReturnType<typeof vi.fn>) =>
  (fetchFalso.mock.calls as [string, RequestInit][]).map(([url, init]) => ({
    url,
    metodo: init.method,
    auth: (init.headers as Record<string, string> | undefined)?.Authorization,
    corpo: init.body ? JSON.parse(String(init.body)) : undefined,
  }));

beforeEach(() => {
  useSessao.setState({ sessao });
});

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockClear();
  useSessao.setState({ sessao: null });
});

describe("READ", () => {
  it("mostra nome e e-mail da conta logada", () => {
    render(<ContaPage />);
    const dados = screen.getByRole("region", { name: "seus dados" });
    expect(within(dados).getByText("Ana Souza")).toBeInTheDocument();
    expect(within(dados).getByText("ana@exemplo.com")).toBeInTheDocument();
  });
});

describe("UPDATE: editar dados", () => {
  it("salva o nome novo com o token da sessão e atualiza a tela", async () => {
    const user = userEvent.setup();
    const fetchFalso = vi.fn().mockResolvedValue(json({ usuario: { ...ANA, nome: "Ana Paula Souza" }, accessToken: "token-novo", expiraEm: "" }));
    vi.stubGlobal("fetch", fetchFalso);
    render(<ContaPage />);

    await user.click(screen.getByRole("button", { name: "editar dados" }));
    const nome = screen.getByLabelText("nome completo");
    await vi.waitFor(() => expect(nome).toHaveFocus());
    await user.clear(nome);
    await user.type(nome, "Ana Paula Souza");
    // e-mail igual: não pede senha
    expect(screen.queryByLabelText("senha atual")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "salvar alterações" }));

    expect(await screen.findByRole("status")).toHaveTextContent("seus dados foram atualizados.");
    expect(screen.getByText("Ana Paula Souza")).toBeInTheDocument();
    expect(chamadas(fetchFalso)[0]).toEqual({
      url: "/api/auth/me",
      metodo: "PATCH",
      auth: "Bearer token-ana",
      corpo: { nome: "Ana Paula Souza", email: "ana@exemplo.com" },
    });
    expect(useSessao.getState().sessao?.accessToken).toBe("token-novo");
  });

  it("valida no navegador antes de enviar", async () => {
    const user = userEvent.setup();
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    render(<ContaPage />);

    await user.click(screen.getByRole("button", { name: "editar dados" }));
    await user.clear(screen.getByLabelText("nome completo"));
    await user.type(screen.getByLabelText("nome completo"), "Ana");
    await user.click(screen.getByRole("button", { name: "salvar alterações" }));

    expect(screen.getByLabelText("nome completo")).toHaveAccessibleDescription("informe nome e sobrenome.");
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("trocar o e-mail pede a senha atual e mostra o erro do backend", async () => {
    const user = userEvent.setup();
    const fetchFalso = vi
      .fn()
      .mockResolvedValue(json({ erro: "senha atual incorreta.", campos: { senhaAtual: "senha atual incorreta." } }, 403));
    vi.stubGlobal("fetch", fetchFalso);
    render(<ContaPage />);

    await user.click(screen.getByRole("button", { name: "editar dados" }));
    const email = screen.getByLabelText("e-mail");
    await user.clear(email);
    await user.type(email, "nova@exemplo.com");
    await user.click(screen.getByRole("button", { name: "salvar alterações" }));
    // sem a senha, nem chega a enviar
    expect(screen.getByLabelText("senha atual")).toHaveFocus();
    expect(fetchFalso).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("senha atual"), "errada123");
    await user.click(screen.getByRole("button", { name: "salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("senha atual incorreta.");
    expect(chamadas(fetchFalso)[0].corpo).toEqual({ nome: "Ana Souza", email: "nova@exemplo.com", senhaAtual: "errada123" });
    expect(useSessao.getState().sessao?.usuario.email).toBe("ana@exemplo.com");
  });

  it("avisa quando o e-mail já é de outra conta", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ erro: "já existe" }, 409)));
    render(<ContaPage />);

    await user.click(screen.getByRole("button", { name: "editar dados" }));
    await user.clear(screen.getByLabelText("e-mail"));
    await user.type(screen.getByLabelText("e-mail"), "bea@exemplo.com");
    await user.type(screen.getByLabelText("senha atual"), "garimpo123");
    await user.click(screen.getByRole("button", { name: "salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("esse e-mail já é de outra conta.");
  });

  it("cancelar fecha o formulário sem salvar", async () => {
    const user = userEvent.setup();
    render(<ContaPage />);
    await user.click(screen.getByRole("button", { name: "editar dados" }));
    await user.click(screen.getByRole("button", { name: "cancelar" }));
    expect(screen.queryByRole("form", { name: "editar dados" })).not.toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "editar dados" })).toHaveFocus());
  });
});

describe("UPDATE: alterar senha", () => {
  it("troca a senha com a atual e guarda a sessão nova", async () => {
    const user = userEvent.setup();
    const fetchFalso = vi.fn().mockResolvedValue(json({ ...sessao, accessToken: "token-pos-troca" }));
    vi.stubGlobal("fetch", fetchFalso);
    render(<ContaPage />);

    await user.click(screen.getByRole("button", { name: "alterar senha" }));
    await user.type(screen.getByLabelText("senha atual"), "garimpo123");
    await user.type(screen.getByLabelText("nova senha"), "novaSenha456");
    await user.type(screen.getByLabelText("confirmar nova senha"), "novaSenha456");
    await user.click(screen.getByRole("button", { name: "trocar senha" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/senha alterada/);
    expect(chamadas(fetchFalso)[0]).toEqual({
      url: "/api/auth/me/senha",
      metodo: "PUT",
      auth: "Bearer token-ana",
      corpo: { senhaAtual: "garimpo123", novaSenha: "novaSenha456" },
    });
    expect(useSessao.getState().sessao?.accessToken).toBe("token-pos-troca");
  });

  it("não envia se a confirmação não bate", async () => {
    const user = userEvent.setup();
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    render(<ContaPage />);

    await user.click(screen.getByRole("button", { name: "alterar senha" }));
    await user.type(screen.getByLabelText("senha atual"), "garimpo123");
    await user.type(screen.getByLabelText("nova senha"), "novaSenha456");
    await user.type(screen.getByLabelText("confirmar nova senha"), "outraSenha789");
    await user.click(screen.getByRole("button", { name: "trocar senha" }));

    expect(screen.getByLabelText("confirmar nova senha")).toHaveAccessibleDescription("as senhas não são iguais.");
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

describe("DELETE: excluir conta", () => {
  async function abrirExclusao(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "excluir minha conta" }));
    expect(screen.getByRole("heading", { name: "tem certeza?" })).toHaveFocus();
  }

  it("pede confirmação e senha, exclui e encerra a sessão", async () => {
    const user = userEvent.setup();
    const fetchFalso = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchFalso);
    render(<ContaPage />);

    await abrirExclusao(user);
    const excluir = screen.getByRole("button", { name: "excluir de vez" });
    // sem marcar a confirmação, o botão fica desabilitado
    expect(excluir).toBeDisabled();
    await user.type(screen.getByLabelText("sua senha"), "garimpo123");
    await user.click(screen.getByRole("checkbox", { name: /exclusão é definitiva/ }));
    await user.click(excluir);

    expect(await screen.findByText("sua conta foi excluída e você saiu de todos os aparelhos.")).toBeInTheDocument();
    expect(chamadas(fetchFalso)[0]).toEqual({ url: "/api/auth/me", metodo: "DELETE", auth: "Bearer token-ana", corpo: { senha: "garimpo123" } });
    expect(useSessao.getState().sessao).toBeNull();
    // não tenta recuperar a sessão depois de excluir
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("com a senha errada, mantém a conta e mostra o erro", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ erro: "senha atual incorreta.", campos: { senha: "senha atual incorreta." } }, 403)));
    render(<ContaPage />);

    await abrirExclusao(user);
    await user.type(screen.getByLabelText("sua senha"), "errada123");
    await user.click(screen.getByRole("checkbox", { name: /exclusão é definitiva/ }));
    await user.click(screen.getByRole("button", { name: "excluir de vez" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("senha atual incorreta.");
    expect(useSessao.getState().sessao).not.toBeNull();
  });

  it("Esc cancela e devolve o foco ao botão", async () => {
    const user = userEvent.setup();
    render(<ContaPage />);
    await abrirExclusao(user);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("heading", { name: "tem certeza?" })).not.toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "excluir minha conta" })).toHaveFocus());
  });
});

describe("sessão", () => {
  it("se o token de acesso venceu, renova pelo cookie e repete a operação", async () => {
    const user = userEvent.setup();
    const renovada = { ...sessao, accessToken: "token-renovado" };
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(json({ erro: "não autenticado." }, 401)) // PATCH com token vencido
      .mockResolvedValueOnce(json(renovada)) // POST /auth/refresh
      .mockResolvedValueOnce(json({ ...renovada, usuario: { ...ANA, nome: "Ana Paula Souza" } })); // PATCH de novo
    vi.stubGlobal("fetch", fetchFalso);
    render(<ContaPage />);

    await user.click(screen.getByRole("button", { name: "editar dados" }));
    await user.clear(screen.getByLabelText("nome completo"));
    await user.type(screen.getByLabelText("nome completo"), "Ana Paula Souza");
    await user.click(screen.getByRole("button", { name: "salvar alterações" }));

    expect(await screen.findByRole("status")).toHaveTextContent("seus dados foram atualizados.");
    expect(chamadas(fetchFalso).map((c) => [c.metodo, c.url, c.auth])).toEqual([
      ["PATCH", "/api/auth/me", "Bearer token-ana"],
      ["POST", "/api/auth/refresh", undefined],
      ["PATCH", "/api/auth/me", "Bearer token-renovado"],
    ]);
  });

  it("se nem o cookie vale mais, mostra que a sessão expirou", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ erro: "x" }, 401)));
    render(<ContaPage />);

    await user.click(screen.getByRole("button", { name: "alterar senha" }));
    await user.type(screen.getByLabelText("senha atual"), "garimpo123");
    await user.type(screen.getByLabelText("nova senha"), "novaSenha456");
    await user.type(screen.getByLabelText("confirmar nova senha"), "novaSenha456");
    await user.click(screen.getByRole("button", { name: "trocar senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("sua sessão expirou");
  });
});
