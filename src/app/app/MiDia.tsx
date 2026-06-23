"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  CheckSquare,
  ShoppingCart,
  AlertCircle,
  Check,
  Target,
  Pencil,
  X,
  Zap,
  UserMinus,
  Phone,
  Star,
  Flame,
} from "lucide-react";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { SectionCard, SectionRow } from "@/components/SectionCard";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useUIStore } from "@/store/uiStore";
import { usePermissions } from "@/store/usePermissions";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useBlueRate } from "@/store/dollarStore";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney, dualMoney, greetByHour, greetText, formatDateLong, toLocalISODate, displayName } from "@/lib/format";
import { openWhatsApp, openTel } from "@/lib/openExternal";
import * as api from "@/lib/api";
import type { CashMovement, Customer, Followup, Sale, Task, User } from "@/lib/types";
import { ClozrToday } from "./ClozrToday";

/**
 * Vista Mi Día (v2) — home/agregador. Hero con saludo + objetivo del día
 * (barra de progreso editable) + anillo de score, y bloques: Tareas,
 * Seguimientos (followups), Ventas de hoy, Cobros pendientes, Clientes en
 * riesgo (inactivos por último contacto). Todo client-side sobre endpoints
 * existentes (sin cambios de backend).
 */
export function MiDia({
  user,
  onNavigate,
  onNewSale,
}: {
  user: User;
  onNavigate: (view: string) => void;
  onNewSale: () => void;
}) {
  const { showToast } = useUIStore();
  const { can } = usePermissions();
  const canSell = can("sales.write");
  const canTasks = can("tasks.write");
  const canManageSettings = can("settings.manage");
  const canContact = can("customers.write");
  const activeWs = useWorkspaceStore((s) => s.activeWorkspace);
  const blue = useBlueRate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lastContact, setLastContact] = useState<Record<string, string>>({});
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [scoreOpen, setScoreOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.listTasks(),
      api.listSales(),
      api.listFollowups().catch(() => [] as Followup[]),
      api.listCustomers().catch(() => [] as Customer[]),
      api.getLastContactByCustomer().catch(() => ({}) as Record<string, string>),
      api.listCashMovements().catch(() => [] as CashMovement[]),
    ])
      .then(([t, s, f, c, lc, cm]) => {
        setTasks(t);
        setSales(s);
        setFollowups(f);
        setCustomers(c);
        setLastContact(lc);
        setCashMovements(cm);
      })
      .catch(() => showToast("No se pudo cargar Mi Día", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const now = new Date();
  const nowMs = now.getTime();
  const greeting = greetText(greetByHour(now.getHours()));
  const todayKey = toLocalISODate(now);
  const userName = displayName(user);

  const pendingTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const todaySales = useMemo(
    () =>
      sales.filter((s) => {
        const d = s.createdAt ?? s.saleDate;
        return d ? toLocalISODate(new Date(d)) === todayKey : false;
      }),
    [sales, todayKey],
  );
  const collections = useMemo(() => sales.filter((s) => !s.isPaid && s.balance > 0), [sales]);
  const todayTotal = todaySales.reduce((s, v) => s + v.total, 0);
  const porCobrar = collections.reduce((s, v) => s + v.balance, 0);

  /* ── Objetivo del día ── */
  const dailyGoal = activeWs?.dailyGoal ?? 0;
  const goalProgress = dailyGoal > 0 ? Math.min(100, (todayTotal / dailyGoal) * 100) : 0;
  const goalRemaining = Math.max(0, dailyGoal - todayTotal);

  /* ── Score del día (4 criterios × 25) ── */
  const score = useMemo(() => {
    let s = 0;
    if (todaySales.length >= 1) s += 25;
    const routines = tasks.filter((t) => t.type === "rutina");
    if (routines.length === 0 || routines.every((t) => t.completed)) s += 25;
    if (cashMovements.some((m) => m.movedAt && toLocalISODate(new Date(m.movedAt)) === todayKey)) s += 25;
    if (followups.some((f) => f.completedAt && toLocalISODate(new Date(f.completedAt)) === todayKey)) s += 25;
    return s;
  }, [todaySales, tasks, cashMovements, followups, todayKey]);

  /* ── Seguimientos pendientes (no completados) ── */
  const pendingFollowups = useMemo(
    () =>
      followups
        .filter((f) => !f.completedAt)
        .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "")),
    [followups],
  );

  /* ── Clientes en riesgo (sin contacto hace >= 60 días) ── */
  const inactiveClients = useMemo(() => {
    const THRESHOLD = 60;
    const agg = new Map<string, { count: number; lifetime: number }>();
    for (const s of sales) {
      if (!s.customerId) continue;
      const cur = agg.get(s.customerId) ?? { count: 0, lifetime: 0 };
      cur.count += 1;
      cur.lifetime += s.total;
      agg.set(s.customerId, cur);
    }
    return customers
      .map((c) => {
        const ref = lastContact[c.id] ?? c.createdAt ?? null;
        const days = ref ? Math.floor((nowMs - new Date(ref).getTime()) / 86_400_000) : null;
        const a = agg.get(c.id) ?? { count: 0, lifetime: 0 };
        return { customer: c, days, purchases: a.count, lifetime: a.lifetime };
      })
      .filter((x): x is { customer: Customer; days: number; purchases: number; lifetime: number } =>
        x.days != null && x.days >= THRESHOLD,
      )
      .sort((a, b) => b.days - a.days)
      .slice(0, 5);
  }, [customers, lastContact, sales, nowMs]);

  /* ── acciones ── */
  async function toggleTask(t: Task) {
    const next = !t.completed;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: next } : x)));
    try {
      await api.setTaskCompleted(t.id, next);
    } catch {
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: !next } : x)));
      showToast("No se pudo actualizar", "error");
    }
  }

  async function completeFollow(f: Followup) {
    setFollowups((prev) =>
      prev.map((x) => (x.id === f.id ? { ...x, completedAt: new Date().toISOString() } : x)),
    );
    try {
      await api.completeFollowup(f.id, true);
      showToast("Seguimiento completado", "success");
    } catch {
      setFollowups((prev) => prev.map((x) => (x.id === f.id ? { ...x, completedAt: null } : x)));
      showToast("No se pudo completar", "error");
    }
  }

  function contact(customer: Customer, kind: "whatsapp" | "call") {
    if (!customer.phone) return;
    if (kind === "whatsapp") openWhatsApp(customer.phone);
    else openTel(customer.phone);
    // Registramos el contacto (best-effort) y lo sacamos de inactivos en local.
    setLastContact((prev) => ({ ...prev, [customer.id]: new Date().toISOString() }));
    api.recordContact(customer.id, kind).catch(() => {});
  }

  async function applyGoal(amount: number) {
    if (!activeWs) return;
    const wid = activeWs.id;
    const prev = activeWs.dailyGoal ?? 0;
    const setGoal = (val: number) =>
      useWorkspaceStore.setState((st) => ({
        activeWorkspace: st.activeWorkspace
          ? { ...st.activeWorkspace, dailyGoal: val }
          : st.activeWorkspace,
        workspaces: st.workspaces.map((w) => (w.id === wid ? { ...w, dailyGoal: val } : w)),
      }));
    setGoal(amount); // optimista
    try {
      await api.updateWorkspace({ dailyGoal: amount, dailyGoalCurrency: "ARS" });
      showToast("Objetivo guardado", "success");
    } catch {
      setGoal(prev); // revertir si falla
      showToast("No se pudo guardar el objetivo", "error");
    }
  }

  async function saveGoal() {
    setGoalEditing(false);
    await applyGoal(Math.max(0, Number(goalInput) || 0));
  }

  function startEditGoal() {
    setGoalInput(dailyGoal > 0 ? String(dailyGoal) : "");
    setGoalEditing(true);
  }

  /* ── Moneda dual: US$ primario, $ARS secundario (helper compartido). ── */
  const dual = (ars: number) => dualMoney(ars, blue);

  /* ── Ventas por día → comparativa vs ayer + sparkline 7d + promedio. ── */
  const dailyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sales) {
      const dt = s.createdAt ?? s.saleDate;
      if (!dt) continue;
      const k = toLocalISODate(new Date(dt));
      m.set(k, (m.get(k) ?? 0) + s.total);
    }
    return m;
  }, [sales]);
  const last7 = useMemo(
    () => Array.from({ length: 7 }, (_, i) => dailyMap.get(toLocalISODate(new Date(nowMs - (6 - i) * 86_400_000))) ?? 0),
    [dailyMap, nowMs],
  );
  const yesterdayTotal = last7[5] ?? 0;
  const vsYesterday = yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : null;

  /* ── Racha de días cumpliendo el objetivo (no penaliza el día en curso). ── */
  const streak = useMemo(() => {
    if (dailyGoal <= 0) return 0;
    let n = 0;
    const start = (dailyMap.get(todayKey) ?? 0) >= dailyGoal ? 0 : 1;
    for (let i = start; i < 366; i++) {
      if ((dailyMap.get(toLocalISODate(new Date(nowMs - i * 86_400_000))) ?? 0) >= dailyGoal) n++;
      else break;
    }
    return n;
  }, [dailyMap, dailyGoal, todayKey, nowMs]);

  /* ── Proyección del mes (a este ritmo). ── */
  const monthProj = useMemo(() => {
    const ym = todayKey.slice(0, 7);
    let mtd = 0;
    for (const [k, v] of dailyMap) if (k.slice(0, 7) === ym) mtd += v;
    const dom = now.getDate();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return dom > 0 ? (mtd / dom) * dim : 0;
  }, [dailyMap, todayKey, now]);

  /* ── Objetivo sugerido (si no hay uno): promedio reciente, redondeado lindo. ── */
  const suggestedGoal = useMemo(() => {
    const nonZero = last7.filter((v) => v > 0);
    const base = nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : Math.max(...last7, 0);
    if (base <= 0) return 0;
    if (blue && blue > 0) return Math.max(1, Math.round(base / blue / 10) * 10) * blue; // redondeo en US$
    return Math.max(1000, Math.round(base / 1000) * 1000);
  }, [last7, blue]);

  /* ── Foco del día: la acción más importante de hoy. ── */
  const foco = useMemo(() => {
    const topCol = collections.slice().sort((a, b) => b.balance - a.balance)[0];
    if (topCol) return { icon: "💰", text: `Cobrá ${dual(topCol.balance).main} a ${topCol.customerName || "un cliente"}`, cta: "Ver deudas", to: "deudas" };
    if (pendingFollowups[0]) return { icon: "⚡", text: `Seguí a ${pendingFollowups[0].customerName || "un lead"}`, cta: "Ir al pipeline", to: "pipeline" };
    if (pendingTasks[0]) return { icon: "✅", text: `Tarea pendiente: ${pendingTasks[0].title}`, cta: "Ver tareas", to: "tasks" };
    if (inactiveClients[0]) return { icon: "🕓", text: `Reactivá a ${inactiveClients[0].customer.name} (sin contacto hace ${inactiveClients[0].days} días)`, cta: "Ver clientes", to: "customers" };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, pendingFollowups, pendingTasks, inactiveClients, blue]);

  /* ── Checklist del score (los 4 criterios). ── */
  const routinesAll = tasks.filter((t) => t.type === "rutina");
  const scoreItems = [
    { label: "Registrá una venta", done: todaySales.length >= 1 },
    { label: "Completá tus rutinas", done: routinesAll.length === 0 || routinesAll.every((t) => t.completed) },
    { label: "Registrá un movimiento de caja", done: cashMovements.some((m) => m.movedAt && toLocalISODate(new Date(m.movedAt)) === todayKey) },
    { label: "Completá un seguimiento", done: followups.some((f) => f.completedAt && toLocalISODate(new Date(f.completedAt)) === todayKey) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5] }}>
      <ClozrToday
        stats={{
          followups: pendingFollowups.length,
          collections: collections.length,
          collectionsAmount: collections.reduce((a, s) => a + s.balance, 0),
          inactive: inactiveClients.length,
          tasks: pendingTasks.length,
          todaySales: todaySales.length,
        }}
        candidates={inactiveClients.map((x) => x.customer.name).slice(0, 4)}
        onNavigate={onNavigate}
      />

      {/* HERO */}
      <div
        className="cz-hero"
        style={{
          gap: space[6],
          alignItems: "center",
          background: `linear-gradient(135deg, ${color.surface} 0%, ${color.surface2} 100%)`,
          border: `1px solid ${color.border}`,
          borderRadius: radius.xl,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color.primary} 0%, transparent 70%)`,
            opacity: 0.15,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: space[3], marginBottom: space[2] }}>
            {activeWs?.logoKey && (
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  overflow: "hidden",
                  background: color.surface2,
                  border: `1px solid ${color.border}`,
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={api.assetUrl(activeWs.logoKey)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </span>
            )}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              {activeWs?.name && (
                <span
                  style={{
                    fontSize: text.sm,
                    fontWeight: weight.bold,
                    color: color.text,
                    lineHeight: 1.1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {activeWs.name}
                </span>
              )}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: weight.semibold,
                  color: color.textDim,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  marginTop: 2,
                }}
              >
                {formatDateLong(now.toISOString())}
              </span>
            </div>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: text["3xl"],
              fontWeight: weight.bold,
              color: color.text,
              letterSpacing: "-0.8px",
              lineHeight: 1.1,
              marginBottom: space[4],
            }}
          >
            {greeting}, {userName}
          </h1>

          <CoachCard score={score} scoreItems={scoreItems} streak={streak} dailyMap={dailyMap} todayKey={todayKey} nowMs={nowMs} />

          {/* OBJETIVO */}
          <div style={{ maxWidth: 460, marginBottom: space[4] }}>
            {goalEditing ? (
              <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                <Target size={16} color={color.primary} />
                <input
                  autoFocus
                  type="number"
                  min="0"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveGoal();
                    if (e.key === "Escape") setGoalEditing(false);
                  }}
                  placeholder="Objetivo de facturación del día"
                  style={{
                    flex: 1,
                    height: 34,
                    borderRadius: radius.md,
                    border: `1px solid ${color.border}`,
                    background: color.surface,
                    color: color.text,
                    padding: `0 ${space[3]}`,
                    fontSize: text.sm,
                    outline: "none",
                  }}
                />
                <button
                  onClick={saveGoal}
                  className="btn-icon primary"
                  aria-label="Guardar objetivo"
                  style={{ width: 30, height: 30, borderRadius: radius.sm }}
                >
                  <Check size={15} strokeWidth={2.6} />
                </button>
                <button
                  onClick={() => setGoalEditing(false)}
                  className="btn-icon muted"
                  aria-label="Cancelar"
                  style={{ width: 30, height: 30, borderRadius: radius.sm }}
                >
                  <X size={15} strokeWidth={2.4} />
                </button>
              </div>
            ) : dailyGoal > 0 ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: 6 }}>
                  <span style={{ fontSize: text.xs, color: color.textMuted, fontWeight: weight.semibold, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    Objetivo del día
                  </span>
                  {canManageSettings && (
                    <button
                      onClick={startEditGoal}
                      aria-label="Editar objetivo"
                      style={{ background: "transparent", color: color.textDim, cursor: "pointer", display: "inline-flex", padding: 2 }}
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  {streak >= 2 && (
                    <span style={{ fontSize: text.xs, fontWeight: weight.bold, color: color.primary, background: color.primaryBg, padding: "1px 7px", borderRadius: 999 }}>
                      🔥 {streak} días
                    </span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: text.sm, fontWeight: weight.semibold, color: goalProgress >= 100 ? color.success : color.text }}>
                    {goalProgress.toFixed(0)}%
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: space[2], marginBottom: 2, flexWrap: "wrap" }}>
                  <span style={{ fontSize: text["2xl"], fontWeight: weight.bold, color: color.text, letterSpacing: "-0.5px", lineHeight: 1 }}>
                    {dual(todayTotal).main}
                  </span>
                  <span style={{ fontSize: text.sm, color: color.textMuted, fontWeight: weight.medium }}>
                    de {dual(dailyGoal).main}
                  </span>
                </div>
                {dual(todayTotal).sub && (
                  <div style={{ fontSize: text.xs, color: color.textDim, marginBottom: 6 }}>
                    {dual(todayTotal).sub} de {dual(dailyGoal).sub}
                  </div>
                )}
                <ProgressBar pct={goalProgress} />
                <div style={{ marginTop: 6, fontSize: text.xs, color: goalProgress >= 100 ? color.success : color.textMuted }}>
                  {goalProgress >= 100
                    ? "¡Objetivo cumplido! 🎯"
                    : `Faltan ${dual(goalRemaining).main} para el objetivo`}
                  {monthProj > 0 && (
                    <span style={{ color: color.textDim }}> · a este ritmo: {dual(monthProj).main} este mes</span>
                  )}
                </div>
              </div>
            ) : canManageSettings ? (
              suggestedGoal > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: space[3], padding: `${space[2]} ${space[3]}`, background: color.primaryBg, border: `1px dashed ${color.primary}`, borderRadius: radius.md, flexWrap: "wrap" }}>
                  <Target size={16} color={color.primary} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: text.sm, color: color.text, fontWeight: weight.medium }}>
                      Objetivo sugerido: <strong>{dual(suggestedGoal).main}</strong>
                    </span>
                    <span style={{ fontSize: text.xs, color: color.textDim }}> /día · tu promedio</span>
                  </div>
                  <Button variant="primary" size="sm" onClick={() => applyGoal(Math.round(suggestedGoal))}>Usar</Button>
                  <Button variant="ghost" size="sm" onClick={startEditGoal}>Otro</Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" iconLeft={<Target size={14} />} onClick={startEditGoal}>
                  Configurar objetivo del día
                </Button>
              )
            ) : null}
          </div>

          {/* COMPARATIVA + TENDENCIA 7 DÍAS */}
          <div style={{ display: "flex", alignItems: "center", gap: space[3], marginBottom: space[4], maxWidth: 460, flexWrap: "wrap" }}>
            {vsYesterday != null && (
              <span style={{ fontSize: text.xs, color: color.textMuted }}>
                Hoy vs ayer{" "}
                <strong style={{ color: vsYesterday >= 0 ? color.success : color.danger }}>
                  {vsYesterday >= 0 ? "+" : ""}
                  {vsYesterday.toFixed(0)}%
                </strong>
              </span>
            )}
            <div style={{ flex: 1, minWidth: 120 }}>
              <Sparkline data={last7} />
            </div>
            <span style={{ fontSize: 10, color: color.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>7 días</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: space[6], flexWrap: "wrap", width: "100%", maxWidth: 460 }}>
            <HeroStat label="Ventas de hoy" value={dual(todayTotal).main} hint={`${todaySales.length} ${todaySales.length === 1 ? "venta" : "ventas"}`} sub={dual(todayTotal).sub} />
            <HeroStat
              label="Por cobrar"
              value={dual(porCobrar).main}
              sub={porCobrar > 0 ? dual(porCobrar).sub : null}
              tone={porCobrar > 0 ? "warning" : "neutral"}
            />
            <HeroStat label="Tareas pendientes" value={`${pendingTasks.length}`} />
          </div>

          {/* FOCO DEL DÍA — la acción más importante de hoy */}
          {foco && (
            <button
              onClick={() => onNavigate(foco.to)}
              style={{
                marginTop: space[4],
                width: "100%",
                maxWidth: 460,
                display: "flex",
                alignItems: "center",
                gap: space[3],
                padding: space[3],
                background: color.surface2,
                border: `1px solid ${color.border}`,
                borderRadius: radius.md,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{foco.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: weight.semibold, color: color.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Foco del día
                </div>
                <div style={{ fontSize: text.sm, color: color.text, fontWeight: weight.medium, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {foco.text}
                </div>
              </div>
              <span style={{ fontSize: text.xs, color: color.primary, fontWeight: weight.semibold, flexShrink: 0 }}>{foco.cta} →</span>
            </button>
          )}
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: space[4],
          }}
        >
          <button
            onClick={() => setScoreOpen((v) => !v)}
            title="Ver cómo subir tu score"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          >
            <ScoreRing score={score} />
          </button>
          {scoreOpen && (
            <div
              style={{
                width: 210,
                background: color.surface,
                border: `1px solid ${color.borderStrong}`,
                borderRadius: radius.md,
                padding: space[3],
                display: "flex",
                flexDirection: "column",
                gap: space[2],
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div style={{ fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted }}>Cómo subir tu score</div>
              {scoreItems.map((it) => (
                <div key={it.label} style={{ display: "flex", alignItems: "center", gap: space[2], fontSize: text.xs, color: it.done ? color.textDim : color.text }}>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 5,
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: it.done ? color.success : "transparent",
                      border: `1.5px solid ${it.done ? color.success : color.borderStrong}`,
                    }}
                  >
                    {it.done && <Check size={11} color="#fff" strokeWidth={3} />}
                  </span>
                  <span style={{ textDecoration: it.done ? "line-through" : "none" }}>{it.label}</span>
                </div>
              ))}
            </div>
          )}
          {canSell && (
            <Button variant="primary" size="lg" iconLeft={<Plus size={18} />} onClick={onNewSale}>
              Nueva venta
            </Button>
          )}
        </div>
      </div>

      {/* GRID */}
      <div className="cz-two-col">
        {/* IZQUIERDA — Tareas + Seguimientos */}
        <div style={{ display: "flex", flexDirection: "column", gap: space[5], minWidth: 0 }}>
          <SectionCard
            title="Tareas de hoy"
            count={pendingTasks.length}
            countTone={pendingTasks.length > 0 ? "primary" : "neutral"}
            icon={<CheckSquare size={16} />}
            iconTone="primary"
            onViewAll={() => onNavigate("tasks")}
          >
            {loading ? (
              <Empty text="Cargando…" />
            ) : pendingTasks.length === 0 ? (
              <Empty text="Sin tareas pendientes 🎉" />
            ) : (
              pendingTasks.slice(0, 6).map((t, i, arr) => (
                <SectionRow key={t.id} isLast={i === arr.length - 1}>
                  <button
                    disabled={!canTasks}
                    onClick={() => { if (canTasks) toggleTask(t); }}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      border: `1.5px solid ${color.borderStrong}`,
                      background: "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: canTasks ? "pointer" : "default",
                      flexShrink: 0,
                    }}
                    aria-label="Completar"
                  >
                    <Check size={12} color={color.textDim} strokeWidth={3} style={{ opacity: 0 }} />
                  </button>
                  <span style={{ flex: 1, fontSize: text.sm, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.title}
                  </span>
                  {t.templateId === "ai-triage" && (
                    <Badge tone="primary" variant="soft" size="sm">
                      Sugerido
                    </Badge>
                  )}
                </SectionRow>
              ))
            )}
          </SectionCard>

          <SectionCard
            title="Seguimientos"
            count={pendingFollowups.length}
            countTone={pendingFollowups.length > 0 ? "primary" : "neutral"}
            icon={<Zap size={16} />}
            iconTone="primary"
            subtitle="Leads que requieren acción"
          >
            {loading ? (
              <Empty text="Cargando…" />
            ) : pendingFollowups.length === 0 ? (
              <Empty text="Sin seguimientos pendientes" />
            ) : (
              pendingFollowups.slice(0, 6).map((f, i, arr) => {
                const cust = f.customerId ? customers.find((c) => c.id === f.customerId) : undefined;
                const overdue = !!f.dueAt && f.dueAt.slice(0, 10) < todayKey;
                return (
                  <SectionRow key={f.id} isLast={i === arr.length - 1}>
                    <button
                      disabled={!canTasks}
                      onClick={() => { if (canTasks) completeFollow(f); }}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        border: `1.5px solid ${color.borderStrong}`,
                        background: "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: canTasks ? "pointer" : "default",
                        flexShrink: 0,
                      }}
                      aria-label="Completar seguimiento"
                    >
                      <Check size={12} color={color.textDim} strokeWidth={3} style={{ opacity: 0 }} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: text.sm, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.customerName || cust?.name || "Seguimiento"}
                      </div>
                      <div style={{ fontSize: text.xs, color: overdue ? color.warning : color.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                        {overdue ? "Vencido · " : ""}
                        {f.text || f.reason || ""}
                      </div>
                    </div>
                    {canContact && (cust?.phone || undefined) && (
                      <RowIconBtn
                        variant="wa"
                        label="WhatsApp"
                        onClick={() => cust && contact(cust, "whatsapp")}
                      >
                        <WhatsAppIcon size={13} />
                      </RowIconBtn>
                    )}
                  </SectionRow>
                );
              })
            )}
          </SectionCard>
        </div>

        {/* DERECHA — Ventas + Cobros + Inactivos */}
        <div style={{ display: "flex", flexDirection: "column", gap: space[5], minWidth: 0 }}>
          <SectionCard
            title="Ventas de hoy"
            count={todaySales.length}
            icon={<ShoppingCart size={16} />}
            iconTone="success"
            subtitle={todaySales.length > 0 ? formatMoney(todayTotal) : undefined}
            onViewAll={() => onNavigate("sales")}
          >
            {loading ? (
              <Empty text="Cargando…" />
            ) : todaySales.length === 0 ? (
              <div style={{ padding: space[5], textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: text.sm, color: color.textMuted, marginBottom: space[3] }}>
                  Todavía no vendiste hoy.
                </p>
                {canSell && (
                  <Button variant="secondary" size="sm" iconLeft={<Plus size={14} />} onClick={onNewSale}>
                    Registrar venta
                  </Button>
                )}
              </div>
            ) : (
              todaySales.slice(0, 5).map((s, i, arr) => (
                <SectionRow key={s.id} isLast={i === arr.length - 1} onClick={() => onNavigate("sales")}>
                  <Avatar name={s.customerName || "Sin cliente"} size={28} />
                  <span style={{ flex: 1, fontSize: text.sm, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.customerName || "Sin cliente"}
                  </span>
                  <span style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>
                    {formatMoney(s.total)}
                  </span>
                </SectionRow>
              ))
            )}
          </SectionCard>

          <SectionCard
            title="Cobros pendientes"
            count={collections.length}
            countTone={collections.length > 0 ? "danger" : "neutral"}
            icon={<AlertCircle size={16} />}
            iconTone="danger"
            subtitle={porCobrar > 0 ? `${formatMoney(porCobrar)} por cobrar` : undefined}
            onViewAll={() => onNavigate("deudas")}
          >
            {loading ? (
              <Empty text="Cargando…" />
            ) : collections.length === 0 ? (
              <Empty text="Todo cobrado 🎉" />
            ) : (
              collections.slice(0, 5).map((s, i, arr) => (
                <SectionRow key={s.id} isLast={i === arr.length - 1} onClick={() => onNavigate("deudas")}>
                  <Avatar name={s.customerName || "Sin cliente"} size={28} />
                  <span style={{ flex: 1, fontSize: text.sm, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.customerName || "Sin cliente"}
                  </span>
                  <span style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.danger }}>
                    {formatMoney(s.balance)}
                  </span>
                </SectionRow>
              ))
            )}
          </SectionCard>

          <SectionCard
            title="Clientes en riesgo"
            count={inactiveClients.length}
            countTone={inactiveClients.length > 0 ? "warning" : "neutral"}
            icon={<UserMinus size={16} />}
            iconTone="warning"
            subtitle="Sin contacto reciente"
            onViewAll={() => onNavigate("customers")}
          >
            {loading ? (
              <Empty text="Cargando…" />
            ) : inactiveClients.length === 0 ? (
              <Empty text="Todos tus clientes en contacto reciente 🎉" />
            ) : (
              inactiveClients.map((x, i, arr) => (
                <SectionRow key={x.customer.id} isLast={i === arr.length - 1}>
                  <Avatar name={x.customer.name} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: text.sm, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {x.customer.name}
                    </div>
                    <div style={{ fontSize: text.xs, color: color.warning, fontWeight: weight.medium, marginTop: 1 }}>
                      Sin contacto hace {x.days} {x.days === 1 ? "día" : "días"}
                      {x.purchases > 0 ? ` · ${x.purchases} compra${x.purchases === 1 ? "" : "s"}` : ""}
                    </div>
                  </div>
                  {canContact && x.customer.phone && (
                    <>
                      <RowIconBtn variant="wa" label="WhatsApp" onClick={() => contact(x.customer, "whatsapp")}>
                        <WhatsAppIcon size={13} />
                      </RowIconBtn>
                      <RowIconBtn variant="muted" label="Llamar" onClick={() => contact(x.customer, "call")}>
                        <Phone size={13} strokeWidth={2.2} />
                      </RowIconBtn>
                    </>
                  )}
                </SectionRow>
              ))
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/* ── helpers de UI ── */

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ height: 8, background: color.surface2, borderRadius: radius.full, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: pct >= 100 ? color.success : color.primary,
          borderRadius: radius.full,
          transition: "width 500ms ease",
        }}
      />
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const size = 92;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;
  const c = score >= 75 ? color.success : score >= 50 ? color.primary : color.warning;
  return (
    <div style={{ position: "relative", width: size, height: size }} title="Score del día">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color.border} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: text.xl, fontWeight: weight.bold, color: color.text }}>{score}</span>
        <span style={{ fontSize: 9, color: color.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          score
        </span>
      </div>
    </div>
  );
}

function RowIconBtn({
  variant,
  label,
  onClick,
  children,
}: {
  variant: "wa" | "muted";
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`btn-icon ${variant}`}
      style={{ width: 26, height: 26, borderRadius: radius.sm, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 28 }}>
      {data.map((v, i) => {
        const h = Math.max(2, Math.round((v / max) * 28));
        const isToday = i === data.length - 1;
        return (
          <div
            key={i}
            title={formatMoney(v)}
            style={{ flex: 1, height: h, borderRadius: 2, background: isToday ? color.primary : color.border }}
          />
        );
      })}
    </div>
  );
}

/* ───────── Entrenador personal (home gamificado · Fase ⑦.3) ───────── */
function CoachCard({ score, scoreItems, streak, dailyMap, todayKey, nowMs }: {
  score: number;
  scoreItems: Array<{ label: string; done: boolean }>;
  streak: number;
  dailyMap: Map<string, number>;
  todayKey: string;
  nowMs: number;
}) {
  void score;
  const completed = scoreItems.filter((r) => r.done).length;
  const remaining = scoreItems.length - completed;
  const motiv = remaining === 0 ? "¡Día completo! 🔥" : completed === 0 ? "¡Vamos, vos podés!" : "Vas muy bien, seguí así";
  const sub = remaining === 0
    ? "Cumpliste todos los retos de hoy"
    : `Estás a ${remaining} ${remaining === 1 ? "reto" : "retos"} de completar el día`;
  const titles = ["Venta", "Rutinas", "Caja", "Seguimiento"];

  // Racha semanal (lunes→domingo): día "cumplido" = hubo ventas.
  const now = new Date(nowMs);
  const dow = (now.getDay() + 6) % 7; // 0 = lunes
  const monday = nowMs - dow * 86_400_000;
  const letters = ["L", "M", "X", "J", "V", "S", "D"];
  const week = letters.map((ltr, i) => {
    const key = toLocalISODate(new Date(monday + i * 86_400_000));
    return { ltr, key, done: (dailyMap.get(key) ?? 0) > 0, isToday: key === todayKey, future: key > todayKey };
  });

  return (
    <div style={{ marginBottom: space[5], borderRadius: radius.lg, overflow: "hidden", border: `1px solid ${color.border}` }}>
      <div style={{ background: `linear-gradient(135deg, ${color.primary}, #9f1239)`, padding: space[4], color: "#fff" }}>
        <div style={{ fontSize: text.xs, fontWeight: weight.semibold, textTransform: "uppercase", letterSpacing: 0.6, opacity: 0.85 }}>Entrenador personal</div>
        <div style={{ fontSize: text.lg, fontWeight: weight.bold, marginTop: 2, lineHeight: 1.15 }}>{motiv}</div>
        <div style={{ fontSize: text.sm, opacity: 0.9, marginTop: 4 }}>{sub}</div>
      </div>

      <div style={{ background: color.surface, padding: space[4] }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: space[2] }}>
          {scoreItems.map((r, i) => (
            <div key={i} style={{ background: color.surface2, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: space[3], textAlign: "center" }}>
              <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>{titles[i] ?? r.label}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: space[2] }}>
                {[0, 1].map((s) => (
                  <Star key={s} size={18} color={r.done ? color.primary : color.textDim} fill={r.done ? color.primary : "none"} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: space[4], gap: space[3], flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: space[2] }}>
            {week.map((d) => (
              <div
                key={d.key}
                title={d.key}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: text.xs,
                  fontWeight: weight.semibold,
                  background: d.done ? color.primary : "transparent",
                  color: d.done ? "#fff" : d.future ? color.textDim : color.textMuted,
                  border: d.isToday ? `2px solid ${color.primary}` : `1px solid ${color.border}`,
                  opacity: d.future ? 0.5 : 1,
                }}
              >
                {d.ltr}
              </div>
            ))}
          </div>
          {streak > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: text.sm, fontWeight: weight.semibold, color: color.primary }}>
              <Flame size={16} /> Racha {streak} {streak === 1 ? "día" : "días"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, hint, sub, tone = "neutral" }: { label: string; value: string; hint?: string; sub?: string | null; tone?: "neutral" | "warning" }) {
  return (
    <div>
      <div style={{ fontSize: text.xs, color: color.textMuted, fontWeight: weight.medium, marginBottom: 2 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: text.xl,
          fontWeight: weight.bold,
          color: tone === "warning" ? color.warning : color.text,
          letterSpacing: "-0.4px",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {hint && <div style={{ fontSize: text.xs, color: color.textMuted, marginTop: 2 }}>{hint}</div>}
      {sub && <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function Empty({ text: t }: { text: string }) {
  return (
    <div style={{ padding: space[5], textAlign: "center", fontSize: text.sm, color: color.textMuted }}>{t}</div>
  );
}
