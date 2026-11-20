import type { SVGProps } from "react";

/**
 * Ícones em SVG inline (traço 1.8, cantos arredondados) — sem dependência externa.
 * São decorativos por padrão; o texto acessível fica no elemento que os contém.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 22, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
);

export const IconHeart = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Base {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 4 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.8 1.1-1.7 2.7-2.8 4.7-2.8 3.3 0 5.7 3.1 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z" />
  </Base>
);

export const IconBag = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 8h14l-1 12.5H6L5 8Z" />
    <path d="M9 10V7a3 3 0 0 1 6 0v3" />
  </Base>
);

export const IconUser = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" />
  </Base>
);

export const IconMenu = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h10M4 17h16" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconArrowRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const IconArrowUpRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Base>
);

export const IconCamera = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2.5h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Base>
);

export const IconTag = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.6 6.6a1.5 1.5 0 0 1-2.1 0l-8.3-8.3Z" />
    <circle cx="8" cy="8" r="1.4" />
  </Base>
);

/** Losango do Pix estilizado (não é o logotipo oficial). */
export const IconPix = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5 20.5 12 12 20.5 3.5 12 12 3.5Z" />
    <path d="M8 12h8M12 8v8" />
  </Base>
);

export const IconSparkle = (p: IconProps) => (
  <Base {...p} fill="currentColor" stroke="none">
    <path d="M12 2c.6 4.8 2.6 7.4 8 8.2v.6c-5.4.8-7.4 3.4-8 8.2h-.6c-.6-4.8-2.6-7.4-8-8.2v-.6c5.4-.8 7.4-3.4 8-8.2h.6Z" />
  </Base>
);

export const IconHanger = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 8.5V7.6a2.2 2.2 0 1 1 2.2-2.2" />
    <path d="M12 8.5 3 15.2c-.9.7-.4 2.3.8 2.3h16.4c1.2 0 1.7-1.6.8-2.3L12 8.5Z" />
  </Base>
);

export const IconCoins = (p: IconProps) => (
  <Base {...p}>
    <ellipse cx="9" cy="7" rx="5.5" ry="2.5" />
    <path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7" />
    <path d="M9.5 16.3c.9.1 1.8.2 2.5.2 3 0 5.5-1.1 5.5-2.5v-3" />
    <path d="M14.5 11.6c2.4.3 6 1.3 6 2.9v3.5c0 1.4-2.5 2.5-5.5 2.5s-5.5-1.1-5.5-2.5v-1.5" />
  </Base>
);

export const IconGem = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.5 4h11L21 9l-9 11L3 9l3.5-5Z" />
    <path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5" />
  </Base>
);

export const IconHandshake = (p: IconProps) => (
  <Base {...p}>
    <path d="m11 7.5-2-1.6a2 2 0 0 0-2.3-.1L3 8v6.5l2 1" />
    <path d="m21 14.5-2 1V8l-3.4-2.1a2 2 0 0 0-2.1 0L9.2 8.6a1.4 1.4 0 0 0 1.4 2.4l2.4-1.3 4.5 4.3a1.3 1.3 0 0 1-1.8 1.9" />
    <path d="m15.7 15.9-1.1 1a1.3 1.3 0 0 1-1.8-1.9M12.8 17.9l-.6.6a1.3 1.3 0 0 1-1.9-1.9M5 15.5l3 2.6a1.3 1.3 0 0 0 1.8-1.9" />
  </Base>
);

export const IconUsersHeart = (p: IconProps) => (
  <Base {...p}>
    <circle cx="8" cy="8" r="3.2" />
    <path d="M2.5 19.5c.8-3.3 2.8-5 5.5-5 1.6 0 2.9.6 3.9 1.7" />
    <path d="M17.5 20.5s-4-2.4-4.8-4.9c-.6-1.8.6-3.4 2.3-3.4 1 0 1.9.6 2.5 1.4.6-.8 1.4-1.4 2.5-1.4 1.7 0 2.9 1.6 2.3 3.4-.8 2.5-4.8 4.9-4.8 4.9Z" />
  </Base>
);

export const IconInstagram = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
  </Base>
);

export const IconTiktok = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 3.5v11.3a3.7 3.7 0 1 1-3.7-3.7" />
    <path d="M14 3.5c.4 2.7 2.3 4.6 5 4.8" />
  </Base>
);

export const IconPinterest = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M10.8 9.2c.4-1 1.4-1.7 2.6-1.6 1.6.1 2.6 1.4 2.4 3-.3 2.1-1.8 3.4-3.3 3.1-.9-.2-1.4-1-1.2-1.9M11.5 11.3 9.2 20.3" />
  </Base>
);

/* Ícones da barra de acessibilidade e do seletor de tema */

export const IconLibras = (p: IconProps) => (
  <Base {...p}>
    <path d="M18 11V6a2 2 0 0 0-4 0" />
    <path d="M14 10V4a2 2 0 0 0-4 0v2" />
    <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </Base>
);

export const IconVoz = (p: IconProps) => (
  <Base {...p}>
    <path d="M8.8 20v-4.1l1.9.2a2.3 2.3 0 0 0 2.164-2.1V8.3A5.37 5.37 0 0 0 2 8.25c0 2.8.656 3.054 1 4.55a5.77 5.77 0 0 1 .029 2.758L2 20" />
    <path d="M19.8 17.8a7.5 7.5 0 0 0 .003-10.603" />
    <path d="M17 15a3.5 3.5 0 0 0-.025-4.975" />
  </Base>
);

export const IconOlho = (p: IconProps) => (
  <Base {...p}>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

export const IconAlerta = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </Base>
);

export const IconOlhoRiscado = (p: IconProps) => (
  <Base {...p}>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </Base>
);

export const IconSol = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </Base>
);

export const IconLua = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </Base>
);

export const IconParar = (p: IconProps) => (
  <Base {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Base>
);
