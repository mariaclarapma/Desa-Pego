/** Regras puras das preferências de acessibilidade (sem estado; pode ser usado no servidor). */
export type EscolhaTema = "sistema" | "claro" | "escuro";
export type TemaAplicado = "claro" | "escuro" | "alto-contraste";

export interface Preferencias {
  tema: EscolhaTema;
  altoContraste: boolean;
  /** Multiplicador do tamanho da fonte (1 = 100%). */
  escalaFonte: number;
}

export const CHAVE_PREFERENCIAS = "desapego-preferencias";
export const PADRAO: Preferencias = { tema: "sistema", altoContraste: false, escalaFonte: 1 };
export const ESCALAS = [0.9, 1, 1.15, 1.3, 1.5] as const;

/** Decide o tema final: alto contraste vence; "sistema" segue o sistema operacional. */
export function temaAplicado(p: Preferencias, sistemaEscuro: boolean): TemaAplicado {
  if (p.altoContraste) return "alto-contraste";
  if (p.tema === "sistema") return sistemaEscuro ? "escuro" : "claro";
  return p.tema;
}

export function sistemaPrefereEscuro(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function aplicarPreferencias(p: Preferencias, html: HTMLElement = document.documentElement) {
  html.dataset.tema = temaAplicado(p, sistemaPrefereEscuro());
  html.style.setProperty("--escala-fonte", String(p.escalaFonte));
}

/**
 * Script que roda no <head>, antes da primeira pintura, para a página não "piscar" no tema errado.
 * Lê o mesmo JSON que o Zustand salva (chave CHAVE_PREFERENCIAS, campo state).
 */
export const SCRIPT_PREFERENCIAS = `(function(){try{var p=(JSON.parse(localStorage.getItem("${CHAVE_PREFERENCIAS}")||"{}").state)||{};var e=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=p.altoContraste?"alto-contraste":p.tema==="escuro"||((!p.tema||p.tema==="sistema")&&e)?"escuro":"claro";var h=document.documentElement;h.dataset.tema=t;if(p.escalaFonte)h.style.setProperty("--escala-fonte",String(p.escalaFonte));}catch(_){document.documentElement.dataset.tema="claro";}})();`;
