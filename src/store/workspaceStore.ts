import { create } from "zustand";
import type { Workspace } from "../lib/types";
import {
  fetchMe,
  getWorkspaceId,
  setWorkspaceId,
  createWorkspace as apiCreateWorkspace,
} from "../lib/api";

/**
 * Versión web del workspaceStore del desktop. Misma forma (workspaces +
 * activeWorkspace + acciones) pero la data viene del Worker vía `api.ts`
 * (GET /me) en vez de SQLite local. El "active" se persiste en localStorage
 * (clozr_ws) para que las llamadas multi-tenant de api.ts apunten al ws correcto.
 */
interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  loadWorkspaces: () => Promise<void>;
  setActiveWorkspace: (workspace: Workspace) => void;
  addWorkspace: (workspace: Workspace) => void;
  createWorkspace: (name: string) => Promise<Workspace>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspace: null,
  isLoading: true,

  loadWorkspaces: async () => {
    set({ isLoading: true });
    try {
      const { workspaces } = await fetchMe();
      const savedId = getWorkspaceId();
      const active = workspaces.find((w) => w.id === savedId) ?? workspaces[0] ?? null;
      if (active) setWorkspaceId(active.id);
      set({ workspaces, activeWorkspace: active, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err instanceof Error ? err : new Error("Error cargando espacios de trabajo");
    }
  },

  setActiveWorkspace: (workspace) => {
    setWorkspaceId(workspace.id);
    set({ activeWorkspace: workspace });
  },

  addWorkspace: (workspace) =>
    set((state) => ({
      workspaces: [...state.workspaces, workspace],
      activeWorkspace: state.activeWorkspace ?? workspace,
    })),

  createWorkspace: async (name) => {
    const w = await apiCreateWorkspace(name);
    setWorkspaceId(w.id);
    set((state) => ({ workspaces: [...state.workspaces, w], activeWorkspace: w }));
    return w;
  },
}));
