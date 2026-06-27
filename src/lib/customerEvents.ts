import { useEffect } from "react";

/**
 * Sincronización de la lista de clientes entre pantallas (sin store global).
 *
 * Cada vista (Ventas/Crm, Clientes, Pipeline, MiDía, Deudas…) tiene su propia
 * copia de los clientes. Cuando se crea/edita/archiva uno en cualquier lado,
 * `notifyCustomersChanged()` avisa por un evento de `window` y todas las vistas
 * suscritas refrescan al toque — sin necesidad de F5. Mismo patrón que el evento
 * `clozr:item-changed` que ya usa el pipeline.
 */
const EVENT = "clozr:customer-changed";

export function notifyCustomersChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** Suscribe un refresco al evento global de clientes; se desuscribe al desmontar. */
export function useCustomersChanged(onChange: () => void): void {
  useEffect(() => {
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
    // onChange usa setters estables de React → alcanza con suscribir una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
