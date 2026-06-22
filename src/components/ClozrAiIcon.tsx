import type { CSSProperties } from "react";

/**
 * Icono oficial de IA de Clozr: un destello de 4 puntas con centro brillante,
 * opcionalmente dentro de un anillo (como en la marca). Usa `currentColor`, así
 * que el color se controla con `style={{ color: ... }}` del que lo usa.
 */
export function ClozrAiIcon({
  size = 16,
  ring = false,
  glow = false,
  style,
}: {
  size?: number;
  ring?: boolean;
  glow?: boolean;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, filter: glow ? "drop-shadow(0 0 4px currentColor)" : undefined, ...style }}
    >
      {ring && <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1" opacity="0.45" />}
      {/* Destello de 4 puntas con lados cóncavos */}
      <path
        d="M12 2.2c.45 5.1 2.5 7.15 7.6 7.8 0 0 .2 0 .2 .2-.05.45-2.5.95-3.6 1.55-2.05 1.1-3.55 2.95-4.05 6.05-.05.45-.15.45-.2 0-.5-3.1-2-4.95-4.05-6.05-1.1-.6-3.55-1.1-3.6-1.55 0-.2.2-.2.2-.2 5.1-.65 7.15-2.7 7.6-7.8.02-.27.28-.27.3 0Z"
        fill="currentColor"
      />
    </svg>
  );
}
