"use client";

import { useState } from "react";
import { Copy, RotateCcw, Lock } from "lucide-react";
import { Button } from "@/components/Button";
import { ClozrAiIcon } from "@/components/ClozrAiIcon";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { color, radius, space, text, weight } from "@/tokens";
import { openWhatsApp } from "@/lib/openExternal";
import { AI_GEN_KINDS, AI_TONES, AI_PACKS, CLIENT_TYPE_LABELS, formatUsd, hasAiPlan } from "@/lib/types";
import type { Customer } from "@/lib/types";
import * as api from "@/lib/api";

/**
 * ✨ Sugerencias Inteligentes (Pro AI, F1 + F2).
 * Tarjetas contextuales que redactan un mensaje usando los datos del cliente
 * (sin pedir nada al usuario) y permiten reescribir el tono. Self-contained:
 * maneja su propio gate de créditos/paywall.
 */
export function AiSuggestions({ customer }: { customer: Customer }) {
  const { showToast } = useUIStore();
  const ws = useWorkspaceStore((s) => s.activeWorkspace);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);

  const context = {
    cliente: customer.name,
    tipo: CLIENT_TYPE_LABELS[customer.type],
    notas: customer.notes ?? "",
  };

  function handleError(e: unknown) {
    if (e instanceof api.ApiError && (e.code === "no_credits" || e.status === 402)) {
      setNoCredits(true);
    } else if (e instanceof api.ApiError && e.status === 503) {
      showToast("La IA no está disponible ahora.", "error");
    } else {
      showToast("No se pudo generar. Probá de nuevo.", "error");
    }
  }

  async function generate(kind: string) {
    setBusy(kind);
    try {
      const r = await api.aiAction({ action: "generate", kind, context });
      setDraft(r.text);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(null);
    }
  }

  async function rewrite(tone: string) {
    if (!draft.trim()) return;
    setBusy(tone);
    try {
      const r = await api.aiAction({ action: "rewrite", tone, text: draft });
      setDraft(r.text);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(null);
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

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: space[3] }}>
        <ClozrAiIcon size={15} style={{ color: color.primary }} />
        <span style={{ fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Sugerencias inteligentes
        </span>
      </div>

      {noCredits ? (
        <AiPaywall buying={buying} onBuy={buy} onBack={() => setNoCredits(false)} />
      ) : (
        <>
          {/* Tarjetas de tipo de mensaje */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: space[2] }}>
            {AI_GEN_KINDS.map((k) => (
              <Chip key={k.key} loading={busy === k.key} disabled={!!busy} onClick={() => generate(k.key)} primary icon>
                {k.label}
              </Chip>
            ))}
          </div>

          {draft && (
            <div style={{ marginTop: space[4] }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                style={{
                  width: "100%",
                  resize: "vertical",
                  minHeight: 110,
                  background: color.surface2,
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.md,
                  padding: "10px 12px",
                  color: color.text,
                  fontSize: text.sm,
                  fontFamily: "inherit",
                  lineHeight: 1.55,
                }}
              />

              {/* Reescritura de tono */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: space[2], marginTop: space[2] }}>
                {AI_TONES.map((t) => (
                  <Chip key={t.key} loading={busy === t.key} disabled={!!busy} onClick={() => rewrite(t.key)}>
                    {t.label}
                  </Chip>
                ))}
              </div>

              {/* Acciones */}
              <div style={{ display: "flex", gap: space[2], marginTop: space[3] }}>
                {customer.phone && (
                  <Button variant="primary" size="sm" onClick={() => openWhatsApp(customer.phone!, draft)}>
                    Enviar por WhatsApp
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Copy size={13} />}
                  onClick={() => {
                    navigator.clipboard?.writeText(draft);
                    showToast("Mensaje copiado", "success");
                  }}
                >
                  Copiar
                </Button>
                <Button variant="ghost" size="sm" iconLeft={<RotateCcw size={13} />} onClick={() => setDraft("")}>
                  Otra
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Chip({
  children,
  onClick,
  loading,
  disabled,
  primary,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  primary?: boolean;
  icon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: text.xs,
        fontWeight: weight.medium,
        cursor: disabled ? "default" : "pointer",
        border: `1px solid ${primary ? color.primary : color.border}`,
        background: primary ? color.primaryBg : color.surface2,
        color: primary ? color.primary : color.text,
        opacity: disabled && !loading ? 0.5 : 1,
      }}
    >
      {loading ? "…" : (
        <>
          {icon && <ClozrAiIcon size={12} />}
          {children}
        </>
      )}
    </button>
  );
}

export function AiPaywall({
  buying,
  onBuy,
  onBack,
}: {
  buying: string | null;
  onBuy: (pack: string) => void;
  onBack: () => void;
}) {
  return (
    <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: space[4], display: "flex", flexDirection: "column", gap: space[3] }}>
      <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
        <Lock size={15} style={{ color: color.textMuted }} />
        <span style={{ fontSize: text.sm, color: color.text, fontWeight: weight.medium }}>Te quedaste sin acciones de IA</span>
      </div>
      <div style={{ fontSize: text.xs, color: color.textDim }}>Comprá un pack para seguir generando mensajes. Pago único, no vencen.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
        {AI_PACKS.map((p) => (
          <div key={p.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
            <span style={{ fontSize: text.sm, color: color.text }}>
              <strong>{p.label}</strong> · {p.credits} acciones
            </span>
            <Button variant={p.popular ? "primary" : "secondary"} size="sm" loading={buying === p.key} disabled={!!buying} onClick={() => onBuy(p.key)}>
              {formatUsd(p.priceUsd)}
            </Button>
          </div>
        ))}
      </div>
      <button onClick={onBack} style={{ alignSelf: "flex-start", fontSize: text.xs, color: color.textMuted, background: "transparent", border: "none", cursor: "pointer" }}>
        ← Volver
      </button>
    </div>
  );
}
