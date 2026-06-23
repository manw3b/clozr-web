"use client";

import { useEffect, useState } from "react";
import { Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Modal, ModalField } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney } from "@/lib/format";
import type { CashBuckets, Currency } from "@/lib/types";

/** Un bucket a arquear: método × moneda con el saldo que espera el sistema. */
export interface ExpectedBucket {
  method: string;
  currency: Currency;
  expected: number;
}

const bucketKey = (method: string, currency: Currency) => `${method}·${currency}`;

/**
 * Modal de arqueo / cierre de caja (Nivel B). El usuario cuenta cada bucket
 * (método × moneda: Efectivo ARS, Transferencia ARS, Crypto USD…) y el modal
 * muestra lo esperado, lo contado y la diferencia (sobra/falta) por bucket.
 * No fuerza diferencia 0 — un faltante/sobrante queda registrado para auditoría.
 */
export function CloseCashModal({
  open,
  onClose,
  expectedBuckets,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  expectedBuckets: ExpectedBucket[];
  onConfirm: (input: { ars: number; usd: number; buckets: CashBuckets }) => Promise<void>;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      for (const b of expectedBuckets) init[bucketKey(b.method, b.currency)] = String(Math.round(b.expected));
      setInputs(init);
    }
  }, [open, expectedBuckets]);

  const counted = (b: ExpectedBucket) => Number(inputs[bucketKey(b.method, b.currency)]) || 0;

  const isDirty = () =>
    expectedBuckets.some((b) => counted(b) !== Math.round(b.expected));
  const allFilled = expectedBuckets.every((b) => (inputs[bucketKey(b.method, b.currency)] ?? "").trim() !== "");
  const canSubmit = allFilled && !submitting;

  async function handleConfirm() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const buckets: CashBuckets = {};
      let ars = 0;
      let usd = 0;
      for (const b of expectedBuckets) {
        const v = counted(b);
        buckets[bucketKey(b.method, b.currency)] = v;
        if (b.currency === "USD") usd += v;
        else ars += v;
      }
      await onConfirm({ ars, usd, buckets });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      isDirty={isDirty}
      confirmCloseText="¿Cerrar el modal sin terminar el arqueo?"
      title="Cerrar caja del día"
      maxWidth={580}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            iconLeft={<Calendar size={14} />}
            onClick={handleConfirm}
            disabled={!canSubmit}
            loading={submitting}
          >
            Confirmar cierre
          </Button>
        </>
      }
    >
      <p style={{ fontSize: text.sm, color: color.textMuted, marginTop: 0, marginBottom: space[3] }}>
        Contá cada caja (efectivo, transferencia, crypto…) y registrala abajo. La diferencia con lo
        que el sistema esperaba queda guardada para auditoría — no tiene que ser exactamente cero.
      </p>

      {expectedBuckets.length === 0 ? (
        <div
          style={{
            padding: space[3],
            background: color.surface2,
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            fontSize: text.sm,
            color: color.textMuted,
          }}
        >
          No hubo saldo inicial ni movimientos hoy — la caja se cierra en cero.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
            {expectedBuckets.map((b, i) => {
              const key = bucketKey(b.method, b.currency);
              const symbol = b.currency === "USD" ? "US$" : "$";
              return (
                <ModalField key={key} label={`${b.method} ${b.currency}`} required>
                  <Input
                    type="number"
                    value={inputs[key] ?? ""}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="0"
                    iconLeft={<span style={{ fontSize: 12, fontWeight: weight.semibold }}>{symbol}</span>}
                    autoFocus={i === 0}
                  />
                </ModalField>
              );
            })}
          </div>

          <div
            style={{
              marginTop: space[4],
              padding: space[3],
              background: color.surface2,
              border: `1px solid ${color.border}`,
              borderRadius: radius.md,
              display: "flex",
              flexDirection: "column",
              gap: space[2],
            }}
          >
            {expectedBuckets.map((b) => {
              const c = counted(b);
              return (
                <DiffRow
                  key={bucketKey(b.method, b.currency)}
                  label={`${b.method} · ${b.currency}`}
                  expected={b.expected}
                  counted={c}
                  diff={c - b.expected}
                  currency={b.currency}
                />
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}

function DiffRow({
  label,
  expected,
  counted,
  diff,
  currency,
}: {
  label: string;
  expected: number;
  counted: number;
  diff: number;
  currency: Currency;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr 110px", gap: space[2], alignItems: "center" }}>
      <span style={{ fontSize: text.xs, color: color.text, fontWeight: weight.semibold, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span style={{ fontSize: text.xs, color: color.textDim, textAlign: "right" }}>
        Sistema: <strong style={{ color: color.textMuted, fontVariantNumeric: "tabular-nums" }}>{formatMoney(expected, currency)}</strong>
      </span>
      <span style={{ fontSize: text.xs, color: color.textDim, textAlign: "right" }}>
        Contado: <strong style={{ color: color.text, fontVariantNumeric: "tabular-nums" }}>{formatMoney(counted, currency)}</strong>
      </span>
      <DiffBadge value={diff} currency={currency} />
    </div>
  );
}

function DiffBadge({ value, currency }: { value: number; currency: Currency }) {
  const rounded = Math.round(value * 100) / 100;
  const isZero = Math.abs(rounded) < 0.01;
  const isPositive = rounded > 0;

  const tone = isZero ? color.textMuted : isPositive ? color.success : color.danger;
  const toneBg = isZero ? color.surface2 : isPositive ? color.successBg : color.dangerBg;
  const Icon = isZero ? CheckCircle2 : AlertTriangle;
  const label = isZero ? "Cuadra" : `${isPositive ? "+" : ""}${formatMoney(rounded, currency)}`;
  const subLabel = isZero ? "" : isPositive ? "sobra" : "falta";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 6px",
        borderRadius: radius.sm,
        background: toneBg,
        color: tone,
        fontSize: text.xs,
        fontWeight: weight.semibold,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        justifySelf: "end",
      }}
      title={isZero ? "Cuadra exacto" : `${label} ${subLabel}`}
    >
      <Icon size={10} strokeWidth={2.4} />
      {label}
      {!isZero && <span style={{ opacity: 0.7 }}>{subLabel}</span>}
    </span>
  );
}
