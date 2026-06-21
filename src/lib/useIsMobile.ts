import { useEffect, useState } from "react";

/** Breakpoint único de la app (coincide con el @media de globals.css). */
export const MOBILE_BREAKPOINT = 767;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`;

/**
 * `true` cuando el viewport es de móvil (≤767px). Para diferencias de
 * comportamiento/markup (sidebar→drawer, tabla→tarjetas). Para layout puro
 * preferí las clases CSS de globals.css (`.cz-metric-grid`, `.cz-two-col`),
 * que no tienen flash de hidratación.
 *
 * SSR-safe: arranca en `false` (desktop) y se corrige al montar.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}
