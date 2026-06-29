"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, SquarePen, Sparkles, Check } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { color, radius, space, text, weight } from "@/tokens";
import type { AssistantAction } from "@/lib/api";

/**
 * Renderiza las `actions` que el asistente propone junto a su respuesta
 * (contrato web↔Worker, ver docs/asistente.md). Self-contained: no sabe de
 * navegación ni de la API — sube cada acción por `onRun` y el contenedor decide
 * (abrir form, navegar, WhatsApp, o ejecutar). El usuario SIEMPRE toca el botón;
 * nada se dispara solo.
 */
export function AiActions({
  actions,
  onRun,
}: {
  actions: AssistantAction[];
  onRun: (a: AssistantAction) => void | Promise<{ ok: boolean } | void>;
}) {
  if (!actions || actions.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[2], marginTop: space[2] }}>
      {actions.map((a, i) =>
        a.type === "confirm_execute" ? (
          <ConfirmCard key={i} action={a} onRun={onRun} />
        ) : (
          <ActionChip key={i} action={a} onRun={onRun} />
        ),
      )}
    </div>
  );
}

function actionIcon(a: AssistantAction): ReactNode {
  if (a.type === "whatsapp") return <WhatsAppIcon size={15} />;
  if (a.type === "navigate") return <ArrowRight size={15} />;
  return <SquarePen size={15} />; // open_form
}

/** Botón para las acciones de Nivel 2 (abrir form / navegar / WhatsApp). */
function ActionChip({
  action,
  onRun,
}: {
  action: AssistantAction;
  onRun: (a: AssistantAction) => void | Promise<{ ok: boolean } | void>;
}) {
  const label = "label" in action ? action.label : "";
  return (
    <button
      type="button"
      onClick={() => onRun(action)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: space[2],
        alignSelf: "flex-start",
        maxWidth: "100%",
        padding: "8px 12px",
        borderRadius: radius.md,
        border: `1px solid ${color.primary}`,
        background: color.surface2,
        color: color.primary,
        fontSize: text.sm,
        fontWeight: weight.semibold,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ display: "inline-flex", flexShrink: 0 }}>{actionIcon(action)}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}

/** Card de confirmación para el Nivel 3: muestra el resumen y ejecuta al OK. */
function ConfirmCard({
  action,
  onRun,
}: {
  action: Extract<AssistantAction, { type: "confirm_execute" }>;
  onRun: (a: AssistantAction) => void | Promise<{ ok: boolean } | void>;
}) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");

  async function confirm() {
    if (state === "running" || state === "done") return;
    setState("running");
    try {
      const r = await onRun(action);
      setState(r && "ok" in r && !r.ok ? "error" : "done");
    } catch {
      setState("error");
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        background: color.surface2,
        padding: space[3],
        display: "flex",
        flexDirection: "column",
        gap: space[2],
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
        <Sparkles size={14} style={{ color: color.primary, flexShrink: 0 }} />
        <span style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>{action.label}</span>
      </div>
      <div style={{ fontSize: text.sm, color: color.textMuted, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
        {action.summary}
      </div>
      {state === "done" ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: text.sm, fontWeight: weight.semibold, color: color.success }}>
          <Check size={15} /> Hecho
        </span>
      ) : (
        <button
          type="button"
          onClick={confirm}
          disabled={state === "running"}
          style={{
            alignSelf: "flex-start",
            padding: "8px 14px",
            borderRadius: radius.md,
            border: "none",
            background: color.primary,
            color: "#fff",
            fontSize: text.sm,
            fontWeight: weight.semibold,
            cursor: state === "running" ? "default" : "pointer",
            opacity: state === "running" ? 0.7 : 1,
          }}
        >
          {state === "running" ? "Confirmando…" : state === "error" ? "Reintentar" : "Confirmar"}
        </button>
      )}
      {state === "error" && (
        <span style={{ fontSize: text.xs, color: color.textDim }}>
          No se pudo ejecutar todavía. Probá de nuevo en un rato.
        </span>
      )}
    </div>
  );
}
