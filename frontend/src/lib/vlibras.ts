/**
 * VLibras: tradutor oficial do governo federal de português para Libras.
 * O script é carregado só quando a pessoa clica no botão de Libras.
 */
const URL_APP = "https://vlibras.gov.br/app";

declare global {
  interface Window {
    VLibras?: { Widget: new (url: string) => unknown };
  }
}

let carregamento: Promise<void> | null = null;

function montarMarcacao() {
  if (document.querySelector("[vw]")) return;
  const raiz = document.createElement("div");
  raiz.setAttribute("vw", "");
  raiz.className = "enabled";
  raiz.innerHTML = '<div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
  document.body.appendChild(raiz);
}

function carregar(): Promise<void> {
  carregamento ??= new Promise((resolve, reject) => {
    montarMarcacao();
    const script = document.createElement("script");
    script.src = `${URL_APP}/vlibras-plugin.js`;
    script.async = true;
    script.onload = () => {
      if (!window.VLibras) return reject(new Error("VLibras indisponível"));
      new window.VLibras.Widget(URL_APP);
      // o widget se inicia no evento load da página, que já passou: dispara manualmente
      (window.onload as (() => void) | null)?.call(window);
      resolve();
    };
    script.onerror = () => {
      carregamento = null;
      reject(new Error("Não foi possível carregar o VLibras. Verifique a conexão."));
    };
    document.body.appendChild(script);
  });
  return carregamento;
}

/**
 * Botão que abre o tradutor. A versão 7 do VLibras desenha o botão dentro de um shadow DOM aberto
 * (#vlibras-access-wrapper); versões antigas usam [vw-access-button] na página.
 */
function botaoDoVLibras(): HTMLElement | null {
  const sombra = document.getElementById("vlibras-access-wrapper")?.shadowRoot;
  if (sombra) {
    // esconde só o lançador flutuante do VLibras: quem abre o tradutor é o botão da nossa barra
    if (!sombra.getElementById("desapego-esconde-lancador")) {
      const estilo = document.createElement("style");
      estilo.id = "desapego-esconde-lancador";
      estilo.textContent = "#vlibras-access { display: none !important; }";
      sombra.appendChild(estilo);
    }
    return sombra.getElementById("vlibras-button");
  }
  const antigo = document.querySelector<HTMLElement>("[vw-access-button]");
  return antigo && antigo.childElementCount > 0 ? antigo : null;
}

/** Abre o tradutor de Libras (carrega o VLibras na primeira vez). */
export async function abrirVLibras(): Promise<void> {
  await carregar();
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const botao = botaoDoVLibras();
    if (botao) {
      botao.click();
      return;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("O VLibras demorou para abrir. Tente de novo.");
}
