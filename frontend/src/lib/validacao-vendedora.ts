import type { TipoChavePix } from "@/lib/api/contas";

/**
 * Validação do perfil de vendedora e da chave Pix (Req. 002), para dar retorno rápido no
 * formulário. São as mesmas regras de backend/contas/src/validacao.ts e backend/comum/chave-pix.ts:
 * o backend valida de novo, porque o frontend nunca é a barreira.
 */
export interface DadosVendedora {
  nomePublico: string;
  cidade: string;
}

export interface DadosChavePix {
  tipo: TipoChavePix | "";
  chave: string;
  senhaAtual: string;
}

export type Erros<T> = Partial<Record<keyof T, string>>;

/** Como cada tipo aparece no formulário: rótulo, exemplo e teclado do celular. */
export const TIPOS_CHAVE: Record<TipoChavePix, { rotulo: string; exemplo: string; inputMode: "numeric" | "email" | "tel" | "text" }> = {
  cpf: { rotulo: "CPF", exemplo: "000.000.000-00", inputMode: "numeric" },
  email: { rotulo: "e-mail", exemplo: "voce@exemplo.com", inputMode: "email" },
  telefone: { rotulo: "celular", exemplo: "(61) 91234-5678", inputMode: "tel" },
  aleatoria: { rotulo: "chave aleatória", exemplo: "123e4567-e89b-42d3-a456-426614174000", inputMode: "text" },
};

const soDigitos = (v: string) => v.replace(/\D/g, "");
/** 11 números ou mais, juntos ou separados por qualquer coisa, podem esconder um CPF. */
const PODE_TER_CPF = (v: string) => soDigitos(v).length >= 11;
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const ALEATORIA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function cpfValido(cpf: string) {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (base: string) => {
    const soma = [...base].reduce((total, n, i) => total + Number(n) * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(d.slice(0, 9)) === Number(d[9]) && digito(d.slice(0, 10)) === Number(d[10]);
}

/** Erro da chave conforme o tipo, ou undefined se estiver ok. */
export function erroChavePix(tipo: TipoChavePix, valor: string): string | undefined {
  const bruto = valor.trim();
  if (!bruto) return "informe a chave Pix.";
  switch (tipo) {
    case "cpf":
      return /^[\d.\s-]+$/.test(bruto) && cpfValido(bruto) ? undefined : "CPF inválido. confira os 11 números.";
    case "email": {
      const email = bruto.toLowerCase();
      return email.length <= 77 && EMAIL.test(email) ? undefined : "e-mail inválido para chave Pix.";
    }
    case "telefone": {
      let d = soDigitos(bruto);
      if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
      return /^\+?[\d\s().-]+$/.test(bruto) && /^[1-9][1-9]9\d{8}$/.test(d) ? undefined : "telefone inválido. use DDD + número de celular.";
    }
    case "aleatoria":
      return ALEATORIA.test(bruto.toLowerCase()) ? undefined : "chave aleatória inválida. cole a chave completa, com os traços.";
  }
}

export function validarVendedora(dados: DadosVendedora): Erros<DadosVendedora> {
  const nome = dados.nomePublico.trim();
  const cidade = dados.cidade.trim();
  const erros: Erros<DadosVendedora> = {
    nomePublico:
      nome.length === 1
        ? "o nome público precisa ter pelo menos 2 caracteres."
        : nome.length > 40
          ? "o nome público pode ter até 40 caracteres."
          : !/^[\p{L}\d' .&_-]*$/u.test(nome)
            ? "use só letras, números, espaço e . - _ & no nome público."
            : PODE_TER_CPF(nome)
              ? "o nome público não pode ter CPF, documento ou sequência longa de números."
              : undefined,
    cidade:
      cidade.length < 2
        ? "informe sua cidade."
        : cidade.length > 60
          ? "nome de cidade muito longo."
          : !/^[\p{L}' .-]+(\s*[/-]\s*[A-Za-z]{2})?$/u.test(cidade)
            ? "use só letras na cidade (ex.: Brasília/DF)."
            : undefined,
  };
  return limpar(erros);
}

export function validarChavePix(dados: DadosChavePix): Erros<DadosChavePix> {
  const erros: Erros<DadosChavePix> = {
    tipo: dados.tipo ? undefined : "escolha o tipo da chave.",
    chave: dados.tipo ? erroChavePix(dados.tipo, dados.chave) : undefined,
    senhaAtual: dados.senhaAtual ? undefined : "informe sua senha atual.",
  };
  return limpar(erros);
}

function limpar<T>(erros: Erros<T>): Erros<T> {
  return Object.fromEntries(Object.entries(erros).filter(([, v]) => v)) as Erros<T>;
}
