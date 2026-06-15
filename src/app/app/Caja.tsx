import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Trash2, Wallet, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Card, MetricCard } from "@/components/Card";
import { Input } from "@/components/Input";
import { Tabs } from "@/components/Tabs";
import { Modal, ModalField } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { confirmAsync } from "@/lib/confirmAsync";
import { useUIStore } from "@/store/uiStore";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney, toLocalISODate } from "@/lib/format";
import * as api from "@/lib/api";
import type { CashKind, CashMovement, Currency } from "@/lib/types";

type Period = "today" | "week" | "month";

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

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
 * Vista Caja (v1, solo-movimientos) — port web de clozr/src/pages/caja/.
 * Ingresos/egresos sobre la ruta genérica `cash` del Worker (kind/amount/
 * currency/category/description/moved_at). KPIs y filtros client-side.
 * DIFERIDO (necesita endpoint nuevo en el Worker): la "sesión" abrir/cerrar
 * caja + arqueo (CashSessionChip/CloseCashModal de la desktop).
 */
export function Caja() {
  const { showToast } = useUIStore();
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("today");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<null | CashKind>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listCashMovements()
      .then(setMovements)
      .catch(() => showToast("No se pudo cargar la caja", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const periodMovements = useMemo(
    () => movements.filter((m) => inPeriod(m.movedAt, period)),
    [movements, period],
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let usd = 0;
    for (const m of periodMovements) {
      if (m.currency === "USD") {
        usd += m.kind === "income" ? m.amount : -m.amount;
        continue;
      }
      if (m.kind === "income") income += m.amount;
      else expense += m.amount;
    }
    return { income, expense, balance: income - expense, usd };
  }, [periodMovements]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...periodMovements].sort((a, b) => (b.movedAt ?? "").localeCompare(a.movedAt ?? ""));
    if (!q) return list;
    return list.filter((m) =>
      [m.description ?? "", m.category ?? "", String(m.amount)].join(" ").toLowerCase().includes(q),
    );
  }, [periodMovements, search]);

  async function remove(m: CashMovement) {
    const ok = await confirmAsync({
      message: `¿Eliminar este movimiento de ${formatMoney(m.amount, m.currency)}?`,
      tone: "danger",
      confirmText: "Eliminar",
    });
    if (!ok) return;
    const snapshot = movements;
    setMovements((prev) => prev.filter((x) => x.id !== m.id));
    try {
      await api.deleteCashMovement(m.id);
      showToast("Movimiento eliminado", "success");
    } catch {
      setMovements(snapshot);
      showToast("No se pudo eliminar", "error");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5], height: "100%" }}>
      <PageHeader
        title="Caja"
        subtitle="Ingresos y egresos de dinero"
        actions={
          <>
            <Button variant="success" iconLeft={<ArrowUpRight size={16} strokeWidth={2.4} />} onClick={() => setForm("income")}>
              Ingreso
            </Button>
            <Button variant="danger" iconLeft={<ArrowDownRight size={16} strokeWidth={2.4} />} onClick={() => setForm("expense")}>
              Egreso
            </Button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: space[3] }}>
        <MetricCard label="Ingresos" value={formatMoney(totals.income)} tone="success" icon={<ArrowUpRight size={16} />} />
        <MetricCard label="Egresos" value={formatMoney(totals.expense)} tone="danger" icon={<ArrowDownRight size={16} />} />
        <MetricCard
          label="Balance"
          value={formatMoney(totals.balance)}
          tone={totals.balance >= 0 ? "neutral" : "danger"}
          icon={<Wallet size={16} />}
        />
      </div>

      {totals.usd !== 0 && (
        <div style={{ fontSize: text.xs, color: color.textMuted }}>
          Balance en dólares del período: <strong style={{ color: color.text }}>{formatMoney(totals.usd, "USD")}</strong>
        </div>
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
                      {m.category ? ` · ${m.category}` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: text.sm, fontWeight: weight.bold, color: isIncome ? color.success : color.danger, fontVariantNumeric: "tabular-nums" }}>
                    {isIncome ? "+" : "−"}
                    {formatMoney(m.amount, m.currency)}
                  </span>
                  <Button variant="ghost" size="sm" iconLeft={<Trash2 size={13} />} onClick={() => remove(m)} />
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
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setCurrency("ARS");
      setDescription("");
      setCategory("");
    }
  }, [open]);

  const isIncome = kind === "income";
  const canSubmit = Number(amount) > 0;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await api.createCashMovement({
        kind,
        amount: Number(amount),
        currency,
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: space[3] }}>
        <ModalField label="Monto" required>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
        </ModalField>
        <ModalField label="Moneda">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="select-trigger"
            style={{ width: "100%", height: 38, borderRadius: radius.md, color: color.text, padding: `0 ${space[2]}` }}
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
