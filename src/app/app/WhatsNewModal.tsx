"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { color, radius, space, text, weight } from "@/tokens";
import { CHANGELOG, LATEST_VERSION, type ChangeTone } from "@/lib/changelog";

const LS_KEY = "clozr.whatsNew.lastSeenVersion";

const TONE: Record<ChangeTone, { bg: string; fg: string; label: string }> = {
  feat: { bg: color.successBg, fg: color.success, label: "Nuevo" },
  ux: { bg: color.primaryBg, fg: color.primary, label: "Mejora" },
  fix: { bg: color.warningBg, fg: color.warning, label: "Fix" },
  perf: { bg: color.infoBg, fg: color.info, label: "Performance" },
};

/**
 * Modal "¿Qué hay de nuevo?" — se muestra una vez por `version` (la primera
 * vez de todas marca como vista sin mostrar, para no molestar al estrenar).
 */
export function WhatsNewModal() {
  const [open, setOpen] = useState(false);
  const entry = CHANGELOG[0];

  useEffect(() => {
    if (!entry) return;
    const lastSeen = localStorage.getItem(LS_KEY);
    // Si ya vio esta versión, no molestar. Si nunca vio nada (usuario actual
    // que estrena la feature) sí la mostramos: es la primera entrega visible.
    if (lastSeen === LATEST_VERSION) return;
    setOpen(true);
  }, [entry]);

  function close() {
    setOpen(false);
    localStorage.setItem(LS_KEY, LATEST_VERSION);
  }

  if (!entry) return null;

  return (
    <Modal
      open={open}
      onClose={close}
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: space[2] }}>
          <Sparkles size={18} color={color.primary} strokeWidth={2.4} />
          ¿Qué hay de nuevo?
        </span>
      }
      subtitle={entry.date}
      maxWidth={560}
      footer={
        <>
          <span style={{ flex: 1 }} />
          <Button variant="primary" onClick={close}>
            Entendido
          </Button>
        </>
      }
    >
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: space[2] }}>
        {entry.bullets.map((b, i) => {
          const t = TONE[b.tone];
          return (
            <li
              key={i}
              style={{
                display: "flex",
                gap: space[3],
                alignItems: "baseline",
                fontSize: text.sm,
                color: color.text,
                lineHeight: 1.5,
                padding: `${space[2]} ${space[3]}`,
                background: color.surface2,
                borderRadius: radius.md,
                border: `1px solid ${color.border}`,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 10,
                  fontWeight: weight.bold,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  padding: "2px 6px",
                  background: t.bg,
                  color: t.fg,
                  borderRadius: radius.sm,
                }}
              >
                {t.label}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>{b.text}</span>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
