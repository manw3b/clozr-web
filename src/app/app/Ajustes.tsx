import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, Trash2, LogOut, Upload, Trophy, XCircle, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { confirmAsync } from "@/lib/confirmAsync";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { usePermissions } from "@/store/usePermissions";
import { color, radius, space, text, weight } from "@/tokens";
import * as api from "@/lib/api";
import { roleLabel } from "@/lib/permissions";
import type { PaymentOption, User, CustomerType, CustomerTag, PipelineStage } from "@/lib/types";
import { PLANS, PAID_PLAN_IDS, SEATS_UNLIMITED, BILLING_TRIAL_DAYS, formatArs, type PlanId } from "@/lib/types";

/**
 * Vista Ajustes — config del workspace con backend real (worker):
 * espacio (nombre + objetivo diario + logo), métodos de pago, tipos de cliente,
 * etiquetas, etapas del pipeline, y cuenta (nombre editable). Cada bloque pega
 * a su ruta del worker. Diferido (Tauri-only): backup/restore, about/updater.
 */
export function Ajustes({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { showToast } = useUIStore();
  const { can } = usePermissions();
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const role = activeWorkspace?.role ?? "viewer";
  const canManage = can("settings.manage");

  /* ── Espacio: nombre ── */
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

  /* ── Espacio: objetivo diario ── */
  const [goal, setGoal] = useState("");
  const [goalCur, setGoalCur] = useState("ARS");
  const [savingGoal, setSavingGoal] = useState(false);
  useEffect(() => {
    setGoal(activeWorkspace?.dailyGoal ? String(activeWorkspace.dailyGoal) : "");
    setGoalCur(activeWorkspace?.dailyGoalCurrency ?? "ARS");
  }, [activeWorkspace?.id, activeWorkspace?.dailyGoal, activeWorkspace?.dailyGoalCurrency]);

  async function saveGoal() {
    const amount = goal ? Number(goal) : 0;
    setSavingGoal(true);
    try {
      await api.updateWorkspace({ dailyGoal: amount, dailyGoalCurrency: goalCur });
      useWorkspaceStore.setState((s) => ({
        activeWorkspace: s.activeWorkspace
          ? { ...s.activeWorkspace, dailyGoal: amount, dailyGoalCurrency: goalCur }
          : s.activeWorkspace,
      }));
      showToast("Objetivo guardado", "success");
    } catch {
      showToast("No se pudo guardar el objetivo", "error");
    } finally {
      setSavingGoal(false);
    }
  }

  /* ── Espacio: logo ── */
  const logoKey = activeWorkspace?.logoKey ?? null;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function onLogoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permitir re-subir el mismo archivo
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("La imagen supera 2MB", "error");
      return;
    }
    setUploadingLogo(true);
    try {
      const { key } = await api.uploadWorkspaceLogo(file);
      useWorkspaceStore.setState((s) => ({
        activeWorkspace: s.activeWorkspace ? { ...s.activeWorkspace, logoKey: key } : s.activeWorkspace,
        workspaces: s.workspaces.map((w) => (w.id === s.activeWorkspace?.id ? { ...w, logoKey: key } : w)),
      }));
      showToast("Logo actualizado", "success");
    } catch {
      showToast("No se pudo subir el logo", "error");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    const ok = await confirmAsync({ message: "¿Quitar el logo del negocio?", tone: "danger", confirmText: "Quitar" });
    if (!ok) return;
    try {
      await api.deleteWorkspaceLogo();
      useWorkspaceStore.setState((s) => ({
        activeWorkspace: s.activeWorkspace ? { ...s.activeWorkspace, logoKey: null } : s.activeWorkspace,
        workspaces: s.workspaces.map((w) => (w.id === s.activeWorkspace?.id ? { ...w, logoKey: null } : w)),
      }));
    } catch {
      showToast("No se pudo quitar el logo", "error");
    }
  }

  /* ── Métodos de pago ── */
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
      showToast("No se pudo agregar (¿ya existe?)", "error");
    }
  }
  async function removeMethod(m: PaymentOption) {
    const ok = await confirmAsync({ message: `¿Eliminar el método "${m.name}"?`, tone: "danger", confirmText: "Eliminar" });
    if (!ok) return;
    try {
      await api.deletePaymentMethod(m.id);
      loadMethods();
    } catch {
      showToast("No se pudo eliminar", "error");
    }
  }

  /* ── Cuenta: nombre ── */
  const [profileName, setProfileName] = useState(user.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  async function saveProfile() {
    const n = profileName.trim();
    if (!n || n === (user.name ?? "")) return;
    setSavingProfile(true);
    try {
      await api.updateMyName(n);
      showToast("Nombre actualizado", "success");
    } catch {
      showToast("No se pudo guardar", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5], maxWidth: 720 }}>
      <PageHeader title="Ajustes" subtitle="Configuración del espacio de trabajo" />

      {/* Espacio de trabajo */}
      <Card padding={5}>
        <SectionTitle>Espacio de trabajo</SectionTitle>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: space[3], marginTop: space[3] }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.md,
              background: color.surface2,
              border: `1px solid ${color.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
              fontSize: 24,
            }}
          >
            {logoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={api.assetUrl(logoKey)} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              "🏪"
            )}
          </div>
          <div style={{ flex: 1 }}>
            <Label>Logo del negocio</Label>
            <Hint>PNG/JPG/WebP, hasta 2MB. Aparece en la barra superior.</Hint>
          </div>
          {canManage && (
            <div style={{ display: "flex", gap: space[2] }}>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onLogoPicked} />
              <Button variant="secondary" size="sm" iconLeft={<Upload size={13} />} loading={uploadingLogo} onClick={() => fileRef.current?.click()}>
                {logoKey ? "Cambiar" : "Subir"}
              </Button>
              {logoKey && <Button variant="ghost" size="sm" iconLeft={<Trash2 size={13} />} onClick={removeLogo} />}
            </div>
          )}
        </div>

        {/* Nombre */}
        <div style={{ display: "flex", gap: space[2], alignItems: "flex-end", marginTop: space[4] }}>
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

        {/* Objetivo diario */}
        <div style={{ display: "flex", gap: space[2], alignItems: "flex-end", marginTop: space[4] }}>
          <div style={{ flex: 1 }}>
            <Label>Objetivo de ventas por día</Label>
            <Input type="number" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="0" disabled={!canManage} />
          </div>
          <div style={{ width: 96 }}>
            <Label>Moneda</Label>
            <select
              value={goalCur}
              onChange={(e) => setGoalCur(e.target.value)}
              disabled={!canManage}
              style={selectStyle}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <Button
            variant="primary"
            onClick={saveGoal}
            loading={savingGoal}
            disabled={
              !canManage ||
              (Number(goal) || 0) === (activeWorkspace?.dailyGoal ?? 0) && goalCur === (activeWorkspace?.dailyGoalCurrency ?? "ARS")
            }
          >
            Guardar
          </Button>
        </div>
        <Hint>Se muestra en Mi Día como meta del equipo.</Hint>

        {!canManage && <Hint>Solo el dueño o un encargado pueden editar el espacio.</Hint>}
      </Card>

      {/* Plan y facturación */}
      <PlanCard />

      {/* Tipos de cliente */}
      <CustomerTypesCard canManage={canManage} showToast={showToast} />

      {/* Etiquetas de cliente */}
      <CustomerTagsCard canManage={canManage} showToast={showToast} />

      {/* Etapas del pipeline */}
      <StagesCard canManage={canManage} showToast={showToast} />

      {/* Métodos de pago */}
      <Card padding={5}>
        <SectionTitle>Métodos de pago</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: space[2], marginTop: space[3] }}>
          {methods.length === 0 && <Hint>Todavía no agregaste métodos de pago.</Hint>}
          {methods.map((m) => (
            <Row key={m.id}>
              <span style={{ flex: 1, fontSize: text.sm, color: color.text }}>{m.name}</span>
              {!m.enabled && <Badge tone="neutral" size="sm">Inactivo</Badge>}
              {canManage && <Button variant="ghost" size="sm" iconLeft={<Trash2 size={13} />} onClick={() => removeMethod(m)} />}
            </Row>
          ))}
        </div>
        {canManage && (
          <AddRow
            value={newMethod}
            onChange={setNewMethod}
            onAdd={addMethod}
            placeholder="Ej: Mercado Pago"
          />
        )}
      </Card>

      {/* Cuenta */}
      <Card padding={5}>
        <SectionTitle>Cuenta</SectionTitle>
        <div style={{ display: "flex", gap: space[2], alignItems: "flex-end", marginTop: space[3] }}>
          <div style={{ flex: 1 }}>
            <Label>Tu nombre</Label>
            <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Tu nombre" />
          </div>
          <Button
            variant="primary"
            onClick={saveProfile}
            loading={savingProfile}
            disabled={!profileName.trim() || profileName.trim() === (user.name ?? "")}
          >
            Guardar
          </Button>
        </div>
        <div style={{ marginTop: space[3], display: "flex", flexDirection: "column", gap: space[2] }}>
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Rol" value={roleLabel(role)} />
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

/* ════════════ Plan y facturación (billing T3) ════════════ */
function PlanCard() {
  const showToast = useUIStore((s) => s.showToast);
  const ws = useWorkspaceStore((s) => s.activeWorkspace);
  const isOwner = ws?.role === "owner";
  const planId = (ws?.plan as PlanId) ?? "free";
  const current = PLANS[planId] ?? PLANS.free;
  const status = ws?.planStatus ?? "active";
  const seats = ws?.seats ?? current.seats;
  const [busy, setBusy] = useState<PlanId | null>(null);

  // Planes a los que se puede subir (más caros que el actual).
  const upgrades = PAID_PLAN_IDS.filter((p) => PLANS[p].priceArs > current.priceArs);

  async function upgrade(target: "pro" | "team") {
    setBusy(target);
    try {
      const { initPoint } = await api.createBillingCheckout(target);
      window.location.assign(initPoint); // → checkout de Mercado Pago
    } catch (e) {
      const code = e instanceof api.ApiError ? e.code : "";
      showToast(
        code === "forbidden"
          ? "Solo el dueño puede cambiar el plan."
          : code === "billing_unavailable"
            ? "El cobro no está disponible en este momento."
            : "No pudimos iniciar el pago. Probá de nuevo.",
        "error",
      );
      setBusy(null);
    }
  }

  return (
    <Card padding={5}>
      <SectionTitle>Plan y facturación</SectionTitle>

      {/* Plan actual */}
      <div style={{ display: "flex", alignItems: "center", gap: space[3], marginTop: space[3] }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            flexShrink: 0,
            background: color.primaryBg,
            color: color.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CreditCard size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
            <span style={{ fontSize: text.md, fontWeight: weight.semibold, color: color.text }}>
              Plan {current.name}
            </span>
            <PlanStatusBadge status={status} />
          </div>
          <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 2 }}>
            {current.priceArs > 0 ? `${formatArs(current.priceArs)}/mes · ` : "Gratis · "}
            {seats >= SEATS_UNLIMITED ? "asientos ilimitados" : `${seats} ${seats === 1 ? "asiento" : "asientos"}`}
          </div>
        </div>
      </div>

      {/* Upgrades — solo el dueño gestiona el plan (billing.manage) */}
      {isOwner && upgrades.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: space[2], marginTop: space[4] }}>
          {upgrades.map((p) => {
            const plan = PLANS[p];
            return (
              <div
                key={p}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: space[3],
                  padding: space[3],
                  borderRadius: radius.md,
                  background: color.surface2,
                  border: `1px solid ${color.border}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>
                    {plan.name} · {formatArs(plan.priceArs)}/mes
                  </div>
                  <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 2 }}>
                    {plan.seats >= SEATS_UNLIMITED ? "Asientos ilimitados" : `${plan.seats} asientos`} · {plan.tagline}
                  </div>
                </div>
                <Button variant="primary" size="sm" loading={busy === p} onClick={() => upgrade(p)}>
                  Mejorar
                </Button>
              </div>
            );
          })}
          <Hint>
            Pago mensual por Mercado Pago · {BILLING_TRIAL_DAYS} días de prueba · cancelás cuando quieras.
          </Hint>
        </div>
      )}

      {isOwner && upgrades.length === 0 && (
        <Hint>Estás en el plan máximo. ¡Gracias por bancar Clozr! 🙌</Hint>
      )}
      {!isOwner && <Hint>Solo el dueño del espacio puede cambiar el plan.</Hint>}
    </Card>
  );
}

function PlanStatusBadge({ status }: { status: string }) {
  const M: Record<string, { tone: "warning" | "danger" | "neutral"; label: string }> = {
    trialing: { tone: "neutral", label: "En prueba" },
    pending: { tone: "neutral", label: "Pendiente" },
    past_due: { tone: "warning", label: "Pago pendiente" },
    cancelled: { tone: "danger", label: "Cancelado" },
  };
  const m = M[status];
  if (!m) return null; // 'active' (u otro) → sin badge
  return (
    <Badge tone={m.tone} variant="soft" size="sm">
      {m.label}
    </Badge>
  );
}

/* ════════════ Tipos de cliente ════════════ */
/* ───────── Plan y suscripción ─────────
 * Lee el plan actual del usuario (lo único que hoy expone el Worker vía /me).
 * El cobro real (Mercado Pago) y el plan/asientos por workspace llegan con el
 * backend de billing (ver clozr-handoff/BACKEND-equipos-spec.md, Tarea 3); por
 * eso el CTA de cambio avisa "próximamente" en vez de iniciar un checkout.
 */
function CustomerTypesCard({ canManage, showToast }: { canManage: boolean; showToast: (m: string, t?: "success" | "error") => void }) {
  const [items, setItems] = useState<CustomerType[]>([]);
  const [name, setName] = useState("");
  const [col, setCol] = useState("#E11D48");
  const load = useCallback(() => {
    api.listCustomerTypes().then(setItems).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    const n = name.trim();
    if (!n) return;
    try {
      await api.createCustomerType({ name: n, color: col });
      setName("");
      load();
    } catch {
      showToast("No se pudo agregar", "error");
    }
  }
  async function remove(t: CustomerType) {
    const ok = await confirmAsync({ message: `¿Eliminar el tipo "${t.name}"?`, tone: "danger", confirmText: "Eliminar" });
    if (!ok) return;
    try {
      await api.deleteCustomerType(t.id);
      load();
    } catch {
      showToast("No se pudo eliminar", "error");
    }
  }

  return (
    <Card padding={5}>
      <SectionTitle>Tipos de cliente</SectionTitle>
      <Hint>Segmentá tu cartera (final, mayorista, etc.). Se usan para precios y filtros.</Hint>
      <div style={{ display: "flex", flexDirection: "column", gap: space[2], marginTop: space[3] }}>
        {items.length === 0 && <Hint>Sin tipos todavía.</Hint>}
        {items.map((t) => (
          <Row key={t.id}>
            <ColorDot color={t.color} />
            <span style={{ flex: 1, fontSize: text.sm, color: color.text }}>{t.name}</span>
            {canManage && <Button variant="ghost" size="sm" iconLeft={<Trash2 size={13} />} onClick={() => remove(t)} />}
          </Row>
        ))}
      </div>
      {canManage && (
        <AddRow value={name} onChange={setName} onAdd={add} placeholder="Ej: Mayorista" color={col} onColor={setCol} />
      )}
    </Card>
  );
}

/* ════════════ Etiquetas de cliente ════════════ */
function CustomerTagsCard({ canManage, showToast }: { canManage: boolean; showToast: (m: string, t?: "success" | "error") => void }) {
  const [items, setItems] = useState<CustomerTag[]>([]);
  const [name, setName] = useState("");
  const [col, setCol] = useState("#3B82F6");
  const load = useCallback(() => {
    api.listCustomerTags().then(setItems).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    const n = name.trim();
    if (!n) return;
    try {
      await api.createCustomerTag({ name: n, color: col });
      setName("");
      load();
    } catch {
      showToast("No se pudo agregar", "error");
    }
  }
  async function remove(t: CustomerTag) {
    const ok = await confirmAsync({ message: `¿Eliminar la etiqueta "${t.name}"?`, tone: "danger", confirmText: "Eliminar" });
    if (!ok) return;
    try {
      await api.deleteCustomerTag(t.id);
      load();
    } catch {
      showToast("No se pudo eliminar", "error");
    }
  }

  return (
    <Card padding={5}>
      <SectionTitle>Etiquetas de cliente</SectionTitle>
      <Hint>Marcas libres (VIP, Deudor…) para clasificar contactos.</Hint>
      <div style={{ display: "flex", flexWrap: "wrap", gap: space[2], marginTop: space[3] }}>
        {items.length === 0 && <Hint>Sin etiquetas todavía.</Hint>}
        {items.map((t) => (
          <span
            key={t.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: `4px ${space[2]} 4px ${space[3]}`,
              background: color.surface2,
              borderRadius: radius.full,
              fontSize: text.sm,
              color: color.text,
            }}
          >
            <ColorDot color={t.color} />
            {t.name}
            {canManage && (
              <button onClick={() => remove(t)} aria-label="Eliminar" style={{ display: "inline-flex", color: color.textDim }}>
                <Trash2 size={12} />
              </button>
            )}
          </span>
        ))}
      </div>
      {canManage && (
        <AddRow value={name} onChange={setName} onAdd={add} placeholder="Ej: VIP" color={col} onColor={setCol} />
      )}
    </Card>
  );
}

/* ════════════ Etapas del pipeline ════════════ */
function StagesCard({ canManage, showToast }: { canManage: boolean; showToast: (m: string, t?: "success" | "error") => void }) {
  const [items, setItems] = useState<PipelineStage[]>([]);
  const [name, setName] = useState("");
  const [col, setCol] = useState("#64748B");
  const load = useCallback(() => {
    api.listStages().then(setItems).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const wonCount = items.filter((s) => s.isWon).length;
  const lostCount = items.filter((s) => s.isLost).length;

  async function add() {
    const n = name.trim();
    if (!n) return;
    try {
      const maxOrder = items.reduce((m, s) => Math.max(m, s.order), 0);
      await api.createStage({ name: n, color: col, order: maxOrder + 1 });
      setName("");
      load();
    } catch {
      showToast("No se pudo agregar", "error");
    }
  }
  async function remove(s: PipelineStage) {
    if (s.isWon && wonCount <= 1) { showToast("Tiene que quedar al menos una etapa de ganada", "error"); return; }
    if (s.isLost && lostCount <= 1) { showToast("Tiene que quedar al menos una etapa de perdida", "error"); return; }
    const ok = await confirmAsync({ message: `¿Eliminar la etapa "${s.name}"?`, tone: "danger", confirmText: "Eliminar" });
    if (!ok) return;
    try {
      await api.deleteStage(s.id);
      load();
    } catch {
      showToast("No se pudo eliminar", "error");
    }
  }

  return (
    <Card padding={5}>
      <SectionTitle>Etapas del pipeline</SectionTitle>
      <Hint>Las columnas de tu embudo. Tiene que haber al menos una ganada y una perdida.</Hint>
      <div style={{ display: "flex", flexDirection: "column", gap: space[2], marginTop: space[3] }}>
        {items.length === 0 && <Hint>Sin etapas todavía.</Hint>}
        {items.map((s) => (
          <Row key={s.id}>
            <ColorDot color={s.color} />
            <span style={{ flex: 1, fontSize: text.sm, color: color.text }}>{s.name}</span>
            {s.isWon && (
              <Badge tone="success" size="sm"><Trophy size={11} style={{ marginRight: 3, display: "inline" }} />Ganada</Badge>
            )}
            {s.isLost && (
              <Badge tone="danger" size="sm"><XCircle size={11} style={{ marginRight: 3, display: "inline" }} />Perdida</Badge>
            )}
            {canManage && <Button variant="ghost" size="sm" iconLeft={<Trash2 size={13} />} onClick={() => remove(s)} />}
          </Row>
        ))}
      </div>
      {canManage && (
        <AddRow value={name} onChange={setName} onAdd={add} placeholder="Ej: Negociación" color={col} onColor={setCol} />
      )}
    </Card>
  );
}

/* ════════════ helpers UI ════════════ */
const selectStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  padding: `0 ${space[3]}`,
  background: color.surface2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  color: color.text,
  fontSize: text.sm,
  outline: "none",
};

function Row({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: space[2],
        padding: `${space[2]} ${space[3]}`,
        background: color.surface2,
        borderRadius: radius.md,
      }}
    >
      {children}
    </div>
  );
}

function AddRow({
  value,
  onChange,
  onAdd,
  placeholder,
  color: col,
  onColor,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
  color?: string;
  onColor?: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: space[2], marginTop: space[3], alignItems: "center" }}>
      {onColor && (
        <input
          type="color"
          value={col}
          onChange={(e) => onColor(e.target.value)}
          aria-label="Color"
          style={{ width: 38, height: 38, padding: 0, border: `1px solid ${color.border}`, borderRadius: radius.md, background: "transparent", cursor: "pointer", flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1 }}>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }} />
      </div>
      <Button variant="secondary" iconLeft={<Plus size={14} />} onClick={onAdd} disabled={!value.trim()}>
        Agregar
      </Button>
    </div>
  );
}

function ColorDot({ color: c }: { color?: string | null }) {
  return (
    <span style={{ width: 12, height: 12, borderRadius: "50%", background: c || color.textDim, flexShrink: 0, display: "inline-block" }} />
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 style={{ margin: 0, fontSize: text.md, fontWeight: weight.semibold, color: color.text }}>{children}</h2>;
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
