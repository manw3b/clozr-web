import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Trash2, Wallet, Search, Lock, Bitcoin } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Card, MetricCard } from "@/components/Card";
import { Input } from "@/components/Input";
import { Tabs } from "@/components/Tabs";
import { Modal, ModalField } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { CashSessionChip } from "@/components/CashSessionChip";
import { CloseCashModal, type ExpectedBucket } from "./CloseCashModal";
import { OpenCashModal } from "./OpenCashModal";
import { useUIStore } from "@/store/uiStore";
import { usePermissions } from "@/store/usePermissions";
import { useUndoableActions } from "@/store/useUndoableActions";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney, toLocalISODate } from "@/lib/format";
import * as api from "@/lib/api";
import type { CashBuckets, CashKind, CashMovement, CashSession, Currency } from "@/lib/types";

type Period = "today" | "week" | "month";

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

// Métodos de caja (buckets): cómo entra/sale la plata. Crypto se trata como
// USD (USDT ≈ USD) pero se ve como línea aparte en el desglose.
const CASH_METHODS = ["Efectivo", "Transferencia", "Crypto", "Tarjeta", "Otro"];

// Key de bucket usada en toda la Caja: `método·moneda`. Los nombres de método
// no contienen "·", así que la moneda es siempre el último segmento.
const bucketKey = (method: string, currency: Currency) => `${method}·${currency}`;
function parseBucketKey(key: string): [string, Currency] {
  const idx = key.lastIndexOf("·");
  if (idx === -1) return [key, "ARS"];
  return [key.slice(0, idx), key.slice(idx + 1) === "USD" ? "USD" : "ARS"];
}

function inPeriod(movedAt: string | null | undefined, period: Period): boolean {
  if (!movedAt) return false;
  const d = new Date(movedAt);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  if (period === "today") return toLocalISODate(d) === toLocalISODate(now);
  if (period === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  // week = últimos 7 días
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);
  return d >= weekAgo;
}

/**
 * Vista Caja — port web de clozr/src/pages/caja/.
 * Ingresos/egresos sobre la ruta genérica `cash` del Worker (kind/amount/
 * currency/category/description/moved_at) + sesión abrir/cerrar con arqueo por
 * bucket (CashSessionChip/Open/CloseCashModal). KPIs y filtros client-side.
 * US$ y pesos van SIEMPRE por separado: cada moneda es una caja física distinta,
 * no se mezclan ni se convierten (los KPIs y el desglose son por moneda).
 */
export function Caja() {
  const { showToast } = useUIStore();
  const { can } = usePermissions();
  const canWrite = can("cash.write");
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("today");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<null | CashKind>(null);
  const [openOpen, setOpenOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.listCashMovements(),
      // best-effort: si el endpoint de sesiones no está (Worker viejo / migración
      // con lag), la Caja sigue mostrando los movimientos igual.
      api.listCashSessions().catch(() => [] as CashSession[]),
    ])
      .then(([mv, ss]) => {
        setMovements(mv);
        setSessions(ss);
      })
      .catch(() => showToast("No se pudo cargar la caja", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const todayISO = toLocalISODate(new Date());
  const todaySession = useMemo(
    () => sessions.find((s) => s.date === todayISO) ?? null,
    [sessions, todayISO],
  );
  const isOpen = !!todaySession && !todaySession.closedAt;

  // Arqueo Nivel B: saldo esperado HOY por bucket (método × moneda) = apertura
  // del bucket + (ingresos − egresos) de hoy de ese método/moneda. Sin
  // conversión: cada bucket es una caja física/digital distinta.
  const expectedBuckets = useMemo<ExpectedBucket[]>(() => {
    const map = new Map<string, ExpectedBucket>();
    const seed = (method: string, currency: Currency, amount: number) => {
      const key = bucketKey(method, currency);
      const cur = map.get(key) ?? { method, currency, expected: 0 };
      cur.expected += amount;
      map.set(key, cur);
    };
    const opened = todaySession?.openedBuckets ?? null;
    if (opened) {
      for (const [key, amount] of Object.entries(opened)) {
        const [method, currency] = parseBucketKey(key);
        seed(method, currency, amount);
      }
    }
    for (const m of movements) {
      if (!inPeriod(m.movedAt, "today")) continue;
      seed(m.paymentMethod || "Otro", m.currency, m.kind === "income" ? m.amount : -m.amount);
    }
    return Array.from(map.values()).sort((a, b) => Math.abs(b.expected) - Math.abs(a.expected));
  }, [movements, todaySession]);

  async function handleOpenSession(input: { ars: number; usd: number; buckets: CashBuckets }) {
    try {
      await api.openCashSession({ date: todayISO, ars: input.ars, usd: input.usd, buckets: input.buckets });
      showToast("Caja abierta", "success");
      load();
    } catch (e) {
      showToast("No se pudo abrir la caja", "error");
      throw e; // mantener el modal abierto para reintentar
    }
  }

  async function handleCloseSession(input: { ars: number; usd: number; buckets: CashBuckets }) {
    if (!todaySession) return;
    try {
      await api.closeCashSession(todaySession.id, input);
      showToast("Caja cerrada · arqueo guardado", "success");
      load();
    } catch (e) {
      showToast("No se pudo cerrar la caja", "error");
      throw e;
    }
  }

  const periodMovements = useMemo(
    () => movements.filter((m) => inPeriod(m.movedAt, period)),
    [movements, period],
  );

  // US$ y pesos por separado: cada moneda es una caja física distinta, no se
  // mezclan ni se convierten. Antes el USD se calculaba pero no se mostraba.
  const totals = useMemo(() => {
    let incomeArs = 0, expenseArs = 0, incomeUsd = 0, expenseUsd = 0;
    for (const m of periodMovements) {
      if (m.currency === "USD") {
        if (m.kind === "income") incomeUsd += m.amount;
        else expenseUsd += m.amount;
      } else {
        if (m.kind === "income") incomeArs += m.amount;
        else expenseArs += m.amount;
      }
    }
    return {
      incomeArs, expenseArs, balanceArs: incomeArs - expenseArs,
      incomeUsd, expenseUsd, balanceUsd: incomeUsd - expenseUsd,
      hasUsd: incomeUsd > 0 || expenseUsd > 0,
    };
  }, [periodMovements]);

  // Desglose del período por método × moneda (billetes ARS, transferencia ARS,
  // efectivo USD, crypto…). Son saldos reales por bucket, sin conversión.
  const breakdown = useMemo(() => {
    const map = new Map<string, { method: string; currency: Currency; net: number }>();
    for (const m of periodMovements) {
      const method = m.paymentMethod || "Otro";
      const key = bucketKey(method, m.currency);
      const cur = map.get(key) ?? { method, currency: m.currency, net: 0 };
      cur.net += m.kind === "income" ? m.amount : -m.amount;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .filter((b) => b.net !== 0)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [periodMovements]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...periodMovements].sort((a, b) => (b.movedAt ?? "").localeCompare(a.movedAt ?? ""));
    if (!q) return list;
    return list.filter((m) =>
      [m.description ?? "", m.category ?? "", String(m.amount)].join(" ").toLowerCase().includes(q),
    );
  }, [periodMovements, search]);

  function remove(m: CashMovement) {
    // Optimista + undo: el delete real se confirma a los 6s salvo "Deshacer".
    setMovements((prev) => prev.filter((x) => x.id !== m.id));
    useUndoableActions.getState().register({
      label: "Movimiento eliminado",
      sublabel: `${m.kind === "income" ? "Ingreso" : "Egreso"} · ${formatMoney(m.amount, m.currency)}`,
      onUndo: () => setMovements((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
      commit: () => api.deleteCashMovement(m.id),
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5], height: "100%" }}>
      <PageHeader
        title={
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            Caja
            <CashSessionChip session={todaySession} />
          </span>
        }
        subtitle="Ingresos y egresos de dinero"
        actions={
          canWrite ? (
            <>
              {!todaySession && (
                <Button variant="primary" iconLeft={<Wallet size={16} />} onClick={() => setOpenOpen(true)}>
                  Abrir caja
                </Button>
              )}
              <Button
                variant="success"
                iconLeft={<ArrowUpRight size={16} strokeWidth={2.4} />}
                onClick={() => setForm("income")}
                disabled={!isOpen}
                title={!isOpen ? "Abrí la caja para registrar movimientos" : undefined}
              >
                Ingreso
              </Button>
              <Button
                variant="danger"
                iconLeft={<ArrowDownRight size={16} strokeWidth={2.4} />}
                onClick={() => setForm("expense")}
                disabled={!isOpen}
                title={!isOpen ? "Abrí la caja para registrar movimientos" : undefined}
              >
                Egreso
              </Button>
              {isOpen && (
                <Button variant="secondary" iconLeft={<Lock size={15} />} onClick={() => setCloseOpen(true)}>
                  Cerrar caja
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
        {totals.hasUsd && <BucketLabel>Pesos</BucketLabel>}
        <div className="cz-metric-grid" style={{ ["--cz-cols"]: 3 } as React.CSSProperties}>
          <MetricCard label="Ingresos" value={formatMoney(totals.incomeArs)} tone="success" icon={<ArrowUpRight size={16} />} />
          <MetricCard label="Egresos" value={formatMoney(totals.expenseArs)} tone="danger" icon={<ArrowDownRight size={16} />} />
          <MetricCard
            label="Balance"
            value={formatMoney(totals.balanceArs)}
            tone={totals.balanceArs >= 0 ? "neutral" : "danger"}
            icon={<Wallet size={16} />}
          />
        </div>
        {totals.hasUsd && (
          <>
            <BucketLabel>Dólares</BucketLabel>
            <div className="cz-metric-grid" style={{ ["--cz-cols"]: 3 } as React.CSSProperties}>
              <MetricCard label="Ingresos" value={formatMoney(totals.incomeUsd, "USD")} tone="success" icon={<ArrowUpRight size={16} />} />
              <MetricCard label="Egresos" value={formatMoney(totals.expenseUsd, "USD")} tone="danger" icon={<ArrowDownRight size={16} />} />
              <MetricCard
                label="Balance"
                value={formatMoney(totals.balanceUsd, "USD")}
                tone={totals.balanceUsd >= 0 ? "neutral" : "danger"}
                icon={<Wallet size={16} />}
              />
            </div>
          </>
        )}
      </div>

      {breakdown.length > 0 && (
        <Card padding={4}>
          <div style={{ fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: space[3] }}>
            Desglose del período · por método y moneda
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: space[2] }}>
            {breakdown.map((b) => (
              <div
                key={`${b.method}·${b.currency}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  padding: `${space[2]} ${space[3]}`,
                  background: color.surface2,
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.md,
                  minWidth: 132,
                }}
              >
                <span style={{ fontSize: text.xs, color: color.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {b.method === "Crypto" && <Bitcoin size={11} color={color.warning} />}
                  {b.method} · {b.currency}
                </span>
                <span
                  style={{
                    fontSize: text.sm,
                    fontWeight: weight.bold,
                    color: b.net >= 0 ? color.success : color.danger,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {b.net >= 0 ? "+" : "−"}
                  {formatMoney(Math.abs(b.net), b.currency)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: space[3], flexWrap: "wrap" }}>
        <Tabs variant="pills" size="sm" value={period} onChange={(v) => setPeriod(v as Period)} items={PERIODS} />
        <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar descripción, categoría o monto…"
            iconLeft={<Search size={14} />}
          />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {loading ? (
          <div style={{ fontSize: text.sm, color: color.textDim, padding: space[5] }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Wallet size={28} />}
            title="Sin movimientos"
            description="Cargá un ingreso o un egreso para que se refleje en el balance."
          />
        ) : (
          <Card padding={0}>
            {filtered.map((m, i) => {
              const isIncome = m.kind === "income";
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: space[3],
                    padding: `${space[3]} ${space[4]}`,
                    borderBottom: i === filtered.length - 1 ? "none" : `1px solid ${color.border}`,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: radius.md,
                      background: isIncome ? color.successBg : color.dangerBg,
                      color: isIncome ? color.success : color.danger,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isIncome ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: text.sm, fontWeight: weight.medium, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.description || m.category || (isIncome ? "Ingreso" : "Egreso")}
                    </div>
                    <div style={{ fontSize: text.xs, color: color.textMuted, marginTop: 2 }}>
                      {m.movedAt ? new Date(m.movedAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                      {m.paymentMethod ? ` · ${m.paymentMethod}` : ""}
                      {m.category ? ` · ${m.category}` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: text.sm, fontWeight: weight.bold, color: isIncome ? color.success : color.danger, fontVariantNumeric: "tabular-nums" }}>
                    {isIncome ? "+" : "−"}
                    {formatMoney(m.amount, m.currency)}
                  </span>
                  {canWrite && <Button variant="ghost" size="sm" iconLeft={<Trash2 size={13} />} onClick={() => remove(m)} />}
                </div>
              );
            })}
          </Card>
        )}
      </div>

      <NewMovementModal
        open={form !== null}
        kind={form ?? "income"}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          load();
        }}
      />

      <OpenCashModal open={openOpen} onClose={() => setOpenOpen(false)} onConfirm={handleOpenSession} />

      <CloseCashModal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        expectedBuckets={expectedBuckets}
        onConfirm={handleCloseSession}
      />
    </div>
  );
}

/** Etiqueta de grupo de moneda sobre la fila de métricas (Pesos / Dólares). */
function BucketLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.4px" }}>
      {children}
    </div>
  );
}

/* ───────── Modal nuevo movimiento ───────── */

function NewMovementModal({
  open,
  kind,
  onClose,
  onSaved,
}: {
  open: boolean;
  kind: CashKind;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useUIStore();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [method, setMethod] = useState("Efectivo");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setCurrency("ARS");
      setMethod("Efectivo");
      setDescription("");
      setCategory("");
    }
  }, [open]);

  const isIncome = kind === "income";
  const isCrypto = method === "Crypto";
  const canSubmit = Number(amount) > 0;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await api.createCashMovement({
        kind,
        amount: Number(amount),
        currency,
        paymentMethod: method,
        description: description.trim() || null,
        category: category.trim() || null,
      });
      showToast(isIncome ? "Ingreso registrado" : "Egreso registrado", "success");
      onSaved();
    } catch {
      showToast("No se pudo registrar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      isDirty={() => amount.trim().length > 0 || description.trim().length > 0}
      confirmCloseText="¿Cerrar y descartar el movimiento?"
      title={isIncome ? "Nuevo ingreso" : "Nuevo egreso"}
      maxWidth={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={isIncome ? "success" : "danger"} onClick={submit} disabled={!canSubmit} loading={saving}>
            Registrar
          </Button>
        </>
      }
    >
      <ModalField label="Método" hint={isCrypto ? "Crypto se registra en dólares (US$)" : undefined}>
        <select
          value={method}
          onChange={(e) => {
            const v = e.target.value;
            setMethod(v);
            if (v === "Crypto") setCurrency("USD");
          }}
          className="select-trigger"
          style={{ width: "100%", height: 38, borderRadius: radius.md, color: color.text, padding: `0 ${space[2]}` }}
        >
          {CASH_METHODS.map((mtd) => (
            <option key={mtd} value={mtd}>
              {mtd}
            </option>
          ))}
        </select>
      </ModalField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: space[3] }}>
        <ModalField label="Monto" required>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
        </ModalField>
        <ModalField label="Moneda">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            disabled={isCrypto}
            title={isCrypto ? "Crypto siempre va en US$" : undefined}
            className="select-trigger"
            style={{
              width: "100%",
              height: 38,
              borderRadius: radius.md,
              color: color.text,
              padding: `0 ${space[2]}`,
              opacity: isCrypto ? 0.55 : 1,
              cursor: isCrypto ? "not-allowed" : "pointer",
            }}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </ModalField>
      </div>
      <ModalField label="Descripción" hint="Opcional">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isIncome ? "Ej: Venta mostrador" : "Ej: Alquiler"} />
      </ModalField>
      <ModalField label="Categoría" hint="Opcional">
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={isIncome ? "Ej: Ventas" : "Ej: Gastos fijos"} />
      </ModalField>
    </Modal>
  );
}
