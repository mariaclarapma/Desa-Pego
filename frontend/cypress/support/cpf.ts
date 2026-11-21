/**
 * CPF válido e aleatório para os testes E2E (Req. 001): o banco recusa CPF repetido, então cada
 * conta criada nos testes precisa do seu. São CPFs gerados (dígitos verificadores certos), não de pessoas.
 */
function digitoVerificador(base: string) {
  const soma = [...base].reduce((total, n, i) => total + Number(n) * (base.length + 1 - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export function gerarCpf(): string {
  let base = "";
  do {
    base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
  } while (/^(\d)\1{8}$/.test(base));
  const d1 = digitoVerificador(base);
  return `${base}${d1}${digitoVerificador(base + d1)}`;
}
