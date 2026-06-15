/**
 * Cotización del dólar para el chip del topbar (y futuras conversiones
 * USD↔ARS en Reportes/Caja). Usa la API pública gratuita dolarapi.com
 * (CORS abierto), así que no toca el Worker. Best-effort: si falla, el
 * chip simplemente no se muestra.
 */
export interface DolarRate {
  casa: string; // "oficial" | "blue" | "bolsa" | "contadoconliqui" | ...
  nombre: string;
  compra: number;
  venta: number;
}

const LABELS: Record<string, string> = {
  oficial: "Oficial",
  blue: "Blue",
  bolsa: "MEP",
  contadoconliqui: "CCL",
  tarjeta: "Tarjeta",
  mayorista: "Mayorista",
  cripto: "Cripto",
};

export function dolarLabel(casa: string): string {
  return LABELS[casa] ?? casa;
}

export async function fetchDolares(): Promise<DolarRate[]> {
  const res = await fetch("https://dolarapi.com/v1/dolares", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`dolar_http_${res.status}`);
  const data = (await res.json()) as Array<Record<string, unknown>>;
  return data.map((d) => ({
    casa: String(d.casa ?? ""),
    nombre: String(d.nombre ?? ""),
    compra: Number(d.compra ?? 0),
    venta: Number(d.venta ?? 0),
  }));
}
