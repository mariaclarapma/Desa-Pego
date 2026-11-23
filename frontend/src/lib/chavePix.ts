/**
 * Lê o campo `temChavePix` do token de acesso (Req. 002), só para a tela avisar antes da hora.
 * Não é segurança: quem barra a publicação sem chave Pix é o backend (exigirChavePix).
 */
export function tokenTemChavePix(token: string): boolean {
  try {
    const carga = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(carga)).temChavePix === true;
  } catch {
    return false;
  }
}
