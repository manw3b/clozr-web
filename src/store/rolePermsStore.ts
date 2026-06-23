import { create } from "zustand";
import * as api from "@/lib/api";

/**
 * Override de permisos por rol del workspace activo (Fase ⑤). Lo carga
 * usePermissions para que el `can()` de toda la app respete lo que configuró el
 * negocio (no solo los defaults). El Worker es la autoridad real; esto es para
 * que la UI muestre/oculte acciones de forma coherente.
 */
interface RolePermsState {
  workspaceId: string | null;
  matrix: Record<string, string[]> | null;
  loading: boolean;
  /** Carga la matriz efectiva del workspace (idempotente por workspace). */
  load: (workspaceId: string) => void;
  /** Reemplaza la matriz en memoria (tras guardar en Equipo). */
  setMatrix: (workspaceId: string, matrix: Record<string, string[]>) => void;
}

export const useRolePermsStore = create<RolePermsState>((set, get) => ({
  workspaceId: null,
  matrix: null,
  loading: false,
  load: (workspaceId) => {
    const st = get();
    if (st.loading) return;
    if (st.workspaceId === workspaceId && st.matrix) return;
    set({ loading: true, workspaceId, matrix: st.workspaceId === workspaceId ? st.matrix : null });
    api
      .getRolePermissions()
      .then((r) => set({ matrix: r.roles, workspaceId, loading: false }))
      .catch(() => set({ loading: false }));
  },
  setMatrix: (workspaceId, matrix) => set({ workspaceId, matrix }),
}));
