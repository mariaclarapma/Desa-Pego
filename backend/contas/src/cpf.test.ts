import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarApp } from "./app.js";
import { usarBancoDeTeste } from "./banco-teste.js";
import type { Banco } from "./banco.js";
import type { Config } from "./config.js";
import { chavesCpfTemporarias, decifrarCpf, hashCpf } from "./cpf-cripto.js";

/** Req. 001: CPF no cadastro, validado, único (por hash) e guardado só cifrado. */
const config: Config = {
  porta: 0,
  jwtSegredo: new TextEncoder().encode("segredo-de-teste-com-mais-de-32-caracteres"),
  acessoMinutos: 15,
  refreshDias: 30,
  cookieNome: "desapego_refresh",
  cookiePath: "/auth",
  cookieSeguro: false,
  trustProxy: "loopback",
  origens: ["http://localhost:3000"],
  cadastrosPorHora: 100,
  cpf: chavesCpfTemporarias(),
};

const CPF = "529.982.247-25";
const CPF_DIGITOS = "52998224725";
const ANA = { nome: "Ana Souza", email: "ana@exemplo.com", cpf: CPF, senha: "garimpo123" };
const BEA = { nome: "Bea Lima", email: "bea@exemplo.com", cpf: "111.444.777-35", senha: "brecho2026" };

/** O CPF em qualquer formato que poderia vazar: só dígitos, com pontuação ou em partes. */
const FORMAS_DO_CPF = [CPF_DIGITOS, CPF, "529982247", "247-25"];
const semCpf = (texto: string) => FORMAS_DO_CPF.forEach((f) => expect(texto).not.toContain(f));

const lerBanco = usarBancoDeTeste();
let app: ReturnType<typeof criarApp>;
const montar = (banco: Banco = lerBanco()) => criarApp(banco, config);

beforeEach(() => {
  app = montar();
});

describe("cadastro com CPF", () => {
  it("CPF válido: cria a conta e guarda só o hash e a cifra", async () => {
    const res = await request(app).post("/auth/cadastro").send(ANA).expect(201);
    expect(res.body.usuario).toEqual({ id: expect.any(String), nome: "Ana Souza", email: "ana@exemplo.com", perfil: "USUARIO" });

    const salvo = (await lerBanco().usuarioPorEmail("ana@exemplo.com"))!;
    expect(salvo.cpf_hash).toBe(hashCpf(CPF_DIGITOS, config.cpf));
    expect(salvo.cpf_cifrado).toMatch(/^v1\./);
    // a cifra abre com a chave e o id da própria conta
    expect(decifrarCpf(salvo.cpf_cifrado!, salvo.id, config.cpf)).toBe(CPF_DIGITOS);
  });

  it("aceita o CPF só com dígitos", async () => {
    await request(app).post("/auth/cadastro").send({ ...ANA, cpf: CPF_DIGITOS }).expect(201);
  });

  it("CPF inválido: 400 com erro no campo, sem criar a conta", async () => {
    for (const cpf of ["abc.def.ghi-jk", "000.000.000-00", "999.999.999-99"]) {
      const res = await request(app).post("/auth/cadastro").send({ ...ANA, cpf }).expect(400);
      expect(res.body.campos.cpf).toBe("CPF inválido. confira os números.");
    }
    expect(await lerBanco().usuarioPorEmail(ANA.email)).toBeUndefined();
  });

  it("CPF com quantidade errada de dígitos: 400", async () => {
    for (const cpf of ["529.982.247-2", "5299822472", "529982247255"]) {
      const res = await request(app).post("/auth/cadastro").send({ ...ANA, cpf }).expect(400);
      expect(res.body.campos.cpf).toBe("o CPF precisa ter 11 dígitos.");
    }
    expect(await lerBanco().usuarioPorEmail(ANA.email)).toBeUndefined();
  });

  it("CPF com dígitos verificadores errados: 400", async () => {
    for (const cpf of ["529.982.247-24", "529.982.247-15"]) {
      const res = await request(app).post("/auth/cadastro").send({ ...ANA, cpf }).expect(400);
      expect(res.body.campos.cpf).toBe("CPF inválido. confira os números.");
      semCpf(JSON.stringify(res.body));
    }
  });

  it("CPF ausente ou de outro tipo: 400", async () => {
    const { cpf: _, ...semCampo } = ANA;
    expect((await request(app).post("/auth/cadastro").send(semCampo).expect(400)).body.campos.cpf).toBe("informe seu CPF.");
    expect((await request(app).post("/auth/cadastro").send({ ...ANA, cpf: 52998224725 }).expect(400)).body.campos.cpf).toBe("informe seu CPF.");
  });

  it("CPF já cadastrado (em qualquer formato): 409 sem revelar a outra conta", async () => {
    await request(app).post("/auth/cadastro").send(ANA).expect(201);
    const res = await request(app)
      .post("/auth/cadastro")
      .send({ ...BEA, cpf: CPF_DIGITOS })
      .expect(409);
    expect(res.body).toEqual({
      erro: expect.stringContaining("CPF já está vinculado"),
      campos: { cpf: expect.stringContaining("CPF já está vinculado") },
    });
    const texto = JSON.stringify(res.body);
    semCpf(texto);
    expect(texto).not.toContain("ana@exemplo.com");
    expect(texto).not.toContain("Ana");
    expect(await lerBanco().usuarioPorEmail(BEA.email)).toBeUndefined();
  });

  it("e-mail repetido continua com a mensagem de e-mail (é conferido antes do CPF)", async () => {
    await request(app).post("/auth/cadastro").send(ANA).expect(201);
    const res = await request(app).post("/auth/cadastro").send({ ...ANA, cpf: BEA.cpf }).expect(409);
    expect(res.body.campos).toEqual({ email: "já existe uma conta com esse e-mail." });
  });

  it("duas tentativas simultâneas com o mesmo CPF: só uma conta é criada", async () => {
    const [a, b] = await Promise.all([
      request(app).post("/auth/cadastro").send(ANA),
      request(app).post("/auth/cadastro").send({ ...BEA, cpf: CPF }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const perdedora = a.status === 409 ? a : b;
    expect(perdedora.body.campos).toEqual({ cpf: expect.stringContaining("CPF já está vinculado") });

    const contas = await lerBanco().listarUsuarios();
    expect(contas).toHaveLength(1);
  });

  it("corrida que passa da conferência prévia: a restrição UNIQUE do banco barra e a rota responde 409", async () => {
    await request(app).post("/auth/cadastro").send(ANA).expect(201);
    // simula a outra requisição chegando entre a conferência e o INSERT: a conferência não vê o CPF
    const banco = lerBanco();
    const cpfEmUso = vi.fn().mockResolvedValueOnce(false).mockImplementation(banco.cpfEmUso);
    const criarUsuario = vi.fn(banco.criarUsuario);
    const appCorrida = montar({ ...banco, cpfEmUso, criarUsuario });

    const res = await request(appCorrida).post("/auth/cadastro").send({ ...BEA, cpf: CPF }).expect(409);
    expect(criarUsuario).toHaveBeenCalledTimes(1); // chegou ao INSERT e o banco recusou
    expect(res.body.campos).toEqual({ cpf: expect.stringContaining("CPF já está vinculado") });
    expect(await lerBanco().listarUsuarios()).toHaveLength(1);
  });

  it("o banco recusa dois registros com o mesmo hash de CPF (restrição UNIQUE)", async () => {
    const banco = lerBanco();
    const base = { senha_hash: "x", cpf_hash: "mesmo-hash", cpf_cifrado: "v1.a.b.c" };
    await banco.criarUsuario({ id: "u1", nome: "Um Teste", email: "um@exemplo.com", ...base });
    await expect(banco.criarUsuario({ id: "u2", nome: "Dois Teste", email: "dois@exemplo.com", ...base })).rejects.toThrow();
    // contas sem CPF (antigas e a administradora master) convivem: o UNIQUE aceita vários NULL
    await banco.criarUsuario({ id: "u3", nome: "Tres Teste", email: "tres@exemplo.com", senha_hash: "x" });
    await banco.criarUsuario({ id: "u4", nome: "Quatro Teste", email: "quatro@exemplo.com", senha_hash: "x" });
    expect(await banco.listarUsuarios()).toHaveLength(3);
  });

  it("excluir a conta libera o CPF para um novo cadastro", async () => {
    const cliente = request.agent(app);
    const { body } = await cliente.post("/auth/cadastro").send(ANA).expect(201);
    await cliente.delete("/auth/me").set("Authorization", `Bearer ${body.accessToken}`).send({ senha: ANA.senha }).expect(204);
    await request(app).post("/auth/cadastro").send({ ...BEA, cpf: CPF }).expect(201);
  });
});

describe("o CPF não aparece em texto puro", () => {
  const saidas: string[] = [];
  beforeEach(() => {
    saidas.length = 0;
    for (const metodo of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, metodo).mockImplementation((...args: unknown[]) => {
        saidas.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack} ${JSON.stringify(a)}` : JSON.stringify(a))).join(" "));
      });
    }
  });
  afterEach(() => vi.restoreAllMocks());

  it("nem no banco, nem nas respostas (cadastro, login, refresh, /me, admin), nem nos logs", async () => {
    const cliente = request.agent(app);
    const respostas: request.Response[] = [];
    respostas.push(await cliente.post("/auth/cadastro").send(ANA).expect(201));
    respostas.push(await request(app).post("/auth/cadastro").send({ ...BEA, cpf: CPF }).expect(409));
    respostas.push(await request(app).post("/auth/cadastro").send({ ...BEA, cpf: "529.982.247-24" }).expect(400));
    respostas.push(await cliente.post("/auth/login").send({ email: ANA.email, senha: ANA.senha }).expect(200));
    respostas.push(await cliente.post("/auth/refresh").expect(200));
    const token = respostas.at(-1)!.body.accessToken as string;
    respostas.push(await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`).expect(200));

    // um erro inesperado do banco no cadastro vira 500 genérico; o log não leva o CPF
    const banco = lerBanco();
    const quebrado = montar({ ...banco, criarUsuario: () => Promise.reject(new Error("falha de conexão")) });
    respostas.push(await request(quebrado).post("/auth/cadastro").send({ ...BEA, email: "outra@exemplo.com" }).expect(500));

    for (const r of respostas) {
      semCpf(JSON.stringify(r.body));
      semCpf(JSON.stringify(r.headers));
      expect(JSON.stringify(r.body)).not.toMatch(/cpf_hash|cpf_cifrado/);
    }
    // o JWT (decodificado) também não leva o CPF
    semCpf(Buffer.from(token.split(".")[1], "base64url").toString());

    // banco: nenhuma coluna da conta tem o CPF em texto puro
    const salvo = (await banco.usuarioPorEmail(ANA.email))!;
    semCpf(JSON.stringify(salvo));
    // listagem do painel do admin não devolve nem o hash
    expect(JSON.stringify(await banco.listarUsuarios())).not.toMatch(/cpf/);

    expect(saidas.some((s) => s.includes("falha de conexão"))).toBe(true); // o log funcionou
    saidas.forEach(semCpf);
  });
});

describe("login e logout continuam iguais para contas com CPF", () => {
  it("entra, renova, sai e não renova mais", async () => {
    const cliente = request.agent(app);
    await cliente.post("/auth/cadastro").send(ANA).expect(201);
    await cliente.post("/auth/logout").expect(204);

    await request(app).post("/auth/login").send({ email: ANA.email, senha: "errada123" }).expect(401);
    const login = await cliente.post("/auth/login").send({ email: ANA.email, senha: ANA.senha }).expect(200);
    expect(login.body.usuario.email).toBe(ANA.email);
    await cliente.post("/auth/refresh").expect(200);
    await cliente.post("/auth/logout").expect(204);
    await cliente.post("/auth/refresh").expect(401);
  });

  it("o login não pede nem aceita CPF no lugar do e-mail", async () => {
    await request(app).post("/auth/cadastro").send(ANA).expect(201);
    await request(app).post("/auth/login").send({ email: CPF, senha: ANA.senha }).expect(400);
  });
});
