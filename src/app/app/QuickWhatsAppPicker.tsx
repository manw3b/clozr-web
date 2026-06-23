import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { color, radius, space, text, weight } from "@/tokens";
import { useWorkspaceStore } from "@/store/workspaceStore";
import * as api from "@/lib/api";
import { openWhatsApp } from "@/lib/openExternal";
import { applyQuickTemplate, parseQuickTemplates, type QuickTemplate } from "@/lib/quickTemplates";
import type { Customer } from "@/lib/types";

/**
 * Picker de mensajes rápidos (Fase ③): elegís una plantilla y abre WhatsApp con
 * el texto ya rellenado ({nombre}/{negocio}) hacia el teléfono del cliente.
 */
export function QuickWhatsAppPicker({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const negocio = useWorkspaceStore((s) => s.activeWorkspace?.name) ?? "";
  const [templates, setTemplates] = useState<QuickTemplate[] | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => setTemplates(parseQuickTemplates(s)))
      .catch(() => setTemplates(parseQuickTemplates(null)));
  }, []);

  function send(t: QuickTemplate) {
    if (!customer.phone) return;
    openWhatsApp(customer.phone, applyQuickTemplate(t.body, { nombre: customer.name, negocio }));
    onClose();
  }

  return (
    <Modal open onClose={onClose} maxWidth={520} title="WhatsApp rápido" subtitle={customer.name}>
      {templates === null ? (
        <div style={{ fontSize: text.sm, color: color.textMuted, padding: space[3] }}>Cargando…</div>
      ) : templates.length === 0 ? (
        <div style={{ fontSize: text.sm, color: color.textMuted, padding: space[3] }}>
          No hay mensajes rápidos. Creálos en Ajustes → Mensajes rápidos.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => send(t)}
              style={{
                textAlign: "left",
                padding: space[3],
                background: color.surface,
                border: `1px solid ${color.border}`,
                borderRadius: radius.md,
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: space[3],
              }}
            >
              <WhatsAppIcon size={16} color="var(--success)" />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>{t.name}</span>
                <span style={{ display: "block", fontSize: text.xs, color: color.textMuted, marginTop: 2, whiteSpace: "pre-wrap" }}>
                  {applyQuickTemplate(t.body, { nombre: customer.name, negocio })}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
