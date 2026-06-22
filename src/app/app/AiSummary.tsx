"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/Button";
import { ClozrAiIcon } from "@/components/ClozrAiIcon";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney } from "@/lib/format";
import { CLIENT_TYPE_LABELS, hasAiPlan } from "@/lib/types";
import type { Customer, Sale } from "@/lib/types";
import * as api from "@/lib/api";
import { AiPaywall } from "./AiSuggestions";

/**
 * ✨ Resumen Inteligente del cliente (Pro AI, F3).
 * Genera un briefing comercial en bullets a partir de las notas, compras e
 * historial — sin pedirle nada al usuario. Self-contained (gate de créditos).
 */
export function AiSummary({
  customer,
  sales,
  stats,
}: {
  customer: Customer;
  sales: Sale[];
  stats: { purchases: number; debt: number };
}) {
  const { showToast } = useUIStore();
  const ws = useWorkspaceStore((s) => s.activeWorkspace);
  const [briefing, setBriefing] = useState("");
  const [busy, setBusy] = useState(false);
  const [noCredits, setNoCredits] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);

  function context() {
    const historial = sales
      .slice(0, 6)
      .map((s) => {
        const d = s.saleDate ?? s.createdAt;
        const fecha = d ? new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "venta";
        const estado = s.isPaid ? "pagada" : `debe ${formatMoney(s.balance)}`;
        return `${fecha}: ${formatMoney(s.total)} (${estado})`;
      })
      .join("; ");
    return {
      cliente: customer.name,
      tipo: CLIENT_TYPE_LABELS[customer.type],
      notas: customer.notes ?? "",
      compras: String(stats.purchases),
      deuda: stats.debt > 0 ? formatMoney(stats.debt) : "",
      historial,
    };
  }

  async function summarize() {
    setBusy(true);
    try {
      const r = await api.aiAction({ action: "summary", context: context() });
      setBriefing(r.text);
    } catch (e) {
      if (e instanceof api.ApiError && (e.code === "no_credits" || e.status === 402)) setNoCredits(true);
      else if (e instanceof api.ApiError && e.status === 503) showToast("La IA no está disponible ahora.", "error");
      else showToast("No se pudo generar el resumen.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function buy(pack: string) {
    setBuying(pack);
    try {
      const { initPoint } = await api.aiCheckout(pack);
      window.location.assign(initPoint);
    } catch (e) {
      const code = e instanceof api.ApiError ? e.code : "";
      showToast(code === "forbidden" ? "Solo el dueño puede comprar créditos." : "No se pudo iniciar la compra.", "error");
      setBuying(null);
    }
  }

  if (!hasAiPlan(ws)) return null; // IA solo para suscripciones pagas activas

  if (noCredits) {
    return (
      <div>
        <SectionLabel />
        <AiPaywall buying={buying} onBuy={buy} onBack={() => setNoCredits(false)} />
      </div>
    );
  }

  return (
    <div>
      <SectionLabel />
      {briefing ? (
        <div
          style={{
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            background: color.surface2,
            padding: space[4],
            fontSize: text.sm,
            color: color.text,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {briefing}
          <div style={{ marginTop: space[3] }}>
            <Button variant="ghost" size="sm" iconLeft={<RotateCcw size={13} />} loading={busy} onClick={summarize}>
              Rehacer
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" iconLeft={<ClozrAiIcon size={14} />} loading={busy} onClick={summarize}>
          Resumir cliente
        </Button>
      )}
    </div>
  );
}

function SectionLabel() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: space[3] }}>
      <ClozrAiIcon size={15} style={{ color: color.primary }} />
      <span style={{ fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Resumen inteligente
      </span>
    </div>
  );
}
