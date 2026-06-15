import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, CheckSquare, ShoppingCart, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { SectionCard, SectionRow } from "@/components/SectionCard";
import { useUIStore } from "@/store/uiStore";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney, greetByHour, greetText, formatDateLong, toLocalISODate } from "@/lib/format";
import * as api from "@/lib/api";
import type { Sale, Task, User } from "@/lib/types";

/**
 * Vista Mi Día — port web (v1) de clozr/src/pages/mi-dia/.
 * Home/agregador: hero con saludo + stats del día, y bloques que componen
 * datos ya portados (Tareas pendientes, Ventas de hoy, Cobros pendientes).
 * DIFERIDO de la desktop: objetivo/score del día, seguimientos (tabla
 * followups) y clientes inactivos (tracking de contacto) — no existen aún
 * en la web.
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.listTasks(), api.listSales()])
      .then(([t, s]) => {
        setTasks(t);
        setSales(s);
      })
      .catch(() => showToast("No se pudo cargar Mi Día", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const now = new Date();
  const greeting = greetText(greetByHour(now.getHours()));
  const todayKey = toLocalISODate(now);
  const userName = user.name ?? user.email.split("@")[0];

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5] }}>
      {/* HERO */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: space[6],
          alignItems: "center",
          padding: `${space[6]} ${space[8]}`,
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
          <div
            style={{
              fontSize: 10,
              fontWeight: weight.semibold,
              color: color.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              marginBottom: space[2],
            }}
          >
            {formatDateLong(now.toISOString())}
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
          <div style={{ display: "flex", gap: space[6], flexWrap: "wrap" }}>
            <HeroStat label="Ventas de hoy" value={`${todaySales.length}`} hint={formatMoney(todayTotal)} />
            <HeroStat
              label="Por cobrar"
              value={formatMoney(porCobrar)}
              tone={porCobrar > 0 ? "warning" : "neutral"}
            />
            <HeroStat label="Tareas pendientes" value={`${pendingTasks.length}`} />
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <Button variant="primary" size="lg" iconLeft={<Plus size={18} />} onClick={onNewSale}>
            Nueva venta
          </Button>
        </div>
      </div>

      {/* GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: space[5] }}>
        {/* IZQUIERDA — Tareas */}
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
            pendingTasks.slice(0, 7).map((t, i, arr) => (
              <SectionRow key={t.id} isLast={i === arr.length - 1}>
                <button
                  onClick={() => toggleTask(t)}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    border: `1.5px solid ${color.borderStrong}`,
                    background: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
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

        {/* DERECHA — Ventas de hoy + Cobros */}
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
                <Button variant="secondary" size="sm" iconLeft={<Plus size={14} />} onClick={onNewSale}>
                  Registrar venta
                </Button>
              </div>
            ) : (
              todaySales.slice(0, 6).map((s, i, arr) => (
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
              collections.slice(0, 6).map((s, i, arr) => (
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
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: "neutral" | "warning" }) {
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
    </div>
  );
}

function Empty({ text: t }: { text: string }) {
  return (
    <div style={{ padding: space[5], textAlign: "center", fontSize: text.sm, color: color.textMuted }}>{t}</div>
  );
}
