/**
 * Cotización del dólar blue, compartida por toda la app (venta, inventario).
 * Antes cada vista fetcheaba dolarapi por su cuenta; este store lo trae una
 * sola vez y lo cachea. `useBlueRate()` dispara la carga la primera vez que
 * algún componente lo necesita y devuelve la venta del blue (o null).
 */
import { useEffect } from "react";
import { create } from "zustand";
import { fetchDolares } from "@/lib/dolar";

interface DollarState {
  blue: number | null; // venta del dólar blue
  status: "idle" | "loading" | "ready";
  load: () => Promise<void>;
}

export const useDollarStore = create<DollarState>((set, get) => ({
  blue: null,
  status: "idle",
  load: async () => {
    if (get().status !== "idle") return;
    set({ status: "loading" });
    try {
      const rates = await fetchDolares();
      const blue = rates.find((r) => r.casa === "blue") ?? rates[0] ?? null;
      set({ blue: blue ? blue.venta : null, status: "ready" });
    } catch {
      set({ status: "ready" });
    }
  },
}));

/** Devuelve la cotización del blue (venta) y dispara la carga una sola vez. */
export function useBlueRate(): number | null {
  const blue = useDollarStore((s) => s.blue);
  const status = useDollarStore((s) => s.status);
  const load = useDollarStore((s) => s.load);
  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);
  return blue;
}
