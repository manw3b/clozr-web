import { create } from "zustand";

/**
 * Estado global para abrir la IA de Clozr desde cualquier lado (⌘K, botones).
 * `pendingQuery` se autoenvía al abrir el chat (uso "Raycast for business").
 */
interface AiState {
  open: boolean;
  pendingQuery: string | null;
  openAi: (query?: string) => void;
  closeAi: () => void;
  consumePendingQuery: () => string | null;
}

export const useAiStore = create<AiState>((set, get) => ({
  open: false,
  pendingQuery: null,
  openAi: (query) => set({ open: true, pendingQuery: query?.trim() || null }),
  closeAi: () => set({ open: false, pendingQuery: null }),
  consumePendingQuery: () => {
    const q = get().pendingQuery;
    if (q) set({ pendingQuery: null });
    return q;
  },
}));
