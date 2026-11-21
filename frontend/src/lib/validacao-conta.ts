/**
 * Validação dos formulários de login e cadastro (Req. 001). Roda no navegador para dar
 * retorno rápido; o backend valida de novo, porque o frontend nunca é a barreira de segurança.
 */
export type ModoConta = "entrar" | "cadastro";

export interface DadosConta {
  nome: string;
  email: string;
  /** Só no cadastro. Guardado com a máscara (000.000.000-00); vai para a API só com os dígitos. */
  cpf: string;
  senha: string;
  confirmarSenha: string;
}

export type ErrosConta = Partial<Record<keyof DadosConta, string>>;

export const SENHA_MINIMO = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* --------------------------------------------------------------------------------------------
 * CPF: mesmas regras de backend/comum/cpf.ts (11 dígitos e dígitos verificadores).
 * ------------------------------------------------------------------------------------------ */

export const soDigitosCpf = (valor: string) => valor.replace(/\D/g, "").slice(0, 11);

/** Máscara visual enquanto digita: 529.982.247-25 (aceita colar com ou sem pontuação). */
export function mascararCpf(valor: string) {
  const d = soDigitosCpf(valor);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

function digitoVerificador(base: string) {
  const soma = [...base].reduce((total, n, i) => total + Number(n) * (base.length + 1 - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export function erroCpf(valor: string): string | undefined {
  if (!valor.trim()) return "informe seu CPF.";
  if (/[^\d.\-\s]/.test(valor)) return "CPF inválido. confira os números.";
  const d = valor.replace(/\D/g, "");
  if (d.length !== 11) return "o CPF precisa ter 11 dígitos.";
  if (/^(\d)\1{10}$/.test(d)) return "CPF inválido. confira os números.";
  if (digitoVerificador(d.slice(0, 9)) !== Number(d[9]) || digitoVerificador(d.slice(0, 10)) !== Number(d[10])) {
    return "CPF inválido. confira os números.";
  }
}

export function validarCampo(campo: keyof DadosConta, dados: DadosConta, modo: ModoConta): string | undefined {
  const valor = dados[campo];
  switch (campo) {
    case "nome": {
      if (modo !== "cadastro") return;
      const partes = valor.trim().split(/\s+/).filter(Boolean);
      if (partes.length === 0) return "informe seu nome completo.";
      if (partes.length < 2) return "informe nome e sobrenome.";
      if (!/^[\p{L}' .-]+$/u.test(valor.trim())) return "use só letras no nome.";
      return;
    }
    case "email":
      if (!valor.trim()) return "informe seu e-mail.";
      if (!EMAIL.test(valor.trim())) return "confira o e-mail: ele precisa ter o formato nome@exemplo.com.";
      return;
    case "cpf":
      if (modo !== "cadastro") return;
      return erroCpf(valor);
    case "senha":
      if (!valor) return "informe sua senha.";
      if (modo === "cadastro") {
        if (valor.length < SENHA_MINIMO) return `a senha precisa ter pelo menos ${SENHA_MINIMO} caracteres.`;
        if (!/\p{L}/u.test(valor) || !/\d/.test(valor)) return "a senha precisa ter pelo menos uma letra e um número.";
      }
      return;
    case "confirmarSenha":
      if (modo !== "cadastro") return;
      if (!valor) return "repita a senha.";
      if (valor !== dados.senha) return "as senhas não são iguais.";
      return;
  }
}

/** Campos de cada modo, na ordem em que aparecem na tela. */
export const CAMPOS: Record<ModoConta, (keyof DadosConta)[]> = {
  entrar: ["email", "senha"],
  cadastro: ["nome", "email", "cpf", "senha", "confirmarSenha"],
};

export function validarConta(dados: DadosConta, modo: ModoConta): ErrosConta {
  const erros: ErrosConta = {};
  for (const campo of CAMPOS[modo]) {
    const erro = validarCampo(campo, dados, modo);
    if (erro) erros[campo] = erro;
  }
  return erros;
}
