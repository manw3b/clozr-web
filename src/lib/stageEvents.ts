import { useEffect } from "react";

/**
 * Sincronización de las etapas del pipeline entre pantallas (sin store global).
 *
 * Las etapas se editan en Ajustes, pero se usan en el board del Pipeline y en el
 * form de "Agregar/editar oportunidad" (que viven en Crm.tsx con su propia copia
 * de `stages`). Cuando se crean/borran, `notifyStagesChanged()` avisa por un
 * evento de `window` y las vistas suscritas refrescan al toque — sin F5. Mismo
 * patrón que `clozr:customer-changed` / `clozr:item-changed`.
 */
const EVENT = "clozr:stage-changed";

export function notifyStagesChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** Suscribe un refresco al evento global de etapas; se desuscribe al desmontar. */
export function useStagesChanged(onChange: () => void): void {
  useEffect(() => {
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
    // onChange usa setters estables de React → alcanza con suscribir una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
