/**
 * CPF (Req. 001): normalização e validação pelos dígitos verificadores.
 * As mesmas regras rodam no formulário (frontend/src/lib/validacao-conta.ts).
 *
 * As mensagens de erro nunca repetem o CPF digitado: elas podem ir para a resposta da API.
 */
export type ResultadoCpf = { ok: true; cpf: string } | { ok: false; erro: string };

export const ERRO_CPF_VAZIO = "informe seu CPF.";
export const ERRO_CPF_TAMANHO = "o CPF precisa ter 11 dígitos.";
export const ERRO_CPF_INVALIDO = "CPF inválido. confira os números.";

/** Dígito verificador do CPF para a base dada (9 dígitos → 1º DV; 10 dígitos → 2º DV). */
function digitoVerificador(base: string) {
  const soma = [...base].reduce((total, n, i) => total + Number(n) * (base.length + 1 - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/**
 * Aceita "123.456.789-09" ou "12345678909" (espaços nas pontas são ignorados) e devolve
 * só os 11 dígitos, a forma que vai para o hash e para a cifra.
 */
export function validarCpf(valor: unknown): ResultadoCpf {
  if (typeof valor !== "string" || !valor.trim()) return { ok: false, erro: ERRO_CPF_VAZIO };
  const bruto = valor.trim();
  // só dígitos e a pontuação usual; letras ou outros símbolos não são CPF
  if (bruto.length > 14 || !/^[\d.\-\s]+$/.test(bruto)) return { ok: false, erro: ERRO_CPF_INVALIDO };
  const cpf = bruto.replace(/\D/g, "");
  if (cpf.length !== 11) return { ok: false, erro: ERRO_CPF_TAMANHO };
  // 000.000.000-00, 111.111.111-11…: passam na conta dos dígitos, mas não são CPFs válidos
  if (/^(\d)\1{10}$/.test(cpf)) return { ok: false, erro: ERRO_CPF_INVALIDO };
  if (digitoVerificador(cpf.slice(0, 9)) !== Number(cpf[9]) || digitoVerificador(cpf.slice(0, 10)) !== Number(cpf[10])) {
    return { ok: false, erro: ERRO_CPF_INVALIDO };
  }
  return { ok: true, cpf };
}

export const cpfValido = (valor: string) => validarCpf(valor).ok;
