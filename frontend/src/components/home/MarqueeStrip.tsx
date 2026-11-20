import { IconSparkle } from "@/components/ui/icons";

const PALAVRAS = ["desapega", "garimpa", "anuncia", "recebe via Pix", "repete", "circula"];

/** Faixa inclinada com palavras correndo — dá ritmo entre seções. Decorativa. */
export function MarqueeStrip() {
  const itens = [...PALAVRAS, ...PALAVRAS];
  return (
    <div aria-hidden="true" className="relative z-10 -my-2 overflow-hidden py-4">
      <div className="-rotate-[1.5deg] border-y-2 border-roxo bg-violeta py-3 text-nevoa sm:py-4">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((bloco) => (
            <ul key={bloco} className="flex shrink-0 items-center">
              {itens.map((palavra, i) => (
                <li
                  key={`${bloco}-${i}`}
                  className="flex items-center gap-6 px-6 font-display text-3xl font-medium tracking-tight italic sm:text-5xl"
                >
                  {palavra}
                  <IconSparkle size={22} className="text-rosa" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}
