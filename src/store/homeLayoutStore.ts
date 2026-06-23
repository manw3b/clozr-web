import { create } from "zustand";
import * as api from "@/lib/api";

/**
 * Config del home por rol del workspace activo (Fase ⑧). La carga MiDia para
 * armar los bloques que ve el rol actual, y la edita el dueño desde Equipo. Si
 * un rol no tiene entrada, MiDia cae a su default (ver homeBlocks.ts).
 */
interface HomeLayoutState {
  workspaceId: string | null;
  layouts: Record<string, string[]> | null;
  loading: boolean;
  /** Carga la config del workspace (idempotente por workspace). */
  load: (workspaceId: string) => void;
  /** Reemplaza la config en memoria (tras guardar en Equipo). */
  setLayouts: (workspaceId: string, layouts: Record<string, string[]>) => void;
}

export const useHomeLayoutStore = create<HomeLayoutState>((set, get) => ({
  workspaceId: null,
  layouts: null,
  loading: false,
  load: (workspaceId) => {
    const st = get();
    if (st.loading) return;
    if (st.workspaceId === workspaceId && st.layouts) return;
    set({ loading: true, workspaceId, layouts: st.workspaceId === workspaceId ? st.layouts : null });
    api
      .getHomeLayouts()
      .then((r) => set({ layouts: r.layouts ?? {}, workspaceId, loading: false }))
      // Ante error caemos a {} → MiDia usa los defaults (no rompe el home).
      .catch(() => set({ layouts: {}, loading: false }));
  },
  setLayouts: (workspaceId, layouts) => set({ workspaceId, layouts }),
}));
