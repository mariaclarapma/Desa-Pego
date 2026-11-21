import { decifrarChavePix, mascararChavePix } from "../../comum/chave-pix.js";
import type { Banco, ChavePixRegistro, UsuarioRegistro } from "./banco.js";

/**
 * Chave Pix e perfil de vendedora (Req. 002), do lado do serviço de contas.
 * Tudo o que sai daqui para uma resposta HTTP é mascarado ou público.
 */

/** Decifra sem lançar erro: null se a cifra não abrir (PIX_CRIPTO_CHAVE trocada, dado corrompido). */
function decifrarOuNull(registro: ChavePixRegistro, segredo: Buffer) {
  try {
    return decifrarChavePix(registro.chave_cifrada, segredo, registro.usuario_id);
  } catch {
    // só o id da conta vai para o log: nem a cifra, nem o motivo detalhado, nem a chave
    console.warn(`[contas] chave Pix ilegível na conta ${registro.usuario_id}: a vendedora precisa cadastrar de novo (veja docs/CHAVE-PIX.md).`);
    return null;
  }
}

/**
 * O que a própria vendedora vê da chave: tipo, máscara e data. Nunca a chave completa.
 * Se a cifra não abrir, `pix` fica null e `pixIndisponivel` true: a vendedora vê o aviso e o
 * formulário para cadastrar de novo, em vez de um erro 500.
 */
export function estadoChavePix(registro: ChavePixRegistro | undefined, segredo: Buffer) {
  const chave = registro ? decifrarOuNull(registro, segredo) : null;
  if (!registro || chave === null) return { pix: null, pixIndisponivel: !!registro };
  return {
    pix: { tipo: registro.tipo, mascarada: mascararChavePix(registro.tipo, chave), atualizadaEm: registro.atualizada_em },
    pixIndisponivel: false,
  };
}

/**
 * A conta tem uma chave Pix que dá para usar no repasse. Uma chave ilegível conta como "sem chave":
 * a vendedora não publica anúncios novos até cadastrar de novo (o token sai com temChavePix false).
 */
export async function temChavePixUtilizavel(banco: Banco, segredo: Buffer, usuarioId: string) {
  const registro = await banco.chavePix(usuarioId);
  return !!registro && decifrarOuNull(registro, segredo) !== null;
}

/** Nome mostrado na vitrine: o nome público ou, se vazio, o primeiro nome. */
export const nomeNaVitrine = (u: Pick<UsuarioRegistro, "nome" | "nome_publico">) => u.nome_publico || u.nome.trim().split(/\s+/)[0];

/** Perfil público da vendedora: sem e-mail, sem documento e sem chave Pix. */
export const perfilPublico = (u: UsuarioRegistro) => ({ id: u.id, nomePublico: nomeNaVitrine(u), cidade: u.cidade ?? null });

/**
 * USO RESTRITO: chave Pix completa, para a administração fazer o repasse manual (Issue #014).
 * Lança erro se a cifra não abrir: no repasse, é melhor parar do que seguir sem a chave.
 *
 * De propósito, nenhuma rota chama esta função hoje. Quem for expor deve seguir docs/CHAVE-PIX.md:
 * rota só para ADMIN_MASTER (perfil relido do banco), reautenticação com a senha da admin,
 * resposta com Cache-Control: no-store e registro em log de quem consultou e quando
 * (sem registrar a chave).
 */
export async function lerChavePixCompletaParaRepasse(banco: Banco, segredo: Buffer, usuarioId: string) {
  const registro = await banco.chavePix(usuarioId);
  if (!registro) return null;
  return { tipo: registro.tipo, chave: decifrarChavePix(registro.chave_cifrada, segredo, usuarioId) };
}
