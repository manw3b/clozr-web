"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Undo2, X } from "lucide-react";
import { useUndoableActions, type UndoableAction } from "@/store/useUndoableActions";
import { color, radius, space, text, weight } from "@/tokens";

/**
 * Host de toasts undoable. Se monta UNA VEZ (en Crm) y escucha el store
 * useUndoableActions. Toast en la esquina inferior izquierda con countdown +
 * "Deshacer". Portado verbatim del desktop.
 */
export function UndoToastHost() {
  const actions = useUndoableActions((s) => s.actions);

  useEffect(() => {
    const onBeforeUnload = () => {
      void useUndoableActions.getState().flushAll();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  if (actions.length === 0) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        bottom: space[5],
        left: space[5],
        display: "flex",
        flexDirection: "column",
        gap: space[2],
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <style>{`
        @keyframes clozr-undo-in {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
      {actions.map((action) => (
        <UndoToast key={action.id} action={action} />
      ))}
    </div>,
    document.body,
  );
}

function UndoToast({ action }: { action: UndoableAction }) {
  const undo = useUndoableActions((s) => s.undo);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, []);

  const remaining = Math.max(0, action.expiresAt - now);
  const pctRemaining = (remaining / action.durationMs) * 100;

  return (
    <div
      style={{
        pointerEvents: "auto",
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.lg,
        padding: `${space[3]} ${space[4]}`,
        minWidth: 320,
        maxWidth: 480,
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        gap: space[3],
        position: "relative",
        overflow: "hidden",
        animation: "clozr-undo-in 220ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: color.border }}>
        <div style={{ width: `${pctRemaining}%`, height: "100%", background: color.primary, transition: "width 100ms linear" }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {action.label}
        </div>
        {action.sublabel && (
          <div style={{ fontSize: text.xs, color: color.textMuted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {action.sublabel}
          </div>
        )}
      </div>

      <button
        onClick={() => undo(action.id)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: `${space[1]} ${space[3]}`,
          background: color.primary,
          color: "#fff",
          border: "none",
          borderRadius: radius.sm,
          fontSize: text.xs,
          fontWeight: weight.semibold,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <Undo2 size={12} strokeWidth={2.4} />
        Deshacer
      </button>

      <button
        onClick={() => void useUndoableActions.getState().flush(action.id)}
        aria-label="Cerrar"
        title="Cerrar (confirma el cambio)"
        style={{ background: "transparent", color: color.textMuted, border: "none", padding: 4, borderRadius: radius.sm, cursor: "pointer", flexShrink: 0, display: "inline-flex" }}
      >
        <X size={13} />
      </button>
    </div>
  );
}
