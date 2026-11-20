/**
 * Limite de tentativas em memória (uma instância). No sistema final fica no Redis, para valer
 * entre várias instâncias do backend (documento de arquitetura, §6.4).
 */
export class LimiteTentativas {
  private registros = new Map<string, { falhas: number[]; bloqueadoAte?: number }>();

  constructor(
    private maxFalhas: number,
    private janelaMs: number,
    private bloqueioMs: number,
    private agora: () => number = Date.now,
  ) {}

  /** Momento (ms) até quando a chave está bloqueada, ou null. */
  bloqueadoAte(chave: string): number | null {
    const r = this.registros.get(chave);
    if (r?.bloqueadoAte && r.bloqueadoAte > this.agora()) return r.bloqueadoAte;
    return null;
  }

  registrarFalha(chave: string) {
    const agora = this.agora();
    const r = this.registros.get(chave) ?? { falhas: [] };
    r.falhas = [...r.falhas.filter((t) => agora - t < this.janelaMs), agora];
    if (r.falhas.length >= this.maxFalhas) {
      r.bloqueadoAte = agora + this.bloqueioMs;
      r.falhas = [];
    }
    this.registros.set(chave, r);
  }

  limpar(chave: string) {
    this.registros.delete(chave);
  }
}
