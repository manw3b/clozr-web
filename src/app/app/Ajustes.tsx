import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, Trash2, LogOut, Upload, Trophy, XCircle, Check, Zap, Rocket, Sparkles, Gift, Users, Copy } from "lucide-react";
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
import type { PaymentOption, User, CustomerType, CustomerTag, PipelineStage, Origin, AppointmentType } from "@/lib/types";
import { PLANS, PAID_PLAN_IDS, BILLING_TRIAL_DAYS, EXTRA_SEAT_USD, ESPACIO_USD, ANNUAL_MONTHS_PAID, ANNUAL_MONTHS_FREE, formatArs, formatUsd, discountTargetLabel, type PlanId, type PlanInfo } from "@/lib/types";
import { useIsMobile } from "@/lib/useIsMobile";
import { fetchDolares } from "@/lib/dolar";
import { Stepper } from "@/components/Stepper";
import {
  applyTurnoTemplate,
  resolveTurnoTemplate,
  DEFAULT_TURNO_CLIENTE,
  DEFAULT_TURNO_INTERNO,
  TURNO_TEMPLATE_KEYS,
  TURNO_PLACEHOLDER_HELP,
  TURNO_SAMPLE,
} from "@/lib/turnoTemplates";
import {
  parseQuickTemplates,
  serializeQuickTemplates,
  newQuickTemplate,
  QUICK_TEMPLATES_KEY,
  QUICK_PLACEHOLDER_HELP,
  type QuickTemplate,
} from "@/lib/quickTemplates";

/**
 * Vista Ajustes — config del workspace con backend real (worker):
 * espacio (nombre + objetivo diario + logo), métodos de pago, tipos de cliente,
 * etiquetas, etapas del pipeline, y cuenta (nombre editable). Cada bloque pega
 * a su ruta del worker. Diferido (Tauri-only): backup/restore, about/updater.
 */
/** Emojis ofrecidos como miniatura del espacio (F3). */
const WORKSPACE_ICONS = ["🏪", "🛒", "📱", "💻", "👕", "👟", "🍔", "☕", "💈", "💅", "🩺", "🔧", "🚗", "🎮", "📷", "🎁", "💊", "🐶", "✨", "🏠"];

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

  /* ── Espacio: dirección del local (Fase ①, para el mensaje de turno) ── */
  const [address, setAddress] = useState(activeWorkspace?.address ?? "");
  const [savingAddress, setSavingAddress] = useState(false);
  useEffect(() => {
    setAddress(activeWorkspace?.address ?? "");
  }, [activeWorkspace?.id, activeWorkspace?.address]);

  async function saveAddress() {
    const a = address.trim();
    if (a === (activeWorkspace?.address ?? "")) return;
    setSavingAddress(true);
    try {
      await api.updateWorkspace({ address: a || null });
      useWorkspaceStore.setState((s) => ({
        activeWorkspace: s.activeWorkspace ? { ...s.activeWorkspace, address: a || null } : s.activeWorkspace,
      }));
      showToast("Dirección guardada", "success");
    } catch {
      showToast("No se pudo guardar la dirección", "error");
    } finally {
      setSavingAddress(false);
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

  /* ── Espacio: ícono / miniatura (F3) ── */
  async function pickIcon(emoji: string | null) {
    try {
      await api.updateWorkspace({ icon: emoji });
      useWorkspaceStore.setState((s) => ({
        activeWorkspace: s.activeWorkspace ? { ...s.activeWorkspace, icon: emoji } : s.activeWorkspace,
        workspaces: s.workspaces.map((w) => (w.id === s.activeWorkspace?.id ? { ...w, icon: emoji } : w)),
      }));
      showToast(emoji ? "Ícono actualizado" : "Ícono quitado", "success");
    } catch {
      showToast("No se pudo actualizar el ícono", "error");
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
              activeWorkspace?.icon || "🏪"
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

        {/* Miniatura (emoji) — se usa cuando no hay logo */}
        {canManage && (
          <div style={{ marginTop: space[4] }}>
            <Label>Ícono del negocio</Label>
            <Hint>Se usa como miniatura cuando no subís un logo.</Hint>
            <div style={{ display: "flex", flexWrap: "wrap", gap: space[2], marginTop: space[2] }}>
              {WORKSPACE_ICONS.map((emoji) => {
                const active = (activeWorkspace?.icon ?? "") === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => pickIcon(emoji)}
                    style={{
                      width: 36,
                      height: 36,
                      fontSize: 18,
                      lineHeight: 1,
                      borderRadius: radius.md,
                      cursor: "pointer",
                      background: active ? color.primaryBg : color.surface2,
                      border: `1px solid ${active ? color.primary : color.border}`,
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
              {activeWorkspace?.icon && (
                <button
                  type="button"
                  onClick={() => pickIcon(null)}
                  title="Quitar ícono"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.md,
                    cursor: "pointer",
                    background: color.surface2,
                    border: `1px solid ${color.border}`,
                    color: color.textDim,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <XCircle size={16} />
                </button>
              )}
            </div>
          </div>
        )}

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

        {/* Dirección del local (Fase ①) */}
        <div style={{ display: "flex", gap: space[2], alignItems: "flex-end", marginTop: space[4] }}>
          <div style={{ flex: 1 }}>
            <Label>Dirección del local</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: calle 44 e/ 17 y 18 Nº 1136 (Timbre 101)"
              disabled={!canManage}
            />
          </div>
          <Button
            variant="primary"
            onClick={saveAddress}
            loading={savingAddress}
            disabled={!canManage || address.trim() === (activeWorkspace?.address ?? "")}
          >
            Guardar
          </Button>
        </div>
        <Hint>Aparece en el mensaje de turno al cliente ("Estamos en …").</Hint>

        {!canManage && <Hint>Solo el dueño o un encargado pueden editar el espacio.</Hint>}
      </Card>

      {/* Orígenes ("viene de") */}
      <OriginsCard />

      {/* Tipos de turno (editables) — Fase ④ */}
      <AppointmentTypesCard />

      {/* Plantillas de turno (editables por negocio) */}
      <TurnoTemplatesCard />

      {/* Mensajes rápidos de WhatsApp */}
      <QuickTemplatesCard />

      {/* Plan y facturación */}
      <PlanCard />

      {/* Referí y ganá */}
      <ReferralCard />

      {/* Sucursales y espacios adicionales */}
      <EspaciosCard />

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
            <Label>Tu alias</Label>
            <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Cómo te ven en el equipo" />
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
const PLAN_ORDER: PlanId[] = ["free", "pro", "team"];
const TIER_ICON: Record<PlanId, typeof Zap> = { free: Sparkles, pro: Zap, team: Rocket };

function PlanCard() {
  const showToast = useUIStore((s) => s.showToast);
  const ws = useWorkspaceStore((s) => s.activeWorkspace);
  const isMobile = useIsMobile();
  const isOwner = ws?.role === "owner";
  const planId = (ws?.plan as PlanId) ?? "free";
  const current = PLANS[planId] ?? PLANS.free;
  const status = ws?.planStatus ?? "active";
  const currentSeats = ws?.seats ?? current.seats;
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "annual">(
    (ws?.billingInterval as "monthly" | "annual") ?? "monthly",
  );

  // Dólar blue para mostrar el equivalente en ARS (referencia visual; el cobro
  // real lo calcula el Worker server-side con la misma fuente).
  const [blueRate, setBlueRate] = useState<number | null>(null);
  useEffect(() => {
    fetchDolares()
      .then((rates) => {
        const blue = rates.find((r) => r.casa === "blue") ?? rates[0];
        if (blue?.venta) setBlueRate(blue.venta);
      })
      .catch(() => {});
  }, []);

  // El próximo escalón pago: lo destacamos como "Recomendado".
  const recommendedId = PAID_PLAN_IDS.find((p) => PLANS[p].priceUsd > current.priceUsd) ?? null;

  async function upgrade(target: "pro" | "team", extraSeats: number) {
    setBusy(target);
    try {
      const { initPoint } = await api.createBillingCheckout(target, extraSeats, cycle);
      window.location.assign(initPoint); // → checkout de Mercado Pago
    } catch (e) {
      const code = e instanceof api.ApiError ? e.code : "";
      showToast(
        code === "forbidden"
          ? "Solo el dueño puede cambiar el plan."
          : code === "exchange_unavailable"
            ? "No pudimos obtener la cotización del dólar. Probá de nuevo."
            : code === "billing_unavailable"
              ? "El cobro no está disponible en este momento."
              : "No pudimos iniciar el pago. Probá de nuevo.",
        "error",
      );
      setBusy(null);
    }
  }

  // Re-hidrata el workspaceStore con /me (tras cambiar empleados) para que el
  // plan/asientos se reflejen al instante en toda la app.
  async function refreshWs() {
    const me = await api.fetchMe();
    const active = me.workspaces.find((w) => w.id === ws?.id) ?? me.workspaces[0] ?? null;
    useWorkspaceStore.setState({ workspaces: me.workspaces, activeWorkspace: active });
  }

  return (
    <Card padding={5}>
      <SectionTitle>Plan y facturación</SectionTitle>

      {/* Toggle mensual / anual (solo si hay algo para mejorar) */}
      {isOwner && recommendedId && (
        <div style={{ display: "flex", gap: space[2], marginTop: space[3] }}>
          {(["monthly", "annual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              style={{
                flex: 1,
                padding: `${space[2]} ${space[3]}`,
                borderRadius: radius.md,
                background: cycle === c ? color.primaryBg : color.surface2,
                border: `1px solid ${cycle === c ? color.primary : color.border}`,
                color: cycle === c ? color.primary : color.textMuted,
                fontSize: text.sm,
                fontWeight: weight.semibold,
                cursor: "pointer",
              }}
            >
              {c === "monthly" ? "Mensual" : `Anual · ${ANNUAL_MONTHS_FREE} meses gratis`}
            </button>
          ))}
        </div>
      )}

      {/* Tarjetas de planes (Free / Pro / Team) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
          gap: space[3],
          marginTop: space[4],
        }}
      >
        {PLAN_ORDER.map((id) => (
          <PlanTier
            key={id}
            plan={PLANS[id]}
            isCurrent={id === planId}
            isRecommended={id === recommendedId}
            currentPriceUsd={current.priceUsd}
            currentSeats={currentSeats}
            currentStatus={status}
            isOwner={!!isOwner}
            blueRate={blueRate}
            interval={cycle}
            busy={busy === id}
            onUpgrade={(extra) => upgrade(id as "pro" | "team", extra)}
            onSeatsSaved={refreshWs}
          />
        ))}
      </div>

      <div style={{ marginTop: space[3] }}>
        {ws?.discount && (
          <Hint>
            🎟️ Descuento activo: {ws.discount.type === "percent" ? `${ws.discount.value}%` : formatUsd(ws.discount.value)} en{" "}
            {discountTargetLabel(ws.discount.target).toLowerCase()} — se aplica al pagar.
          </Hint>
        )}
        {isOwner && recommendedId && (
          <Hint>Precios en USD, se cobran en ARS al dólar blue · {BILLING_TRIAL_DAYS} días de prueba · cancelás cuando quieras.</Hint>
        )}
        {isOwner && !recommendedId && (
          <Hint>Estás en el plan máximo. ¡Gracias por bancar Clozr! 🙌</Hint>
        )}
        {!isOwner && <Hint>Solo el dueño del espacio puede cambiar el plan.</Hint>}
      </div>

      {isOwner && <RedeemCodeBox wsId={ws?.id} />}
    </Card>
  );
}

/* ───────── Referí y ganá ───────── */
function ReferralCard() {
  const showToast = useUIStore((s) => s.showToast);
  const isOwner = useWorkspaceStore((s) => s.activeWorkspace?.role) === "owner";
  const [data, setData] = useState<{ code: string; discountPct: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    setLoading(true);
    api
      .getReferralCode()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOwner]);

  if (!isOwner) return null;

  function copy() {
    if (!data) return;
    navigator.clipboard.writeText(data.code).then(
      () => showToast("Código copiado", "success"),
      () => showToast("No se pudo copiar", "error"),
    );
  }

  const pct = data?.discountPct ?? 20;

  return (
    <Card padding={5}>
      <SectionTitle>Referí y ganá</SectionTitle>
      <Hint>
        Compartí tu código: cuando un negocio nuevo lo canjea (en Ajustes → "¿Tenés un código?"),
        ustedes dos se llevan <strong style={{ color: color.text }}>{pct}% off</strong> su próximo pago.
      </Hint>
      {data ? (
        <div style={{ display: "flex", gap: space[2], marginTop: space[3], alignItems: "center" }}>
          <div
            style={{
              flex: 1,
              fontFamily: "var(--font-mono)",
              fontSize: text.md,
              fontWeight: weight.bold,
              letterSpacing: 1,
              padding: `${space[2]} ${space[3]}`,
              background: color.surface2,
              border: `1px solid ${color.border}`,
              borderRadius: radius.md,
              color: color.text,
            }}
          >
            {data.code}
          </div>
          <Button variant="secondary" iconLeft={<Copy size={14} />} onClick={copy}>
            Copiar
          </Button>
        </div>
      ) : (
        <div style={{ fontSize: text.sm, color: color.textDim, marginTop: space[3] }}>
          {loading ? "Generando tu código…" : "—"}
        </div>
      )}
    </Card>
  );
}

/* ───────── Sucursales / espacios adicionales ─────────
 * Si el espacio activo tiene un plan pago propio, su dueño puede sumar OTROS
 * espacios suyos (Free) a la misma suscripción por ESPACIO_USD/mes c/u. El
 * espacio cubierto copia el plan y no paga aparte. Si el espacio activo está
 * cubierto por otro, mostramos solo una nota. */
/** Editor de plantillas de turno por negocio (Fase ②). Guarda en workspace_settings. */
function TurnoTemplatesCard() {
  const { showToast } = useUIStore();
  const { can } = usePermissions();
  const canManage = can("settings.manage");
  const [cliente, setCliente] = useState(DEFAULT_TURNO_CLIENTE);
  const [interno, setInterno] = useState(DEFAULT_TURNO_INTERNO);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setCliente(resolveTurnoTemplate("cliente", s));
        setInterno(resolveTurnoTemplate("interno", s));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.setSettings({
        [TURNO_TEMPLATE_KEYS.cliente]: cliente,
        [TURNO_TEMPLATE_KEYS.interno]: interno,
      });
      showToast("Plantillas guardadas", "success");
    } catch {
      showToast("No se pudieron guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding={5}>
      <SectionTitle>Plantillas de turno</SectionTitle>
      <Hint>Editá los mensajes que se generan al crear un turno. Usá las variables entre llaves.</Hint>
      <div style={{ display: "flex", flexWrap: "wrap", gap: space[2], marginTop: space[3] }}>
        {TURNO_PLACEHOLDER_HELP.map((p) => (
          <span
            key={p.token}
            title={p.label}
            style={{
              fontSize: text.xs,
              fontFamily: "monospace",
              padding: `2px ${space[2]}`,
              background: color.surface2,
              border: `1px solid ${color.border}`,
              borderRadius: radius.sm,
              color: color.textMuted,
            }}
          >
            {p.token}
          </span>
        ))}
      </div>

      <TemplateEditor label="Para el cliente" value={cliente} onChange={setCliente} disabled={!canManage} />
      <TemplateEditor label="Interno (anúnciate)" value={interno} onChange={setInterno} disabled={!canManage} />

      {canManage ? (
        <div style={{ display: "flex", gap: space[2], justifyContent: "flex-end", marginTop: space[4] }}>
          <Button
            variant="ghost"
            onClick={() => {
              setCliente(DEFAULT_TURNO_CLIENTE);
              setInterno(DEFAULT_TURNO_INTERNO);
            }}
          >
            Restaurar por defecto
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!loaded}>
            Guardar plantillas
          </Button>
        </div>
      ) : (
        <Hint>Solo el dueño o un encargado pueden editar las plantillas.</Hint>
      )}
    </Card>
  );
}

/** Textarea de plantilla + preview en vivo (con datos de muestra). */
function TemplateEditor({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const isMobile = useIsMobile();
  return (
    <div style={{ marginTop: space[4] }}>
      <Label>{label}</Label>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: space[3] }}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={9}
          style={{
            width: "100%",
            boxSizing: "border-box",
            resize: "vertical",
            padding: space[3],
            background: color.surface,
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            fontSize: text.sm,
            color: color.text,
            fontFamily: "inherit",
            lineHeight: 1.5,
          }}
        />
        <pre
          aria-label="Vista previa"
          style={{
            margin: 0,
            padding: space[3],
            background: color.surface2,
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            fontSize: text.sm,
            color: color.text,
            fontFamily: "inherit",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {applyTurnoTemplate(value, TURNO_SAMPLE)}
        </pre>
      </div>
    </div>
  );
}

/** Biblioteca de mensajes rápidos de WhatsApp, editable por negocio (Fase ③). */
function QuickTemplatesCard() {
  const { showToast } = useUIStore();
  const { can } = usePermissions();
  const canManage = can("settings.manage");
  const [list, setList] = useState<QuickTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => setList(parseQuickTemplates(s)))
      .catch(() => setList(parseQuickTemplates(null)))
      .finally(() => setLoaded(true));
  }, []);

  function update(id: string, patch: Partial<QuickTemplate>) {
    setList((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function save() {
    const clean = list.map((t) => ({ ...t, name: t.name.trim(), body: t.body.trim() })).filter((t) => t.name && t.body);
    setSaving(true);
    try {
      await api.setSettings({ [QUICK_TEMPLATES_KEY]: serializeQuickTemplates(clean) });
      setList(clean);
      showToast("Mensajes rápidos guardados", "success");
    } catch {
      showToast("No se pudieron guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding={5}>
      <SectionTitle>Mensajes rápidos</SectionTitle>
      <Hint>Plantillas para enviar por WhatsApp en un toque desde la ficha del cliente.</Hint>
      <div style={{ display: "flex", flexWrap: "wrap", gap: space[2], marginTop: space[3] }}>
        {QUICK_PLACEHOLDER_HELP.map((p) => (
          <span
            key={p.token}
            title={p.label}
            style={{
              fontSize: text.xs,
              fontFamily: "monospace",
              padding: `2px ${space[2]}`,
              background: color.surface2,
              border: `1px solid ${color.border}`,
              borderRadius: radius.sm,
              color: color.textMuted,
            }}
          >
            {p.token}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: space[3], marginTop: space[4] }}>
        {loaded && list.length === 0 && (
          <div style={{ fontSize: text.sm, color: color.textMuted }}>Sin mensajes todavía. Agregá uno.</div>
        )}
        {list.map((t) => (
          <div key={t.id} style={{ border: `1px solid ${color.border}`, borderRadius: radius.md, padding: space[3] }}>
            <div style={{ display: "flex", gap: space[2], alignItems: "center", marginBottom: space[2] }}>
              <div style={{ flex: 1 }}>
                <Input value={t.name} onChange={(e) => update(t.id, { name: e.target.value })} placeholder="Nombre (ej: Saludo)" disabled={!canManage} />
              </div>
              {canManage && (
                <button
                  onClick={() => setList((prev) => prev.filter((x) => x.id !== t.id))}
                  aria-label="Eliminar"
                  className="btn-icon muted"
                  style={{ width: 30, height: 30, borderRadius: radius.sm, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <textarea
              value={t.body}
              onChange={(e) => update(t.id, { body: e.target.value })}
              disabled={!canManage}
              rows={3}
              placeholder="Hola {nombre}, te escribo de {negocio}…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
                padding: space[3],
                background: color.surface,
                border: `1px solid ${color.border}`,
                borderRadius: radius.md,
                fontSize: text.sm,
                color: color.text,
                fontFamily: "inherit",
                lineHeight: 1.5,
              }}
            />
          </div>
        ))}
      </div>

      {canManage ? (
        <div style={{ display: "flex", gap: space[2], justifyContent: "space-between", marginTop: space[4] }}>
          <Button variant="ghost" iconLeft={<Plus size={15} />} onClick={() => setList((prev) => [...prev, newQuickTemplate()])}>
            Agregar mensaje
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!loaded}>
            Guardar
          </Button>
        </div>
      ) : (
        <Hint>Solo el dueño o un encargado pueden editar los mensajes.</Hint>
      )}
    </Card>
  );
}

/** Orígenes ("viene de") — lista gestionable usada al generar turnos. Fase ①. */
function OriginsCard() {
  const { showToast } = useUIStore();
  const { can } = usePermissions();
  const canManage = can("settings.manage");
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.listOrigins().then(setOrigins).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    const n = name.trim();
    if (!n) return;
    setAdding(true);
    try {
      const o = await api.createOrigin(n);
      setOrigins((prev) =>
        prev.some((x) => x.id === o.id) ? prev : [...prev, o].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setName("");
      showToast("Origen agregado", "success");
    } catch {
      showToast("No se pudo agregar", "error");
    } finally {
      setAdding(false);
    }
  }

  async function remove(o: Origin) {
    const ok = await confirmAsync({
      title: `¿Eliminar "${o.name}"?`,
      message: "Dejará de estar disponible para nuevas ventas.",
      confirmText: "Eliminar",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.deleteOrigin(o.id);
      setOrigins((prev) => prev.filter((x) => x.id !== o.id));
    } catch {
      showToast("No se pudo eliminar", "error");
    }
  }

  return (
    <Card padding={5}>
      <SectionTitle>Orígenes (Viene de)</SectionTitle>
      <Hint>De dónde vienen tus clientes (ej. otra tienda, redes). Lo elegís al generar un turno.</Hint>
      <div style={{ display: "flex", flexDirection: "column", gap: space[2], marginTop: space[4] }}>
        {origins.length === 0 && (
          <div style={{ fontSize: text.sm, color: color.textMuted }}>Todavía no hay orígenes.</div>
        )}
        {origins.map((o) => (
          <div
            key={o.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: `${space[2]} ${space[3]}`,
              background: color.surface2,
              border: `1px solid ${color.border}`,
              borderRadius: radius.md,
            }}
          >
            <span style={{ fontSize: text.sm, color: color.text }}>{o.name}</span>
            {canManage && (
              <button
                onClick={() => void remove(o)}
                aria-label="Eliminar"
                className="btn-icon muted"
                style={{ width: 26, height: 26, borderRadius: radius.sm, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      {canManage && (
        <div style={{ display: "flex", gap: space[2], alignItems: "flex-end", marginTop: space[4] }}>
          <div style={{ flex: 1 }}>
            <Label>Nuevo origen</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: MobileZone"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add();
                }
              }}
            />
          </div>
          <Button variant="primary" iconLeft={<Plus size={15} />} onClick={() => void add()} loading={adding} disabled={!name.trim()}>
            Agregar
          </Button>
        </div>
      )}
    </Card>
  );
}

/** Tipos de turno (Reparación, Plan canje, …) — lista editable. Fase ④. */
function AppointmentTypesCard() {
  const { showToast } = useUIStore();
  const { can } = usePermissions();
  const canManage = can("settings.manage");
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.listAppointmentTypes().then(setTypes).catch(() => {});
  }, []);

  async function add() {
    const n = name.trim();
    if (!n) return;
    setAdding(true);
    try {
      const t = await api.createAppointmentType(n);
      setTypes((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t].sort((a, b) => a.name.localeCompare(b.name))));
      setName("");
      showToast("Tipo agregado", "success");
    } catch {
      showToast("No se pudo agregar", "error");
    } finally {
      setAdding(false);
    }
  }

  async function remove(t: AppointmentType) {
    const ok = await confirmAsync({
      title: `¿Eliminar "${t.name}"?`,
      message: "Dejará de estar disponible para nuevos turnos.",
      confirmText: "Eliminar",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.deleteAppointmentType(t.id);
      setTypes((prev) => prev.filter((x) => x.id !== t.id));
    } catch {
      showToast("No se pudo eliminar", "error");
    }
  }

  return (
    <Card padding={5}>
      <SectionTitle>Tipos de turno</SectionTitle>
      <Hint>Para qué es el turno (ej. Reparación, Plan canje, Venta). Lo elegís al agendar.</Hint>
      <div style={{ display: "flex", flexDirection: "column", gap: space[2], marginTop: space[4] }}>
        {types.length === 0 && <div style={{ fontSize: text.sm, color: color.textMuted }}>Todavía no hay tipos.</div>}
        {types.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${space[2]} ${space[3]}`, background: color.surface2, border: `1px solid ${color.border}`, borderRadius: radius.md }}>
            <span style={{ fontSize: text.sm, color: color.text }}>{t.name}</span>
            {canManage && (
              <button onClick={() => void remove(t)} aria-label="Eliminar" className="btn-icon muted" style={{ width: 26, height: 26, borderRadius: radius.sm, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      {canManage && (
        <div style={{ display: "flex", gap: space[2], alignItems: "flex-end", marginTop: space[4] }}>
          <div style={{ flex: 1 }}>
            <Label>Nuevo tipo</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Reparación" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }} />
          </div>
          <Button variant="primary" iconLeft={<Plus size={15} />} onClick={() => void add()} loading={adding} disabled={!name.trim()}>
            Agregar
          </Button>
        </div>
      )}
    </Card>
  );
}

function EspaciosCard() {
  const showToast = useUIStore((s) => s.showToast);
  const ws = useWorkspaceStore((s) => s.activeWorkspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isOwner = ws?.role === "owner";
  const planId = (ws?.plan as PlanId) ?? "free";
  const isPaid = planId !== "free";
  const isActive = (ws?.planStatus ?? "active") === "active";

  async function refreshWs() {
    const me = await api.fetchMe();
    const a = me.workspaces.find((w) => w.id === ws?.id) ?? me.workspaces[0] ?? null;
    useWorkspaceStore.setState({ workspaces: me.workspaces, activeWorkspace: a });
  }

  async function add(targetId: string) {
    setBusyId(targetId);
    try {
      await api.coverWorkspace(targetId);
      await refreshWs();
      showToast("Espacio sumado a tu plan", "success");
    } catch (e) {
      const code = e instanceof api.ApiError ? e.code : "";
      showToast(
        code === "needs_recheckout"
          ? "Mercado Pago necesita re-autorizar el nuevo monto. Re-suscribite desde el plan para sumar espacios."
          : code === "exchange_unavailable"
            ? "No pudimos obtener la cotización del dólar. Probá de nuevo."
            : code === "plan_not_active" || code === "no_subscription"
              ? "Tu suscripción no está activa."
              : code === "target_is_paid"
                ? "Ese espacio ya tiene su propio plan pago."
                : "No pudimos sumar el espacio.",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(targetId: string, label: string) {
    const ok = await confirmAsync({
      message: `¿Quitar "${label}" de tu plan? Volverá al plan Free.`,
      tone: "danger",
      confirmText: "Quitar",
    });
    if (!ok) return;
    setBusyId(targetId);
    try {
      await api.uncoverWorkspace(targetId);
      await refreshWs();
      showToast("Espacio quitado del plan", "success");
    } catch {
      showToast("No pudimos quitar el espacio.", "error");
    } finally {
      setBusyId(null);
    }
  }

  // Si el espacio activo está cubierto por otro, solo informamos.
  if (ws?.coveredBy) {
    const principal = workspaces.find((w) => w.id === ws.coveredBy);
    return (
      <Card padding={5}>
        <SectionTitle>Sucursales y espacios</SectionTitle>
        <Hint>
          Este espacio está incluido en el plan de{" "}
          <strong style={{ color: color.text }}>{principal?.name ?? "tu espacio principal"}</strong> — no se cobra aparte.
        </Hint>
      </Card>
    );
  }

  // Solo el dueño de un plan pago puede sumar espacios.
  if (!isOwner || !isPaid) return null;

  const others = workspaces.filter((w) => w.id !== ws?.id && w.role === "owner");
  const covered = others.filter((w) => w.coveredBy === ws?.id);
  const addable = others.filter((w) => !w.coveredBy && (((w.plan as PlanId) ?? "free") === "free"));

  return (
    <Card padding={5}>
      <SectionTitle>Sucursales y espacios</SectionTitle>
      <Hint>
        Sumá otras sucursales o espacios tuyos a este plan por{" "}
        <strong style={{ color: color.text }}>{formatUsd(ESPACIO_USD)}/mes</strong> cada uno. Comparten el plan{" "}
        {PLANS[planId].name} y se cobran en la misma suscripción.
      </Hint>

      {covered.length === 0 && addable.length === 0 && (
        <Hint>No tenés otros espacios para sumar. Creá uno desde el selector de espacios, arriba a la izquierda.</Hint>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: space[2], marginTop: space[3] }}>
        {covered.map((w) => (
          <Row key={w.id}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{w.icon || "🏪"}</span>
            <span style={{ flex: 1, fontSize: text.sm, color: color.text }}>{w.name}</span>
            <Badge tone="success" variant="soft" size="sm">Incluido</Badge>
            <Button variant="ghost" size="sm" loading={busyId === w.id} onClick={() => remove(w.id, w.name)}>
              Quitar
            </Button>
          </Row>
        ))}
        {isActive
          ? addable.map((w) => (
              <Row key={w.id}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{w.icon || "🏪"}</span>
                <span style={{ flex: 1, fontSize: text.sm, color: color.text }}>{w.name}</span>
                <Badge tone="neutral" size="sm">Free</Badge>
                <Button variant="secondary" size="sm" loading={busyId === w.id} onClick={() => add(w.id)}>
                  Sumar · +{formatUsd(ESPACIO_USD)}/mes
                </Button>
              </Row>
            ))
          : addable.length > 0 && (
              <Hint>Reactivá tu suscripción para sumar más espacios a este plan.</Hint>
            )}
      </div>
    </Card>
  );
}

/** Una tarjeta de plan en la grilla de pricing. */
function PlanTier({
  plan,
  isCurrent,
  isRecommended,
  currentPriceUsd,
  currentSeats,
  currentStatus,
  isOwner,
  blueRate,
  interval,
  busy,
  onUpgrade,
  onSeatsSaved,
}: {
  plan: PlanInfo;
  isCurrent: boolean;
  isRecommended: boolean;
  currentPriceUsd: number;
  currentSeats: number;
  currentStatus: string;
  isOwner: boolean;
  blueRate: number | null;
  interval: "monthly" | "annual";
  busy: boolean;
  onUpgrade: (extraSeats: number) => void;
  onSeatsSaved: () => Promise<void>;
}) {
  const Icon = TIER_ICON[plan.id];
  const isUpgrade = plan.priceUsd > currentPriceUsd;
  const isLower = plan.priceUsd < currentPriceUsd;
  const accent = isCurrent || isRecommended;
  const canBuy = isUpgrade && isOwner;

  const [extraSeats, setExtraSeats] = useState(0);
  // Precio por período: anual = ×ANNUAL_MONTHS_PAID (2 meses gratis).
  const mult = interval === "annual" ? ANNUAL_MONTHS_PAID : 1;
  const per = interval === "annual" ? "año" : "mes";
  const basePeriodUsd = plan.priceUsd * mult;
  const totalUsd = (plan.priceUsd + extraSeats * EXTRA_SEAT_USD) * mult;
  const arsApprox = (usd: number) => (blueRate ? `≈ ${formatArs(usd * blueRate)}` : null);
  // Desglose de asientos del plan actual (incluidos + extra comprados).
  const currentExtra = Math.max(0, currentSeats - plan.seats);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: space[3],
        padding: space[4],
        borderRadius: radius.lg,
        background: isCurrent ? color.primaryBg : color.surface2,
        border: `1px solid ${accent ? color.primary : color.border}`,
        height: "100%",
      }}
    >
      {/* Cinta "Recomendado" */}
      {isRecommended && !isCurrent && (
        <div style={{ position: "absolute", top: space[3], right: space[3] }}>
          <Badge tone="primary" variant="solid" size="sm">Recomendado</Badge>
        </div>
      )}

      {/* Header: icono + nombre + chip "Tu plan" */}
      <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.md,
            flexShrink: 0,
            background: accent ? color.primary : color.surface,
            color: accent ? "#FFFFFF" : color.textMuted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={16} />
        </div>
        <span style={{ fontSize: text.md, fontWeight: weight.bold, color: color.text }}>{plan.name}</span>
        {isCurrent && <Badge tone="primary" variant="soft" size="sm">Tu plan</Badge>}
      </div>

      {/* Precio */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: text.xl, fontWeight: weight.bold, color: color.text }}>
            {plan.priceUsd > 0 ? formatUsd(basePeriodUsd) : "Gratis"}
          </span>
          {plan.priceUsd > 0 && <span style={{ fontSize: text.xs, color: color.textDim }}>/{per}</span>}
        </div>
        {plan.priceUsd > 0 && arsApprox(basePeriodUsd) && (
          <div style={{ fontSize: text.xs, color: color.textDim }}>{arsApprox(basePeriodUsd)} hoy</div>
        )}
        {plan.priceUsd > 0 && interval === "annual" && (
          <div style={{ fontSize: text.xs, color: color.success, marginTop: 2 }}>{ANNUAL_MONTHS_FREE} meses gratis 🎉</div>
        )}
        <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 2 }}>{plan.tagline}</div>
        {isCurrent && plan.id !== "free" && !isOwner && (
          <div style={{ fontSize: text.xs, color: color.textMuted, marginTop: space[1] }}>
            {currentSeats} empleados{currentExtra > 0 ? ` (${plan.seats} incl. + ${currentExtra} extra)` : ""}
          </div>
        )}
      </div>

      {/* Features */}
      <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
        {plan.features.map((f, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: space[2], fontSize: text.xs, color: color.textMuted }}
          >
            <Check size={14} color={color.success} style={{ flexShrink: 0 }} />
            {f}
          </div>
        ))}
      </div>

      {/* Empleados extra (solo al comprar/upgradear, dueño) */}
      {canBuy && (
        <div style={{ borderTop: `1px solid ${color.border}`, paddingTop: space[3], display: "flex", flexDirection: "column", gap: space[2] }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
            <span style={{ display: "flex", alignItems: "center", gap: space[1], fontSize: text.xs, color: color.textMuted }}>
              <Users size={13} /> Empleados extra
            </span>
            <Stepper value={extraSeats} onChange={setExtraSeats} min={0} max={50} />
          </div>
          <div style={{ fontSize: text.xs, color: color.textDim }}>
            +{formatUsd(EXTRA_SEAT_USD)}/mes c/u · {plan.seats + extraSeats} empleados en total
          </div>
        </div>
      )}

      {/* Gestión de empleados sobre el plan ACTIVO (dueño) */}
      {isCurrent && plan.id !== "free" && isOwner && (
        <CurrentSeatsManager
          baseSeats={plan.seats}
          currentExtra={currentExtra}
          planUsd={plan.priceUsd}
          blueRate={blueRate}
          onSaved={onSeatsSaved}
        />
      )}

      {/* CTA al fondo */}
      <div style={{ marginTop: "auto", paddingTop: space[2] }}>
        {isCurrent ? (
          <>
            <Button variant="secondary" size="sm" fullWidth disabled>
              Plan actual
            </Button>
            {currentStatus !== "active" && (
              <div style={{ marginTop: space[2], display: "flex", justifyContent: "center" }}>
                <PlanStatusBadge status={currentStatus} />
              </div>
            )}
          </>
        ) : canBuy ? (
          <>
            <Button variant="primary" size="sm" fullWidth loading={busy} onClick={() => onUpgrade(extraSeats)}>
              Mejorar{extraSeats > 0 ? ` — ${formatUsd(totalUsd)}/${per}` : ""}
            </Button>
            {extraSeats > 0 && arsApprox(totalUsd) && (
              <div style={{ fontSize: text.xs, color: color.textDim, marginTop: space[1], textAlign: "center" }}>
                {arsApprox(totalUsd)} hoy
              </div>
            )}
          </>
        ) : isLower ? (
          <Button variant="ghost" size="sm" fullWidth disabled>
            Incluido
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Editor de empleados extra sobre un plan ACTIVO (F2). Cambia el monto en MP
 *  vía el endpoint y refresca el store. Si MP pide re-autorización, avisa. */
function CurrentSeatsManager({
  baseSeats,
  currentExtra,
  planUsd,
  blueRate,
  onSaved,
}: {
  baseSeats: number;
  currentExtra: number;
  planUsd: number;
  blueRate: number | null;
  onSaved: () => Promise<void>;
}) {
  const showToast = useUIStore((s) => s.showToast);
  const [extra, setExtra] = useState(currentExtra);
  const [busy, setBusy] = useState(false);
  const changed = extra !== currentExtra;
  const totalUsd = planUsd + extra * EXTRA_SEAT_USD;
  const arsApprox = blueRate ? `≈ ${formatArs(totalUsd * blueRate)}` : null;

  async function save() {
    setBusy(true);
    try {
      await api.updateSeats(extra);
      await onSaved();
      showToast("Empleados actualizados", "success");
    } catch (e) {
      const code = e instanceof api.ApiError ? e.code : "";
      showToast(
        code === "needs_recheckout"
          ? "Mercado Pago necesita re-autorizar el nuevo monto. Por ahora cambialo re-suscribiéndote desde el plan."
          : code === "exchange_unavailable"
            ? "No pudimos obtener la cotización del dólar. Probá de nuevo."
            : code === "plan_not_active" || code === "no_subscription"
              ? "Tu suscripción no está activa."
              : "No pudimos actualizar los empleados.",
        "error",
      );
      setExtra(currentExtra); // revertir el stepper al valor real
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: `1px solid ${color.border}`, paddingTop: space[3], display: "flex", flexDirection: "column", gap: space[2] }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
        <span style={{ display: "flex", alignItems: "center", gap: space[1], fontSize: text.xs, color: color.textMuted }}>
          <Users size={13} /> Empleados extra
        </span>
        <Stepper value={extra} onChange={setExtra} min={0} max={50} />
      </div>
      <div style={{ fontSize: text.xs, color: color.textDim }}>
        {baseSeats + extra} empleados en total · {formatUsd(totalUsd)}/mes{arsApprox ? ` · ${arsApprox}` : ""}
      </div>
      {changed && (
        <Button variant="secondary" size="sm" fullWidth loading={busy} onClick={save}>
          Actualizar empleados
        </Button>
      )}
    </div>
  );
}

/* ───────── Canje de código (Consola Clozr) ─────────
 * El dueño canjea un código de licencia (activa un plan gratis) o de descuento.
 * Tras una licencia, re-hidratamos el workspaceStore con /me para reflejar el
 * plan nuevo al instante. */
function RedeemCodeBox({ wsId }: { wsId?: string }) {
  const showToast = useUIStore((s) => s.showToast);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  function redeemErr(e: unknown): string {
    const c = e instanceof api.ApiError ? e.code : "";
    const M: Record<string, string> = {
      code_not_found: "Ese código no existe.",
      code_disabled: "Ese código está deshabilitado.",
      code_expired: "Ese código venció.",
      code_exhausted: "Ese código alcanzó su límite de usos.",
      forbidden: "Solo el dueño puede canjear códigos.",
      missing_code: "Ingresá un código.",
    };
    return M[c] ?? "No se pudo canjear el código.";
  }

  async function redeem() {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    try {
      const r = await api.redeemCode(c);
      if (r.kind === "license" || r.kind === "unlock") {
        // Re-hidratar el store para reflejar plan/catálogo sin recargar.
        const me = await api.fetchMe();
        const active = me.workspaces.find((w) => w.id === wsId) ?? me.workspaces[0] ?? null;
        useWorkspaceStore.setState({ workspaces: me.workspaces, activeWorkspace: active });
        showToast(
          r.kind === "license" ? "¡Código canjeado! Tu plan fue activado." : "¡Catálogo desbloqueado!",
          "success",
        );
      } else {
        const label =
          r.discountType === "percent" ? `${r.discountValue}%` : formatArs(r.discountValue ?? 0);
        showToast(`Descuento válido (${label}). Se aplicará al mejorar tu plan.`, "success");
      }
      setCode("");
    } catch (e) {
      showToast(redeemErr(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: space[4], paddingTop: space[4], borderTop: `1px solid ${color.border}` }}>
      <div style={{ fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, marginBottom: space[2], display: "flex", alignItems: "center", gap: space[1] }}>
        <Gift size={13} /> ¿Tenés un código?
      </div>
      <div style={{ display: "flex", gap: space[2] }}>
        <div style={{ flex: 1 }}>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                redeem();
              }
            }}
            placeholder="CLOZR-XXXX-XXXX"
            disabled={busy}
          />
        </div>
        <Button variant="secondary" loading={busy} disabled={busy || !code.trim()} onClick={redeem}>
          Canjear
        </Button>
      </div>
    </div>
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
