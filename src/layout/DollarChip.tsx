import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { color, radius, space, text, weight } from "../tokens";
import { fetchDolares, dolarLabel, type DolarRate } from "../lib/dolar";

/** Casas que mostramos en el dropdown, en orden. */
const SHOW = ["oficial", "blue", "bolsa", "contadoconliqui"];

/**
 * Chip de cotización del dólar en el topbar (port web del ExchangeRateChip
 * de la desktop). Trae las cotizaciones de dolarapi.com (API pública, sin
 * Worker). Best-effort: si no carga, no se muestra nada.
 */
export function DollarChip() {
  const [rates, setRates] = useState<DolarRate[] | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDolares()
      .then((r) => {
        if (!cancelled) setRates(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const blue = rates?.find((r) => r.casa === "blue") ?? rates?.[0];
  if (!blue) return null;

  const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
  const shown = SHOW.map((c) => rates!.find((r) => r.casa === c)).filter(Boolean) as DolarRate[];

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`btn-bordered${open ? " active" : ""}`}
        title="Cotización del dólar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: space[2],
          padding: `6px ${space[3]}`,
          borderRadius: radius.md,
          background: color.surface2,
          border: `1px solid ${color.border}`,
        }}
      >
        <span style={{ fontSize: 13 }}>💵</span>
        <span style={{ fontSize: text.xs, color: color.textMuted, fontWeight: weight.semibold }}>
          {dolarLabel(blue.casa)}
        </span>
        <span style={{ fontSize: text.sm, color: color.text, fontWeight: weight.bold }}>{fmt(blue.venta)}</span>
        <ChevronDown size={13} color={color.textDim} strokeWidth={2.2} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            minWidth: 250,
            background: color.surface,
            border: `1px solid ${color.borderStrong}`,
            borderRadius: radius.md,
            boxShadow: "var(--shadow-lg)",
            padding: 6,
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: space[3],
              padding: `${space[1]} ${space[3]} ${space[2]}`,
              fontSize: 10,
              fontWeight: weight.semibold,
              color: color.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.6px",
            }}
          >
            <span>Dólar</span>
            <span style={{ textAlign: "right", minWidth: 64 }}>Compra</span>
            <span style={{ textAlign: "right", minWidth: 64 }}>Venta</span>
          </div>
          {shown.map((r) => (
            <div
              key={r.casa}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: space[3],
                padding: `${space[2]} ${space[3]}`,
                borderRadius: radius.sm,
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: text.sm, color: color.text, fontWeight: weight.medium }}>
                {dolarLabel(r.casa)}
              </span>
              <span style={{ fontSize: text.sm, color: color.textMuted, textAlign: "right", minWidth: 64, fontVariantNumeric: "tabular-nums" }}>
                {fmt(r.compra)}
              </span>
              <span style={{ fontSize: text.sm, color: color.text, fontWeight: weight.semibold, textAlign: "right", minWidth: 64, fontVariantNumeric: "tabular-nums" }}>
                {fmt(r.venta)}
              </span>
            </div>
          ))}
          <div style={{ padding: `${space[2]} ${space[3]} ${space[1]}`, fontSize: 10, color: color.textDim, borderTop: `1px solid ${color.border}`, marginTop: space[1] }}>
            Fuente: dolarapi.com
          </div>
        </div>
      )}
    </div>
  );
}
