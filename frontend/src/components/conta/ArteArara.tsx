"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/*
 * Ilustração da arara do login e do cadastro (puramente decorativa).
 *
 * As peças ficam penduradas na barra (y = BARRA) e balançam como pêndulos quando o cursor passa
 * pela arara: cada uma tem a sua "mola" (k), então o movimento não é igual entre elas, e o
 * amortecimento devolve tudo ao repouso aos poucos. Só usamos transform (rotate/translate), sem
 * mexer no layout, e nada se move com `prefers-reduced-motion: reduce`.
 */

const LARGURA = 600;
const BARRA = 110;
const ANGULO_MAX = 7; // graus
const VELOCIDADE_MAX = 45; // graus por segundo
const AMORTECIMENTO = 3;

const v = (nome: string) => `var(--arara-${nome})`;

/** Cabide de madeira com o gancho de metal, desenhado em volta de x = 0. */
function Cabide() {
  return (
    <>
      <path d={`M0 130 V118 C0 104 13 103 12 ${BARRA + 3}`} fill="none" stroke={v("metal-escuro")} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M-34 152 Q-28 142 0 130 Q28 142 34 152" fill="none" stroke={v("madeira")} strokeWidth={5} strokeLinecap="round" />
    </>
  );
}

function Mangas({ ate, cor, largura = 30 }: { ate: number; cor: string; largura?: number }) {
  const l = largura;
  return (
    <g fill={v(cor)}>
      <path d={`M${-l + 4} 150 L${-l - 14} 168 L${-l - 18} ${ate} L${-l - 6} ${ate + 3} L${-l + 1} 192 Z`} />
      <path d={`M${l - 4} 150 L${l + 14} 168 L${l + 18} ${ate} L${l + 6} ${ate + 3} L${l - 1} 192 Z`} />
    </g>
  );
}

function Vestido() {
  return (
    <>
      <path d="M-14 148 L-16 162 M14 148 L16 162" stroke={v("ameixa-escuro")} strokeWidth={3} strokeLinecap="round" />
      <path d="M-24 158 Q0 168 24 158 L20 205 Q0 211 -20 205 Z" fill={v("ameixa")} />
      <path d="M-20 203 Q0 209 20 203 L56 378 Q0 396 -56 378 Z" fill={v("ameixa")} />
      <path d="M-6 214 L-26 384 M7 214 L22 386 M0 214 Q-2 300 2 392" fill="none" stroke={v("ameixa-escuro")} strokeWidth={2} opacity={0.55} />
      <path d="M-3 209 L-14 252 L-5 247 Z M3 209 L14 252 L5 247 Z" fill={v("ameixa-claro")} />
      <path d="M0 205 L-25 192 Q-30 205 -23 219 Z M0 205 L25 192 Q30 205 23 219 Z" fill={v("ameixa-claro")} />
      <circle cx={0} cy={205} r={6} fill={v("ameixa-escuro")} />
    </>
  );
}

function Blusa() {
  return (
    <>
      <Mangas ate={262} cor="lilas-escuro" largura={28} />
      <path d="M-28 148 Q0 158 28 148 L32 272 Q0 282 -32 272 Z" fill={v("lilas")} />
      <path d="M-10 150 L0 166 L10 150" fill="none" stroke={v("lilas-escuro")} strokeWidth={2} />
      {[184, 209, 234].map((y) => (
        <circle key={y} cx={0} cy={y} r={2.5} fill={v("offwhite")} />
      ))}
    </>
  );
}

function Casaco() {
  return (
    <>
      <Mangas ate={330} cor="creme-escuro" largura={32} />
      <path d="M-32 148 Q0 156 32 148 L38 362 Q0 372 -38 362 Z" fill={v("creme")} />
      <path d="M-14 150 L-5 214 L0 196 L5 214 L14 150 M0 196 V366" fill="none" stroke={v("creme-escuro")} strokeWidth={2.2} />
      <path d="M-36 262 Q0 270 36 262" fill="none" stroke={v("creme-escuro")} strokeWidth={7} />
      <circle cx={8} cy={230} r={3} fill={v("creme-escuro")} />
      <circle cx={8} cy={300} r={3} fill={v("creme-escuro")} />
    </>
  );
}

function Sueter({ cor, escuro, comprimento }: { cor: string; escuro: string; comprimento: number }) {
  return (
    <>
      <Mangas ate={comprimento + 4} cor={escuro} largura={32} />
      <path d={`M-32 148 Q0 158 32 148 L34 ${comprimento} Q0 ${comprimento + 10} -34 ${comprimento} Z`} fill={v(cor)} />
      <path d="M-12 150 Q0 162 12 150" fill="none" stroke={v(escuro)} strokeWidth={3} />
      <path
        d={`M-10 172 Q-14 ${(172 + comprimento) / 2} -10 ${comprimento - 14} M10 172 Q14 ${(172 + comprimento) / 2} 10 ${comprimento - 14}`}
        fill="none"
        stroke={v(escuro)}
        strokeWidth={1.6}
        opacity={0.6}
      />
      <path
        d={[-28, -21, -14, -7, 0, 7, 14, 21, 28].map((x) => `M${x} ${comprimento - 12} V${comprimento + 3}`).join(" ")}
        stroke={v(escuro)}
        strokeWidth={1.5}
        opacity={0.7}
      />
    </>
  );
}

function Cardiga() {
  return (
    <>
      <Mangas ate={290} cor="lilas-escuro" largura={30} />
      <path d="M-30 148 Q0 158 30 148 L34 302 Q0 312 -34 302 Z" fill={v("lavanda")} />
      <path d="M0 160 V308" stroke={v("lilas-escuro")} strokeWidth={2} />
      {[190, 220, 250, 280].map((y) => (
        <circle key={y} cx={5} cy={y} r={2.5} fill={v("offwhite")} />
      ))}
      <path d="M-26 262 H-10 V282 H-26 Z M12 262 H28 V282 H12 Z" fill="none" stroke={v("lilas-escuro")} strokeWidth={1.6} />
    </>
  );
}

function Lenco({ id }: { id: string }) {
  const contorno = "M-26 148 Q0 156 26 148 L50 350 Q10 362 -32 350 Z";
  return (
    <>
      <clipPath id={id}>
        <path d={contorno} />
      </clipPath>
      <path d={contorno} fill={v("lavanda-claro")} />
      <g clipPath={`url(#${id})`} stroke={v("lavanda")} strokeWidth={6}>
        {Array.from({ length: 16 }, (_, i) => (
          <path key={i} d={`M-70 ${100 + i * 18} L70 ${170 + i * 18}`} />
        ))}
      </g>
      <path
        d={Array.from({ length: 14 }, (_, i) => `M${-30 + i * 6} ${352 + i * 0.3} v12`).join(" ")}
        stroke={v("lavanda")}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </>
  );
}

/** Peças na ordem de desenho (a da frente por último), com a "mola" de cada uma. */
const PECAS: { x: number; k: number; desenho: (id: string) => ReactNode }[] = [
  { x: 435, k: 30, desenho: (id) => <Lenco id={id} /> },
  { x: 390, k: 41, desenho: () => <Cardiga /> },
  { x: 345, k: 35, desenho: () => <Sueter cor="creme" escuro="creme-escuro" comprimento={276} /> },
  { x: 300, k: 44, desenho: () => <Sueter cor="roxo" escuro="roxo-escuro" comprimento={284} /> },
  { x: 255, k: 28, desenho: () => <Casaco /> },
  { x: 210, k: 38, desenho: () => <Blusa /> },
  { x: 165, k: 33, desenho: () => <Vestido /> },
];

/** Hortênsias: cachos de pétalas em três tons de lilás. */
const CACHOS = [
  { x: 86, y: 430 },
  { x: 120, y: 420 },
  { x: 102, y: 398 },
  { x: 138, y: 446 },
  { x: 70, y: 454 },
];
const PETALAS = [
  [0, 0],
  [-11, -5],
  [10, -7],
  [-8, 9],
  [9, 8],
  [0, -13],
  [-14, 4],
  [14, 2],
];

function Chao() {
  return (
    <g>
      <ellipse cx={300} cy={572} rx={282} ry={14} fill={v("sombra")} opacity={0.08} />

      {/* vaso com hortênsias */}
      <path d="M105 488 L96 444 M105 488 L114 438 M105 488 L104 452" stroke={v("folha")} strokeWidth={2.4} strokeLinecap="round" />
      {CACHOS.map((c, i) => (
        <g key={i}>
          {PETALAS.map(([dx, dy], j) => (
            <circle key={j} cx={c.x + dx} cy={c.y + dy} r={8.5} fill={v(["flor-1", "flor-2", "flor-3"][(i + j) % 3])} />
          ))}
        </g>
      ))}
      <path d="M70 486 Q62 522 78 568 H132 Q148 522 140 486 Z" fill={v("vidro")} stroke={v("lilas-escuro")} strokeWidth={1.5} opacity={0.92} />
      <path d="M68 512 H142" stroke={v("lilas")} strokeWidth={1.4} opacity={0.7} />

      {/* caixas de chapéu */}
      <rect x={150} y={508} width={112} height={60} rx={8} fill={v("creme")} stroke={v("creme-escuro")} strokeWidth={1.5} />
      <rect x={150} y={530} width={112} height={8} fill={v("ameixa")} />
      <rect x={146} y={500} width={120} height={14} rx={6} fill={v("offwhite")} stroke={v("creme-escuro")} strokeWidth={1.5} />
      <rect x={166} y={458} width={82} height={44} rx={6} fill={v("offwhite")} stroke={v("creme-escuro")} strokeWidth={1.5} />
      <rect x={203} y={458} width={8} height={44} fill={v("ameixa")} />
      <rect x={162} y={451} width={90} height={12} rx={5} fill={v("creme")} stroke={v("creme-escuro")} strokeWidth={1.5} />
      <path d="M207 452 C190 432 180 452 207 452 Z M207 452 C224 432 234 452 207 452 Z" fill={v("ameixa-claro")} />

      {/* sacola de compras */}
      <path d="M486 458 Q501 420 516 458 M506 458 Q521 426 536 458" fill="none" stroke={v("creme-escuro")} strokeWidth={3} />
      <path d="M466 456 H556 L564 568 H458 Z" fill={v("offwhite")} stroke={v("creme-escuro")} strokeWidth={1.5} />
      <path
        d="M511 494c.9 7.2 3.9 11.1 12 12.3v.9c-8.1 1.2-11.1 5.1-12 12.3h-.9c-.9-7.2-3.9-11.1-12-12.3v-.9c8.1-1.2 11.1-5.1 12-12.3h.9Z"
        fill={v("ameixa")}
      />

      {/* bolsa: sobe um pouco no hover */}
      <g className="transition-transform duration-500 ease-out motion-safe:group-hover/arara:-translate-y-1.5">
        <path d="M276 494 Q306 444 336 494" fill="none" stroke={v("lilas-escuro")} strokeWidth={7} strokeLinecap="round" />
        <path d="M258 494 H354 L364 568 Q306 576 248 568 Z" fill={v("lilas")} />
        <path d="M258 494 H354 L348 530 Q306 540 264 530 Z" fill={v("lilas-escuro")} />
        <rect x={299} y={526} width={14} height={12} rx={2} fill={v("dourado")} />
      </g>

      {/* sapatos: um pequeno passo no hover */}
      <g className="transition-transform delay-75 duration-500 ease-out motion-safe:group-hover/arara:-translate-y-0.5 motion-safe:group-hover/arara:translate-x-1">
        {[
          { x: 368, cor: "lilas-escuro" },
          { x: 392, cor: "lilas" },
        ].map(({ x, cor }) => (
          <g key={x}>
            <path d={`M${x + 4} 548 L${x + 6} 570`} stroke={v(cor)} strokeWidth={3} strokeLinecap="round" />
            <path
              d={`M${x} 544 Q${x + 6} 534 ${x + 16} 538 Q${x + 34} 554 ${x + 58} 556 Q${x + 76} 558 ${x + 78} 570 H${x + 22} Q${x + 14} 560 ${x + 6} 554 Z`}
              fill={v(cor)}
            />
          </g>
        ))}
      </g>

      {/* traços de movimento delicados */}
      <path d="M58 300 Q46 330 58 360 M46 306 Q36 330 46 354" fill="none" stroke="var(--color-rosa)" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
      <path d="M546 330 Q560 356 548 384" fill="none" stroke="var(--color-rosa)" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
    </g>
  );
}

export function ArteArara({ className = "" }: { className?: string }) {
  const idLenco = useId().replace(/:/g, "");
  const areaRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pecasRef = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    const area = areaRef.current;
    const svg = svgRef.current;
    if (!area || !svg) return;
    // sem matchMedia (ambientes antigos ou de teste), o movimento fica desligado
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? { matches: true };
    const estado = PECAS.map(() => ({ angulo: 0, velocidade: 0 }));
    let quadro = 0;
    let ultimo = 0;

    const limitar = (n: number, max: number) => Math.max(-max, Math.min(max, n));

    function passo(agora: number) {
      if (reduzir.matches) {
        estado.forEach((s, i) => {
          s.angulo = s.velocidade = 0;
          pecasRef.current[i]?.style.removeProperty("transform");
        });
        quadro = 0;
        return;
      }
      const dt = Math.min(0.032, (agora - ultimo) / 1000 || 0.016);
      ultimo = agora;
      let emMovimento = false;
      estado.forEach((s, i) => {
        const aceleracao = -PECAS[i].k * s.angulo - AMORTECIMENTO * s.velocidade;
        s.velocidade = limitar(s.velocidade + aceleracao * dt, VELOCIDADE_MAX);
        s.angulo = limitar(s.angulo + s.velocidade * dt, ANGULO_MAX);
        if (Math.abs(s.angulo) > 0.02 || Math.abs(s.velocidade) > 0.05) emMovimento = true;
        else s.angulo = s.velocidade = 0;
        const g = pecasRef.current[i];
        if (g) g.style.transform = s.angulo ? `rotate(${s.angulo.toFixed(3)}deg)` : "";
      });
      quadro = emMovimento ? requestAnimationFrame(passo) : 0;
    }

    function acordar() {
      if (quadro) return;
      ultimo = performance.now();
      quadro = requestAnimationFrame(passo);
    }

    // o cursor "empurra" as peças perto dele, na direção e na velocidade em que passa
    function mover(e: PointerEvent) {
      if (reduzir.matches || e.pointerType === "touch") return;
      const caixa = svg!.getBoundingClientRect();
      if (caixa.width <= 0) return;
      const escala = LARGURA / caixa.width;
      const x = (e.clientX - caixa.left) * escala; // o viewBox começa em x = 0
      const dx = e.movementX * escala;
      if (!dx) return;
      PECAS.forEach((p, i) => {
        const distancia = (x - p.x) / 70;
        const influencia = Math.exp(-distancia * distancia);
        estado[i].velocidade += dx * influencia * (0.38 + (i % 3) * 0.06);
      });
      acordar();
    }

    // ao entrar, um empurrão leve e diferente em cada peça
    function entrar(e: PointerEvent) {
      if (reduzir.matches || e.pointerType === "touch") return;
      estado.forEach((s, i) => (s.velocidade += (i % 2 ? 1 : -1) * (5 + i * 1.2)));
      acordar();
    }

    area.addEventListener("pointermove", mover);
    area.addEventListener("pointerenter", entrar);
    return () => {
      area.removeEventListener("pointermove", mover);
      area.removeEventListener("pointerenter", entrar);
      cancelAnimationFrame(quadro);
    };
  }, []);

  return (
    <div ref={areaRef} className={`arte-arara group/arara relative ${className}`}>
      <svg ref={svgRef} viewBox={`0 72 ${LARGURA} 520`} aria-hidden="true" focusable="false" className="relative w-full overflow-visible">
        {/* arara de metal rosé */}
        <path
          d={`M110 566 V145 Q110 ${BARRA} 145 ${BARRA} H455 Q490 ${BARRA} 490 145 V566`}
          fill="none"
          stroke={v("metal")}
          strokeWidth={7}
          strokeLinecap="round"
        />
        <path d="M84 570 H136 M464 570 H516" stroke={v("metal-escuro")} strokeWidth={7} strokeLinecap="round" />

        {PECAS.map((peca, i) => (
          <g
            key={peca.x}
            ref={(el) => {
              pecasRef.current[i] = el;
            }}
            style={{ transformBox: "view-box", transformOrigin: `${peca.x}px ${BARRA}px` }}
          >
            {/* as peças ficam um pouco maiores que o desenho base, para encher a arara como na vitrine */}
            <g transform={`translate(${peca.x} ${BARRA}) scale(1.2) translate(0 ${-BARRA})`}>
              {peca.desenho(`lenco-${idLenco}`)}
              <Cabide />
            </g>
          </g>
        ))}

        <Chao />
      </svg>

    </div>
  );
}
