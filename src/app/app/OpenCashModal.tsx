"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Modal, ModalField } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { color, space, text, weight } from "@/tokens";

/**
 * Modal de apertura de caja. El usuario registra el saldo inicial (efectivo
 * con el que arranca el día) por moneda. Default 0 — podés abrir sin saldo.
 */
export function OpenCashModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (input: { ars: number; usd: number }) => Promise<void>;
}) {
  const [arsInput, setArsInput] = useState("0");
  const [usdInput, setUsdInput] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setArsInput("0");
      setUsdInput("0");
    }
  }, [open]);

  const ars = Number(arsInput) || 0;
  const usd = Number(usdInput) || 0;

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm({ ars, usd });
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
        Registrá el efectivo con el que arrancás el día. Después podés cargar ingresos y egresos, y
        al cerrar la caja se compara con lo contado.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
        <ModalField label="Saldo inicial (ARS)">
          <Input
            type="number"
            value={arsInput}
            onChange={(e) => setArsInput(e.target.value)}
            placeholder="0"
            iconLeft={<span style={{ fontSize: 12, fontWeight: weight.semibold }}>$</span>}
            autoFocus
          />
        </ModalField>
        <ModalField label="Saldo inicial (USD)">
          <Input
            type="number"
            value={usdInput}
            onChange={(e) => setUsdInput(e.target.value)}
            placeholder="0"
            iconLeft={<span style={{ fontSize: 12, fontWeight: weight.semibold }}>US$</span>}
          />
        </ModalField>
      </div>
    </Modal>
  );
}
