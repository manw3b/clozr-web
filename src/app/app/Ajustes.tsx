import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, Trash2, LogOut, Upload, Trophy, XCircle, Check, Zap, Rocket, Sparkles, Gift, Users } from "lucide-react";
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
import { PLANS, PAID_PLAN_IDS, BILLING_TRIAL_DAYS, EXTRA_SEAT_USD, ANNUAL_MONTHS_PAID, ANNUAL_MONTHS_FREE, formatArs, formatUsd, discountTargetLabel, type PlanId, type PlanInfo } from "@/lib/types";
import { useIsMobile } from "@/lib/useIsMobile";
import { fetchDolares } from "@/lib/dolar";
import { Stepper } from "@/components/Stepper";

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
