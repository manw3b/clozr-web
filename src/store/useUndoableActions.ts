/**
 * Sistema de "undoable actions" estilo Gmail/Linear. Portado verbatim del desktop.
 *
 * El usuario hace una acción destructiva → se registra acá pero NO se ejecuta
 * en el server de inmediato. El UI hace un optimistic remove. Aparece un toast
 * con countdown + "Deshacer". Si deshace antes del timeout → onUndo() revierte.
 * Si pasa el timeout → commit() (el delete real).
 */

import { create } from "zustand";

export interface UndoableAction {
  id: string;
  label: string;
  sublabel?: string;
  expiresAt: number;
  durationMs: number;
  commit: () => Promise<void> | void;
  onUndo: () => void;
}

interface UndoableState {
  actions: UndoableAction[];
  register: (input: {
    label: string;
    sublabel?: string;
    commit: () => Promise<void> | void;
    onUndo: () => void;
    durationMs?: number;
  }) => string;
  undo: (id: string) => void;
  flush: (id: string) => Promise<void>;
  flushAll: () => Promise<void>;
}

export const useUndoableActions = create<UndoableState>((set, get) => ({
  actions: [],

  register({ label, sublabel, commit, onUndo, durationMs = 6000 }) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const action: UndoableAction = { id, label, sublabel, expiresAt: now + durationMs, durationMs, commit, onUndo };
    set((s) => ({ actions: [...s.actions, action] }));
    setTimeout(() => {
      void get().flush(id);
    }, durationMs);
    return id;
  },

  undo(id) {
    const action = get().actions.find((a) => a.id === id);
    if (!action) return;
    set((s) => ({ actions: s.actions.filter((a) => a.id !== id) }));
    try {
      action.onUndo();
    } catch (e) {
      console.error("undo callback threw:", e);
    }
  },

  async flush(id) {
    const action = get().actions.find((a) => a.id === id);
    if (!action) return;
    set((s) => ({ actions: s.actions.filter((a) => a.id !== id) }));
    try {
      await action.commit();
    } catch (e) {
      console.error("undoable commit threw:", e);
    }
  },

  async flushAll() {
    const pending = get().actions;
    set({ actions: [] });
    await Promise.all(
      pending.map(async (a) => {
        try {
          await a.commit();
        } catch (e) {
          console.error("flushAll commit threw:", e);
        }
      }),
    );
  },
}));
