import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Plus, Trash2, LogOut } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { confirmAsync } from "@/lib/confirmAsync";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { color, radius, space, text, weight } from "@/tokens";
import * as api from "@/lib/api";
import type { PaymentOption, User } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  admin: "Encargado",
  vendedor: "Vendedor",
  viewer: "Solo lectura",
};

/**
 * Vista Ajustes (v1) — config del workspace con backend real (sin Tauri):
 * nombre del espacio (PATCH /workspaces/:wid), métodos de pago (ruta genérica
 * payment-methods) y datos de la cuenta. DIFERIDO de la desktop: backup/restore
 * local, cuenta-en-la-nube, precios del catálogo, plantillas de WhatsApp/tareas,
 * config de dólar — son Tauri-only o features que la web aún no tiene.
 */
export function Ajustes({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { showToast } = useUIStore();
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const role = activeWorkspace?.role ?? "viewer";
  const canManage = role === "owner" || role === "admin";

  const [name, setName] = useState(activeWorkspace?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  useEffect(() => {
    setName(activeWorkspace?.name ?? "");
  }, [activeWorkspace?.id, activeWorkspace?.name]);

  async function saveName() {
    const n = name.trim();
    if (!n || n === activeWorkspace?.name) return;
    setSavingName(true);
    try {
      await api.updateWorkspace({ name: n });
      useWorkspaceStore.setState((s) => ({
        activeWorkspace: s.activeWorkspace ? { ...s.activeWorkspace, name: n } : s.activeWorkspace,
        workspaces: s.workspaces.map((w) => (w.id === s.activeWorkspace?.id ? { ...w, name: n } : w)),
      }));
      showToast("Espacio actualizado", "success");
    } catch {
      showToast("No se pudo guardar", "error");
    } finally {
      setSavingName(false);
    }
  }

  const [methods, setMethods] = useState<PaymentOption[]>([]);
  const [newMethod, setNewMethod] = useState("");
  const loadMethods = useCallback(() => {
    api.listPaymentMethods().then(setMethods).catch(() => {});
  }, []);
  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  async function addMethod() {
    const n = newMethod.trim();
    if (!n) return;
    try {
      await api.createPaymentMethod(n);
      setNewMethod("");
      loadMethods();
      showToast("Método agregado", "success");
    } catch {
      showToast("No se pudo agregar", "error");
    }
  }

  async function removeMethod(m: PaymentOption) {
    const ok = await confirmAsync({
      message: `¿Eliminar el método "${m.name}"?`,
      tone: "danger",
      confirmText: "Eliminar",
    });
    if (!ok) return;
    try {
      await api.deletePaymentMethod(m.id);
      loadMethods();
    } catch {
      showToast("No se pudo eliminar", "error");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5], maxWidth: 720 }}>
      <PageHeader title="Ajustes" subtitle="Configuración del espacio de trabajo" />

      {/* Espacio de trabajo */}
      <Card padding={5}>
        <SectionTitle>Espacio de trabajo</SectionTitle>
        <div style={{ display: "flex", gap: space[2], alignItems: "flex-end", marginTop: space[3] }}>
          <div style={{ flex: 1 }}>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
          </div>
          <Button
            variant="primary"
            onClick={saveName}
            loading={savingName}
            disabled={!canManage || !name.trim() || name.trim() === activeWorkspace?.name}
          >
            Guardar
          </Button>
        </div>
        {!canManage && <Hint>Solo el dueño o un encargado pueden editar el espacio.</Hint>}
      </Card>

      {/* Métodos de pago */}
      <Card padding={5}>
        <SectionTitle>Métodos de pago</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: space[2], marginTop: space[3] }}>
          {methods.length === 0 && <Hint>Todavía no agregaste métodos de pago.</Hint>}
          {methods.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: space[2],
                padding: `${space[2]} ${space[3]}`,
                background: color.surface2,
                borderRadius: radius.md,
              }}
            >
              <span style={{ flex: 1, fontSize: text.sm, color: color.text }}>{m.name}</span>
              {!m.enabled && (
                <Badge tone="neutral" size="sm">
                  Inactivo
                </Badge>
              )}
              {canManage && (
                <Button variant="ghost" size="sm" iconLeft={<Trash2 size={13} />} onClick={() => removeMethod(m)} />
              )}
            </div>
          ))}
        </div>
        {canManage && (
          <div style={{ display: "flex", gap: space[2], marginTop: space[3] }}>
            <div style={{ flex: 1 }}>
              <Input
                value={newMethod}
                onChange={(e) => setNewMethod(e.target.value)}
                placeholder="Ej: Mercado Pago"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addMethod();
                }}
              />
            </div>
            <Button variant="secondary" iconLeft={<Plus size={14} />} onClick={addMethod} disabled={!newMethod.trim()}>
              Agregar
            </Button>
          </div>
        )}
      </Card>

      {/* Cuenta */}
      <Card padding={5}>
        <SectionTitle>Cuenta</SectionTitle>
        <div style={{ marginTop: space[3], display: "flex", flexDirection: "column", gap: space[2] }}>
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Rol" value={ROLE_LABELS[role] ?? role} />
          <InfoRow label="Plan" value={user.plan || "—"} />
        </div>
        <div style={{ marginTop: space[4] }}>
          <Button variant="secondary" iconLeft={<LogOut size={14} />} onClick={onLogout}>
            Cerrar sesión
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 style={{ margin: 0, fontSize: text.md, fontWeight: weight.semibold, color: color.text }}>{children}</h2>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, marginBottom: space[1] }}>
      {children}
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p style={{ margin: `${space[2]} 0 0`, fontSize: text.xs, color: color.textDim }}>{children}</p>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: space[3], fontSize: text.sm }}>
      <span style={{ color: color.textMuted }}>{label}</span>
      <span style={{ color: color.text, fontWeight: weight.medium }}>{value}</span>
    </div>
  );
}
