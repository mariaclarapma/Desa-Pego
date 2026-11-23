import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessao } from "@/lib/sessao";
import { PaginaConta } from "./PaginaConta";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
  useSessao.setState({ sessao: null });
});

describe("PaginaConta", () => {
  it("alterna entre entrar e criar conta sem recarregar, mantendo o e-mail", async () => {
    const user = userEvent.setup();
    const replaceState = vi.spyOn(window.history, "replaceState");
    render(<PaginaConta modoInicial="entrar" />);

    expect(screen.getByRole("heading", { level: 1, name: "entrar" })).toBeInTheDocument();
    expect(screen.queryByLabelText("nome completo")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("e-mail"), "ana@exemplo.com");

    await user.click(screen.getByRole("tab", { name: "criar minha conta", selected: false }));
    expect(screen.getByRole("heading", { level: 1, name: "criar conta" })).toBeInTheDocument();
    expect(screen.getByLabelText("nome completo")).toBeInTheDocument();
    expect(screen.getByLabelText("confirmar senha")).toBeInTheDocument();
    expect(screen.getByLabelText("e-mail")).toHaveValue("ana@exemplo.com");
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/cadastro");
  });

  it("abas respondem às setas do teclado", async () => {
    const user = userEvent.setup();
    render(<PaginaConta modoInicial="entrar" />);
    screen.getByRole("tab", { name: "já tenho conta" }).focus();

    await user.keyboard("{ArrowRight}");
    const criar = screen.getByRole("tab", { name: "criar minha conta" });
    expect(criar).toHaveAttribute("aria-selected", "true");
    expect(criar).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "criar minha conta" })).toBeInTheDocument();
  });

  it("mostra os erros ligados aos campos e foca o primeiro inválido", async () => {
    const user = userEvent.setup();
    render(<PaginaConta modoInicial="cadastro" />);

    await user.click(screen.getByRole("button", { name: "criar minha conta" }));

    const nome = screen.getByLabelText("nome completo");
    expect(nome).toHaveFocus();
    expect(nome).toHaveAttribute("aria-invalid", "true");
    expect(nome).toHaveAccessibleDescription("informe seu nome completo.");
    expect(screen.getByLabelText("e-mail")).toHaveAccessibleDescription("informe seu e-mail.");
  });

  it("mostra e oculta a senha", async () => {
    const user = userEvent.setup();
    render(<PaginaConta modoInicial="entrar" />);
    const senha = screen.getByLabelText("senha");
    expect(senha).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "mostrar senha" }));
    expect(senha).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "ocultar senha" })).toHaveAttribute("aria-pressed", "true");
  });

  it("entra de verdade: guarda a sessão e vai para a conta", async () => {
    const user = userEvent.setup();
    const sessao = { usuario: { id: "1", nome: "Ana Souza", email: "ana@exemplo.com" }, accessToken: "ey.x.y", expiraEm: "" };
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify(sessao), { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    render(<PaginaConta modoInicial="entrar" />);

    await user.type(screen.getByLabelText("e-mail"), "ana@exemplo.com");
    await user.type(screen.getByLabelText("senha"), "garimpo123");
    await user.click(screen.getByRole("button", { name: "entrar na minha conta" }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/conta"));
    expect(fetchFalso).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST", credentials: "same-origin" }));
    expect(useSessao.getState().sessao?.usuario.nome).toBe("Ana Souza");
  });

  it("se o serviço de contas não responder, avisa sem fingir que entrou", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 })));
    render(<PaginaConta modoInicial="entrar" />);

    await user.type(screen.getByLabelText("e-mail"), "ana@exemplo.com");
    await user.type(screen.getByLabelText("senha"), "garimpo123");
    await user.click(screen.getByRole("button", { name: "entrar na minha conta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/serviço de contas não respondeu/);
    expect(push).not.toHaveBeenCalled();
    expect(useSessao.getState().sessao).toBeNull();
  });

  it("mostra a mensagem do backend para e-mail já cadastrado", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: "já existe" }), { status: 409 })));
    render(<PaginaConta modoInicial="cadastro" />);

    await user.type(screen.getByLabelText("nome completo"), "Ana Souza");
    await user.type(screen.getByLabelText("e-mail"), "ana@exemplo.com");
    await user.type(screen.getByLabelText("CPF"), "52998224725");
    await user.type(screen.getByLabelText("senha"), "garimpo123");
    await user.type(screen.getByLabelText("confirmar senha"), "garimpo123");
    await user.click(screen.getByRole("button", { name: "criar minha conta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("já existe uma conta com esse e-mail. tente entrar.");
  });

  it("mensagem genérica para credenciais inválidas", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    render(<PaginaConta modoInicial="entrar" />);

    await user.type(screen.getByLabelText("e-mail"), "ana@exemplo.com");
    await user.type(screen.getByLabelText("senha"), "errada123");
    await user.click(screen.getByRole("button", { name: "entrar na minha conta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("e-mail ou senha incorretos.");
  });

  describe("CPF no cadastro (Req. 001)", () => {
    async function preencher(user: ReturnType<typeof userEvent.setup>, cpf: string) {
      await user.type(screen.getByLabelText("nome completo"), "Ana Souza");
      await user.type(screen.getByLabelText("e-mail"), "ana@exemplo.com");
      await user.type(screen.getByLabelText("CPF"), cpf);
      await user.type(screen.getByLabelText("senha"), "garimpo123");
      await user.type(screen.getByLabelText("confirmar senha"), "garimpo123");
    }

    it("aplica a máscara enquanto digita e só aparece no cadastro", async () => {
      const user = userEvent.setup();
      render(<PaginaConta modoInicial="cadastro" />);
      const cpf = screen.getByLabelText("CPF");
      expect(cpf).toHaveAttribute("inputmode", "numeric");
      await user.type(cpf, "529982247a25");
      expect(cpf).toHaveValue("529.982.247-25");

      await user.click(screen.getByRole("tab", { name: "já tenho conta" }));
      expect(screen.queryByLabelText("CPF")).not.toBeInTheDocument();
    });

    it("não envia CPF inválido e mostra o erro ligado ao campo", async () => {
      const user = userEvent.setup();
      const fetchFalso = vi.fn();
      vi.stubGlobal("fetch", fetchFalso);
      render(<PaginaConta modoInicial="cadastro" />);
      await preencher(user, "52998224724");
      await user.click(screen.getByRole("button", { name: "criar minha conta" }));

      const cpf = screen.getByLabelText("CPF");
      expect(cpf).toHaveFocus();
      expect(cpf).toHaveAttribute("aria-invalid", "true");
      expect(cpf).toHaveAccessibleDescription(expect.stringContaining("CPF inválido. confira os números."));
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it("envia só os dígitos do CPF", async () => {
      const user = userEvent.setup();
      const sessao = { usuario: { id: "1", nome: "Ana Souza", email: "ana@exemplo.com" }, accessToken: "ey.x.y", expiraEm: "" };
      const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify(sessao), { status: 201 }));
      vi.stubGlobal("fetch", fetchFalso);
      render(<PaginaConta modoInicial="cadastro" />);
      await preencher(user, "529.982.247-25");
      await user.click(screen.getByRole("button", { name: "criar minha conta" }));

      await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/conta"));
      const corpo = JSON.parse(fetchFalso.mock.calls[0][1].body);
      expect(corpo).toEqual({ nome: "Ana Souza", email: "ana@exemplo.com", cpf: "52998224725", senha: "garimpo123" });
    });

    it("CPF já cadastrado: mostra a mensagem do backend no alerta e no campo", async () => {
      const user = userEvent.setup();
      const msg = "este CPF já está vinculado a uma conta. se a conta é sua, entre com seu e-mail.";
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: msg, campos: { cpf: msg } }), { status: 409 })));
      render(<PaginaConta modoInicial="cadastro" />);
      await preencher(user, "52998224725");
      await user.click(screen.getByRole("button", { name: "criar minha conta" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(msg);
      expect(screen.getByLabelText("CPF")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("CPF")).toHaveAccessibleDescription(expect.stringContaining(msg));
      expect(push).not.toHaveBeenCalled();
    });
  });
});
