"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Lock, Check, X } from "lucide-react";
import { Drawer } from "@/components/Drawer";
import { Button } from "@/components/Button";
import { useUIStore } from "@/store/uiStore";
import { color, radius, space, text, weight } from "@/tokens";
import { AI_PACKS, formatUsd } from "@/lib/types";
import * as api from "@/lib/api";

const EXAMPLES = [
  "¿Cuánto vendí este mes?",
  "Armame un WhatsApp para reactivar un cliente",
  "¿Qué productos tengo sin stock?",
];

/**
 * IA de Clozr — asistente conversacional con microtransacciones.
 * 1 mensaje gratis por workspace; después se compra un pack. Self-contained:
 * lanzador flotante + drawer (chat + paywall). Se monta una vez en el shell.
 */
export function ClozrAi() {
  const { showToast } = useUIStore();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<api.AiStatus | null>(null);
  const [messages, setMessages] = useState<api.AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    api.aiStatus().then(setStatus).catch(() => {});
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const freeLeft = status ? Math.max(0, status.freeLimit - status.freeUsed) : 0;
  const available = status ? freeLeft + status.credits : 0;

  async function send(textArg?: string) {
    const t = (textArg ?? input).trim();
    if (!t || sending) return;
    const next: api.AiChatMessage[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const r = await api.aiChat(next);
      setMessages([...next, { role: "assistant", content: r.reply }]);
      setStatus((s) => (s ? { ...s, ...r.wallet } : s));
    } catch (e) {
      if (e instanceof api.ApiError && (e.code === "no_credits" || e.status === 402)) {
        setMessages(messages); // revertir el bubble optimista
        setInput(t); // dejar el texto para reenviar tras comprar
        setShowPlans(true);
      } else if (e instanceof api.ApiError && e.status === 503) {
        setMessages(messages);
        showToast("La IA no está disponible en este momento.", "error");
      } else {
        setMessages(messages);
        showToast("No se pudo enviar. Probá de nuevo.", "error");
      }
    } finally {
      setSending(false);
    }
  }

  async function buy(packKey: string) {
    setBuying(packKey);
    try {
      const { initPoint } = await api.aiCheckout(packKey);
      window.location.assign(initPoint); // → Mercado Pago
    } catch (e) {
      const code = e instanceof api.ApiError ? e.code : "";
      showToast(
        code === "forbidden"
          ? "Solo el dueño puede comprar créditos de IA."
          : code === "billing_unavailable"
            ? "El cobro no está disponible ahora."
            : "No pudimos iniciar la compra. Probá de nuevo.",
        "error",
      );
      setBuying(null);
    }
  }

  return (
    <>
      {/* Lanzador flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir IA de Clozr"
          style={{
            position: "fixed",
            right: 20,
            bottom: 84,
            zIndex: 60,
            display: "inline-flex",
            alignItems: "center",
            gap: space[2],
            padding: "10px 16px",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            background: color.primary,
            color: "#fff",
            fontSize: text.sm,
            fontWeight: weight.semibold,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <Sparkles size={18} />
          IA de Clozr
        </button>
      )}

      <Drawer open={open} onClose={() => setOpen(false)} title="IA de Clozr" subtitle="Tu asistente para cerrar ventas" width="440px">
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          {/* Chip de saldo + acceso a planes */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: space[2],
              padding: `${space[2]} 0`,
              borderBottom: `1px solid ${color.border}`,
              marginBottom: space[3],
            }}
          >
            <span style={{ fontSize: text.xs, color: color.textMuted }}>
              {status == null
                ? "—"
                : available > 0
                  ? `${available} mensaje${available === 1 ? "" : "s"} disponible${available === 1 ? "" : "s"}${freeLeft > 0 && status.credits === 0 ? " (gratis)" : ""}`
                  : "Sin mensajes — comprá un pack"}
            </span>
            <button
              onClick={() => setShowPlans((v) => !v)}
              style={{ fontSize: text.xs, color: color.primary, fontWeight: weight.semibold, background: "transparent", border: "none", cursor: "pointer" }}
            >
              {showPlans ? "Volver al chat" : "Ver planes"}
            </button>
          </div>

          {showPlans ? (
            <PlansPanel buying={buying} onBuy={buy} onClose={() => setShowPlans(false)} />
          ) : (
            <>
              {/* Mensajes */}
              <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: space[3], paddingRight: 2 }}>
                {messages.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: space[3], paddingTop: space[4] }}>
                    <div style={{ fontSize: text.sm, color: color.textMuted, lineHeight: 1.5 }}>
                      Preguntame sobre tus ventas, stock o clientes, o pedime que te redacte un mensaje. Tenés{" "}
                      <strong style={{ color: color.text }}>1 mensaje gratis</strong> para probar.
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
                      {EXAMPLES.map((ex) => (
                        <button
                          key={ex}
                          onClick={() => send(ex)}
                          style={{
                            textAlign: "left",
                            padding: "10px 12px",
                            borderRadius: radius.md,
                            border: `1px solid ${color.border}`,
                            background: color.surface2,
                            color: color.text,
                            fontSize: text.sm,
                            cursor: "pointer",
                          }}
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)
                )}
                {sending && <Bubble role="assistant" content="…" />}
              </div>

              {/* Composer */}
              <div style={{ display: "flex", gap: space[2], alignItems: "flex-end", paddingTop: space[3], borderTop: `1px solid ${color.border}`, marginTop: space[3] }}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Escribí tu mensaje…"
                  rows={1}
                  style={{
                    flex: 1,
                    resize: "none",
                    maxHeight: 120,
                    background: color.surface2,
                    border: `1px solid ${color.border}`,
                    borderRadius: radius.md,
                    padding: "10px 12px",
                    color: color.text,
                    fontSize: text.sm,
                    fontFamily: "inherit",
                    lineHeight: 1.4,
                  }}
                />
                <Button variant="primary" onClick={() => void send()} disabled={!input.trim() || sending} loading={sending} aria-label="Enviar">
                  <Send size={16} />
                </Button>
              </div>
            </>
          )}
        </div>
      </Drawer>
    </>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const mine = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "85%",
          padding: "8px 12px",
          borderRadius: radius.md,
          background: mine ? color.primary : color.surface2,
          color: mine ? "#fff" : color.text,
          fontSize: text.sm,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {content}
      </div>
    </div>
  );
}

function PlansPanel({
  buying,
  onBuy,
  onClose,
}: {
  buying: string | null;
  onBuy: (pack: string) => void;
  onClose: () => void;
}) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: space[3] }}>
      <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
        <Lock size={15} style={{ color: color.textMuted }} />
        <span style={{ fontSize: text.sm, color: color.textMuted }}>
          Usaste tu mensaje gratis. Elegí un pack para seguir.
        </span>
      </div>
      {AI_PACKS.map((p) => (
        <div
          key={p.key}
          style={{
            border: `1px solid ${p.popular ? color.primary : color.border}`,
            borderRadius: radius.lg,
            padding: space[4],
            display: "flex",
            alignItems: "center",
            gap: space[3],
            position: "relative",
          }}
        >
          {p.popular && (
            <span style={{ position: "absolute", top: -9, left: 14, background: color.primary, color: "#fff", fontSize: 10, fontWeight: weight.bold, padding: "2px 8px", borderRadius: 999 }}>
              RECOMENDADO
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: text.md, fontWeight: weight.bold, color: color.text }}>
              {p.label} <span style={{ color: color.textMuted, fontWeight: 400, fontSize: text.sm }}>· {p.credits} mensajes</span>
            </div>
            <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 2 }}>{p.blurb}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: text.md, fontWeight: weight.bold, color: color.text }}>{formatUsd(p.priceUsd)}</div>
            <Button variant={p.popular ? "primary" : "secondary"} size="sm" loading={buying === p.key} disabled={!!buying} onClick={() => onBuy(p.key)}>
              <Check size={13} style={{ marginRight: 4 }} /> Comprar
            </Button>
          </div>
        </div>
      ))}
      <button
        onClick={onClose}
        style={{ alignSelf: "center", fontSize: text.xs, color: color.textMuted, background: "transparent", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, marginTop: space[1] }}
      >
        <X size={12} /> Cerrar planes
      </button>
      <div style={{ fontSize: 11, color: color.textDim, textAlign: "center", lineHeight: 1.5 }}>
        Pago único por Mercado Pago. Los créditos no vencen.
      </div>
    </div>
  );
}
