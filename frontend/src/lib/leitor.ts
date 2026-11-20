/**
 * Leitor de voz com a Web Speech API do navegador (sem serviço externo).
 * Divide o texto em frases, porque alguns navegadores cortam falas muito longas.
 */
export function leitorDisponivel(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function dividirEmFrases(texto: string, limite = 200): string[] {
  const frases = texto.replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]*/g) ?? [];
  const partes: string[] = [];
  for (const frase of frases.map((f) => f.trim()).filter(Boolean)) {
    if (frase.length <= limite) partes.push(frase);
    else for (let i = 0; i < frase.length; i += limite) partes.push(frase.slice(i, i + limite));
  }
  return partes;
}

export function falar(texto: string, aoTerminar: () => void) {
  const voz = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("pt"));
  const partes = dividirEmFrases(texto);
  if (partes.length === 0) return aoTerminar();
  window.speechSynthesis.cancel();
  partes.forEach((parte, i) => {
    const fala = new SpeechSynthesisUtterance(parte);
    fala.lang = "pt-BR";
    if (voz) fala.voice = voz;
    if (i === partes.length - 1) {
      fala.onend = aoTerminar;
      fala.onerror = aoTerminar;
    }
    window.speechSynthesis.speak(fala);
  });
}

export function pararDeFalar() {
  if (leitorDisponivel()) window.speechSynthesis.cancel();
}
