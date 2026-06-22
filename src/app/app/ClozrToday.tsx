"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ClozrAiIcon } from "@/components/ClozrAiIcon";
import { useUIStore } from "@/store/uiStore";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney } from "@/lib/format";
import * as api from "@/lib/api";
import { AiPaywall } from "./AiSuggestions";

export interface TodayStats {
  followups: number;
  collections: number;
  collectionsAmount: number;
  inactive: number;
  tasks: number;
  todaySales: number;
}

/**
 * ✨ Hoy en Clozr (F4): tarjeta del dashboard con insights accionables (gratis,
 * calculados del CRM) y una recomendación del día por IA (paga, con
 * trial/paywall). Recibe los números ya computados por MiDia.
 */
export function ClozrToday({
  stats,
  candidates,
  onNavigate,
}: {
  stats: TodayStats;
  candidates: string[];
  onNavigate: (view: string) => void;
}) {
  const { showToast } = useUIStore();
  const [reco, setReco] = useState("");
  const [busy, setBusy] = useState(false);
  const [noCredits, setNoCredits] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);

  const insights = [
    stats.followups > 0 && {
      emoji: "⚠️",
      label: `${stats.followups} ${stats.followups === 1 ? "seguimiento pendiente" : "seguimientos pendientes"}`,
      to: "tasks",
    },
    stats.collections > 0 && {
      emoji: "💰",
      label: `${stats.collections} ${stats.collections === 1 ? "cobro pendiente" : "cobros pendientes"} · ${formatMoney(stats.collectionsAmount)}`,
      to: "deudas",
    },
    stats.inactive > 0 && {
      emoji: "🕓",
      label: `${stats.inactive} ${stats.inactive === 1 ? "cliente sin contacto" : "clientes sin contacto"} hace rato`,
      to: "customers",
    },
  ].filter(Boolean) as Array<{ emoji: string; label: string; to: string }>;

  async function brief() {
    setBusy(true);
    try {
      const r = await api.aiAction({
        action: "daybrief",
        context: {
          seguimientos: stats.followups,
          cobros: stats.collections,
          cobrosMonto: stats.collectionsAmount ? formatMoney(stats.collectionsAmount) : "",
          inactivos: stats.inactive,
          tareas: stats.tasks,
          ventasHoy: stats.todaySales,
          candidatos: candidates.slice(0, 4),
        },
      });
      setReco(r.text);
    } catch (e) {
      if (e instanceof api.ApiError && (e.code === "no_credits" || e.status === 402)) setNoCredits(true);
      else if (e instanceof api.ApiError && e.status === 503) showToast("La IA no está disponible ahora.", "error");
      else showToast("No se pudo generar la recomendación.", "error");
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

  return (
    <Card padding={4}>
      <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: space[1] }}>
        <ClozrAiIcon size={16} style={{ color: color.primary }} />
        <span style={{ fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Hoy en Clozr
        </span>
      </div>

      {/* Recomendación del día (IA) */}
      {noCredits ? (
        <div style={{ marginBottom: space[3] }}>
          <AiPaywall buying={buying} onBuy={buy} onBack={() => setNoCredits(false)} />
        </div>
      ) : reco ? (
        <div
          style={{
            display: "flex",
            gap: space[2],
            alignItems: "flex-start",
            background: color.primaryBg,
            border: `1px solid ${color.primary}`,
            borderRadius: radius.md,
            padding: space[3],
            marginBottom: space[3],
          }}
        >
          <ClozrAiIcon size={14} style={{ color: color.primary, marginTop: 2 }} />
          <div style={{ fontSize: text.sm, color: color.text, lineHeight: 1.55, whiteSpace: "pre-wrap", flex: 1 }}>{reco}</div>
        </div>
      ) : (
        <div style={{ marginBottom: space[3] }}>
          <Button variant="secondary" size="sm" iconLeft={<ClozrAiIcon size={14} />} loading={busy} onClick={brief}>
            Recomendación del día
          </Button>
        </div>
      )}

      {/* Insights accionables (calculados, sin costo) */}
      {insights.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
          {insights.map((it) => (
            <div
              key={it.to}
              style={{
                display: "flex",
                alignItems: "center",
                gap: space[2],
                padding: "8px 10px",
                background: color.surface2,
                border: `1px solid ${color.border}`,
                borderRadius: radius.md,
              }}
            >
              <span style={{ fontSize: 15 }}>{it.emoji}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: text.sm, color: color.text }}>{it.label}</span>
              <Button variant="ghost" size="sm" onClick={() => onNavigate(it.to)}>
                Ver
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: text.sm, color: color.textMuted }}>Todo al día por acá 🎉</div>
      )}
    </Card>
  );
}
