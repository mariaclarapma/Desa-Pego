import { Sticker } from "@/components/ui/Sticker";

/** Aviso amigável quando a API (json-server em desenvolvimento) não responde. */
export function ApiIndisponivel() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <Sticker tone="pervinca" rotate={-3}>
        eita!
      </Sticker>
      <h1 className="mt-6 font-display text-4xl font-medium tracking-tight text-roxo">não conseguimos falar com a API</h1>
      <p className="mt-4 text-roxo-soft">
        Confira se o backend está rodando: na raiz do projeto, rode <code className="rounded bg-nevoa-200 px-1.5 py-0.5">npm run dev</code>.
      </p>
    </section>
  );
}
