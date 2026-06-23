"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Modal, ModalField } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { color, space, text, weight } from "@/tokens";
import type { CashBuckets, Currency } from "@/lib/types";

/** Buckets que se ofrecen al abrir (los más comunes de un revendedor). Otros
 *  métodos/monedas igual generan su bucket vía movimientos y aparecen en el
 *  arqueo de cierre. La key `método·moneda` es la misma en toda la Caja. */
const OPEN_BUCKETS: { method: string; currency: Currency; label: string }[] = [
  { method: "Efectivo", currency: "ARS", label: "Efectivo ARS" },
  { method: "Efectivo", currency: "USD", label: "Efectivo USD" },
  { method: "Transferencia", currency: "ARS", label: "Transferencia ARS" },
  { method: "Crypto", currency: "USD", label: "Crypto USD" },
];

const bucketKey = (method: string, currency: Currency) => `${method}·${currency}`;
const zeros = () => Object.fromEntries(OPEN_BUCKETS.map((b) => [bucketKey(b.method, b.currency), "0"]));

/**
 * Modal de apertura de caja. El usuario registra el saldo inicial con el que
 * arranca el día por bucket (método × moneda). Default 0 — podés abrir sin saldo.
 */
export function OpenCashModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (input: { ars: number; usd: number; buckets: CashBuckets }) => Promise<void>;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>(zeros);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setInputs(zeros());
  }, [open]);

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      // buckets: solo los != 0 (JSON limpio). ars/usd = suma por moneda.
      const buckets: CashBuckets = {};
      let ars = 0;
      let usd = 0;
      for (const b of OPEN_BUCKETS) {
        const key = bucketKey(b.method, b.currency);
        const v = Number(inputs[key]) || 0;
        if (v !== 0) buckets[key] = v;
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
      title="Abrir caja del día"
      maxWidth={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" iconLeft={<Wallet size={14} />} onClick={handleConfirm} loading={submitting}>
            Abrir caja
          </Button>
        </>
      }
    >
      <p style={{ fontSize: text.sm, color: color.textMuted, marginTop: 0, marginBottom: space[3] }}>
        Registrá con cuánto arrancás el día en cada caja. Después cargás ingresos y egresos, y al
        cerrar se compara cada bucket con lo contado.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
        {OPEN_BUCKETS.map((b, i) => {
          const key = bucketKey(b.method, b.currency);
          const symbol = b.currency === "USD" ? "US$" : "$";
          return (
            <ModalField key={key} label={b.label}>
              <Input
                type="number"
                value={inputs[key] ?? "0"}
                onChange={(e) => setInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder="0"
                iconLeft={<span style={{ fontSize: 12, fontWeight: weight.semibold }}>{symbol}</span>}
                autoFocus={i === 0}
              />
            </ModalField>
          );
        })}
      </div>
    </Modal>
  );
}
