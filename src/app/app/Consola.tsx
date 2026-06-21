import { useCallback, useEffect, useState } from "react";
import {
  Plus, Copy, Ban, CheckCircle2, RefreshCw, Ticket, Percent,
  Building2, Users, Mail, CreditCard, Gift, Search, Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { confirmAsync } from "@/lib/confirmAsync";
import { useUIStore } from "@/store/uiStore";
import { color, radius, space, text, weight } from "@/tokens";
import * as api from "@/lib/api";
import type { ConsoleCode, ConsoleCodeKind, ConsoleWorkspace, DiscountType } from "@/lib/api";
import { formatArs, CATALOG_PACKS, DISCOUNT_TARGETS, discountTargetLabel } from "@/lib/types";

/* ── helpers ─────────────────────────────────────────────────────────── */

type Tone = "neutral" | "success" | "warning" | "danger" | "primary" | "info";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function errMsg(e: unknown, fallback: string): string {
  const code = e instanceof api.ApiError ? e.code : "";
  const M: Record<string, string> = {
    forbidden: "No tenés acceso a la Consola.",
    unauthorized: "Tu sesión expiró. Volvé a entrar.",
    invalid_kind: "Tipo de código inválido.",
    invalid_plan: "Elegí un plan válido (Pro o Team).",
    invalid_discount_type: "Elegí un tipo de descuento.",
    invalid_discount_value: "El valor del descuento no es válido.",
    invalid_max_uses: "El límite de usos no es válido.",
    invalid_expires_at: "La fecha de vencimiento no es válida.",
    code_already_exists: "Ya existe un código con ese texto.",
  };
  return M[code] ?? fallback;
}

/* ── vista raíz (tabs) ───────────────────────────────────────────────── */

export function Consola() {
  const [tab, setTab] = useState<"accounts" | "codes">("accounts");

  const tabBtn = (value: "accounts" | "codes", label: string, Icon: typeof Ticket) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: space[2],
        padding: `${space[2]} ${space[4]}`,
        borderRadius: radius.md,
        background: tab === value ? color.primaryBg : color.surface2,
        border: `1px solid ${tab === value ? color.primary : color.border}`,
        color: tab === value ? color.primary : color.textMuted,
        fontSize: text.sm,
        fontWeight: weight.semibold,
        cursor: "pointer",
      }}
    >
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5], height: "100%" }}>
      <PageHeader title="Consola" subtitle="Administración de la plataforma Clozr." />
      <div style={{ display: "flex", gap: space[2] }}>
        {tabBtn("accounts", "Cuentas", Building2)}
        {tabBtn("codes", "Códigos", Ticket)}
      </div>
      {tab === "accounts" ? <AccountsPanel /> : <CodesPanel />}
    </div>
  );
}

/* ── panel: Cuentas (workspaces) ─────────────────────────────────────── */

function planBadge(plan: string): { tone: Tone; label: string } {
  if (plan === "team") return { tone: "primary", label: "Team" };
  if (plan === "pro") return { tone: "info", label: "Pro" };
  return { tone: "neutral", label: "Free" };
}

function statusBadge(status: string): { tone: Tone; label: string } | null {
  const M: Record<string, { tone: Tone; label: string }> = {
    trialing: { tone: "neutral", label: "En prueba" },
    pending: { tone: "neutral", label: "Pendiente" },
    past_due: { tone: "warning", label: "Pago pendiente" },
    cancelled: { tone: "danger", label: "Cancelado" },
  };
  return M[status] ?? null;
}

/** Cómo está pagando: suscripción MP real, licencia gratis, o nada (free). */
function billingKind(w: ConsoleWorkspace): { tone: Tone; label: string; icon: typeof CreditCard } | null {
  if (w.mpPreapprovalId) return { tone: "success", label: "Pago (MP)", icon: CreditCard };
  if (w.licenseExpiresAt) return { tone: "info", label: "Licencia", icon: Gift };
  return null;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 96,
        padding: `${space[3]} ${space[4]}`,
        borderRadius: radius.md,
        background: color.surface2,
        border: `1px solid ${color.border}`,
      }}
    >
      <div style={{ fontSize: text.xl, fontWeight: weight.bold, color: color.text }}>{value}</div>
      <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function AccountsPanel() {
  const { showToast } = useUIStore();
  const [data, setData] = useState<api.ConsoleWorkspacesResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .listConsoleWorkspaces()
      .then(setData)
      .catch((e) => showToast(errMsg(e, "No se pudieron cargar las cuentas"), "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const items = data?.items ?? [];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter(
        (w) => w.name.toLowerCase().includes(q) || (w.ownerEmail ?? "").toLowerCase().includes(q),
      )
    : items;

  const paid = items.filter((w) => w.mpPreapprovalId).length;
  const licensed = items.filter((w) => !w.mpPreapprovalId && w.licenseExpiresAt).length;
  const free = items.filter((w) => w.plan === "free").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[4] }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: space[2], flexWrap: "wrap" }}>
        <Stat label="Cuentas" value={items.length} />
        <Stat label="Pagas (MP)" value={paid} />
        <Stat label="Licencias" value={licensed} />
        <Stat label="Free" value={free} />
        <Stat label="Usuarios" value={data?.totalUsers ?? 0} />
      </div>

      {/* Búsqueda + refresh */}
      <div style={{ display: "flex", gap: space[2], alignItems: "center" }}>
        <div style={{ flex: 1, maxWidth: 360 }}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o email…"
            iconLeft={<Search size={14} />}
          />
        </div>
        <Button variant="ghost" size="md" iconLeft={<RefreshCw size={14} />} onClick={load} disabled={loading} />
      </div>

      {data === null ? (
        <div style={{ fontSize: text.sm, color: color.textDim, padding: space[6] }}>
          {loading ? "Cargando cuentas…" : ""}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "Sin cuentas todavía" : "Sin resultados"}
          description={items.length === 0 ? "Cuando alguien cree un espacio, aparece acá." : "Probá con otro término."}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
          {filtered.map((w) => {
            const pb = planBadge(w.plan);
            const sb = statusBadge(w.planStatus);
            const bk = billingKind(w);
            return (
              <Card key={w.id} padding={4}>
                <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.md,
                      flexShrink: 0,
                      background: color.surface2,
                      color: color.textMuted,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Building2 size={18} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
                      <span style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>
                        {w.name}
                      </span>
                      <Badge tone={pb.tone} variant="soft" size="sm">{pb.label}</Badge>
                      {bk && (
                        <Badge tone={bk.tone} variant="soft" size="sm">
                          <bk.icon size={10} /> {bk.label}
                        </Badge>
                      )}
                      {sb && <Badge tone={sb.tone} variant="soft" size="sm">{sb.label}</Badge>}
                    </div>
                    <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 2, display: "flex", gap: space[3], flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Mail size={11} /> {w.ownerEmail ?? "—"}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Users size={11} /> {w.memberCount} {w.memberCount === 1 ? "miembro" : "miembros"}
                      </span>
                      <span>Creada {fmtDate(w.createdAt)}</span>
                      {w.licenseExpiresAt && <span>Licencia vence {fmtDate(w.licenseExpiresAt)}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── panel: Códigos ──────────────────────────────────────────────────── */

function codeStatus(c: ConsoleCode): { tone: Tone; label: string } {
  if (c.disabledAt) return { tone: "neutral", label: "Deshabilitado" };
  if (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()) return { tone: "danger", label: "Vencido" };
  if (c.maxUses != null && c.uses >= c.maxUses) return { tone: "warning", label: "Agotado" };
  return { tone: "success", label: "Activo" };
}

function benefitLabel(c: ConsoleCode): string {
  if (c.kind === "license") {
    const plan = c.plan ? cap(c.plan) : "Pro";
    return c.durationDays ? `Plan ${plan} · ${c.durationDays} días` : `Plan ${plan} · sin vencimiento`;
  }
  if (c.kind === "unlock") {
    const key = (c.target ?? "").replace(/^catalog:/, "");
    return `Desbloquea catálogo ${key || "premium"}`;
  }
  const tgt = c.target && c.target !== "all" ? ` en ${discountTargetLabel(c.target).toLowerCase()}` : "";
  if (c.discountType === "percent") return `${c.discountValue ?? 0}% de descuento${tgt}`;
  return `USD ${c.discountValue ?? 0} de descuento${tgt}`;
}

function CodesPanel() {
  const { showToast } = useUIStore();
  const [codes, setCodes] = useState<ConsoleCode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listConsoleCodes()
      .then(setCodes)
      .catch((e) => showToast(errMsg(e, "No se pudieron cargar los códigos"), "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function copy(code: string) {
    navigator.clipboard.writeText(code).then(
      () => showToast("Código copiado", "success"),
      () => showToast("No se pudo copiar", "error"),
    );
  }

  async function toggleDisabled(c: ConsoleCode) {
    const disabling = !c.disabledAt;
    if (disabling) {
      const ok = await confirmAsync({
        title: "Deshabilitar código",
        message: `El código ${c.code} dejará de poder canjearse. Podés volver a habilitarlo después.`,
        confirmText: "Deshabilitar",
        tone: "danger",
      });
      if (!ok) return;
    }
    try {
      await api.updateConsoleCode(c.id, { disabled: disabling });
      showToast(disabling ? "Código deshabilitado" : "Código habilitado", "success");
      load();
    } catch (e) {
      showToast(errMsg(e, "No se pudo actualizar el código"), "error");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[4] }}>
      <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
        <div style={{ flex: 1, fontSize: text.sm, color: color.textDim }}>
          Licencia (activa un plan gratis) o descuento. Compartilos para que el dueño los canjee en Ajustes.
        </div>
        <Button variant="ghost" size="md" iconLeft={<RefreshCw size={14} />} onClick={load} disabled={loading} />
        <Button variant="primary" size="md" iconLeft={<Plus size={16} />} onClick={() => setShowCreate(true)}>
          Nuevo código
        </Button>
      </div>

      {codes === null ? (
        <div style={{ fontSize: text.sm, color: color.textDim, padding: space[6] }}>
          {loading ? "Cargando códigos…" : ""}
        </div>
      ) : codes.length === 0 ? (
        <EmptyState
          title="Sin códigos todavía"
          description="Creá un código de licencia (activa un plan gratis) o de descuento para compartir."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
          {codes.map((c) => {
            const st = codeStatus(c);
            const Icon = c.kind === "license" ? Ticket : c.kind === "unlock" ? Sparkles : Percent;
            return (
              <Card key={c.id} padding={4}>
                <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.md,
                      flexShrink: 0,
                      background: color.primaryBg,
                      color: color.primary,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: text.sm,
                          fontWeight: weight.bold,
                          letterSpacing: 1,
                          color: color.text,
                        }}
                      >
                        {c.code}
                      </span>
                      <Badge tone={st.tone} variant="soft" size="sm">
                        {st.label}
                      </Badge>
                    </div>
                    <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 2 }}>
                      {benefitLabel(c)} · {c.uses}
                      {c.maxUses != null ? ` / ${c.maxUses}` : ""} {c.maxUses != null ? "usos" : "usos (ilimitado)"}
                      {c.expiresAt ? ` · vence ${fmtDate(c.expiresAt)}` : ""}
                      {c.note ? ` · ${c.note}` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: space[2], alignItems: "center", flexShrink: 0 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      iconLeft={<Copy size={13} />}
                      onClick={() => copy(c.code)}
                      title="Copiar código"
                    >
                      Copiar
                    </Button>
                    <Button
                      variant={c.disabledAt ? "success" : "ghost"}
                      size="sm"
                      iconLeft={c.disabledAt ? <CheckCircle2 size={13} /> : <Ban size={13} />}
                      onClick={() => toggleDisabled(c)}
                      title={c.disabledAt ? "Habilitar" : "Deshabilitar"}
                    >
                      {c.disabledAt ? "Habilitar" : "Deshabilitar"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateCodeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(c) => {
          setShowCreate(false);
          setCodes((prev) => (prev ? [c, ...prev] : [c]));
          showToast(`Código ${c.code} creado`, "success");
        }}
      />
    </div>
  );
}

/* ── modal de creación de código ─────────────────────────────────────── */

function CreateCodeModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: ConsoleCode) => void;
}) {
  const { showToast } = useUIStore();
  const [kind, setKind] = useState<ConsoleCodeKind>("license");
  const [plan, setPlan] = useState<"pro" | "team">("pro");
  const [durationDays, setDurationDays] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [discountTarget, setDiscountTarget] = useState("all");
  const [catalog, setCatalog] = useState("apple");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset al abrir.
  useEffect(() => {
    if (open) {
      setKind("license");
      setPlan("pro");
      setDurationDays("");
      setDiscountType("percent");
      setDiscountValue("");
      setDiscountTarget("all");
      setCatalog("apple");
      setMaxUses("");
      setExpiresAt("");
      setNote("");
      setCustomCode("");
      setSubmitting(false);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "discount") {
      const v = Number(discountValue);
      if (!v || v <= 0) {
        showToast("Ingresá un valor de descuento mayor a 0", "error");
        return;
      }
      if (discountType === "percent" && v > 100) {
        showToast("El porcentaje no puede ser mayor a 100", "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      const created = await api.createConsoleCode({
        kind,
        ...(kind === "license"
          ? {
              plan,
              durationDays: durationDays.trim() ? Number(durationDays) : null,
            }
          : kind === "discount"
            ? {
                discountType,
                discountValue: Number(discountValue),
                target: discountTarget,
              }
            : { target: `catalog:${catalog}` }),
        maxUses: maxUses.trim() ? Number(maxUses) : null,
        // Fin del día (UTC) de la fecha elegida — el código vale durante ese día.
        expiresAt: expiresAt.trim() ? `${expiresAt}T23:59:59Z` : null,
        note: note.trim() || null,
        code: customCode.trim() || undefined,
      });
      onCreated(created);
    } catch (e) {
      showToast(errMsg(e, "No se pudo crear el código"), "error");
      setSubmitting(false);
    }
  }

  const kindTab = (value: ConsoleCodeKind, label: string, Icon: typeof Ticket) => (
    <button
      type="button"
      onClick={() => setKind(value)}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: space[2],
        padding: `${space[2]} ${space[3]}`,
        borderRadius: radius.md,
        background: kind === value ? color.primaryBg : color.surface2,
        border: `1px solid ${kind === value ? color.primary : color.border}`,
        color: kind === value ? color.primary : color.textMuted,
        fontSize: text.sm,
        fontWeight: weight.semibold,
        cursor: "pointer",
      }}
    >
      <Icon size={15} /> {label}
    </button>
  );

  const labelStyle = { fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, marginBottom: space[1] };
  const selectCls = "select-trigger";
  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 10px",
    fontSize: text.sm,
    borderRadius: radius.md,
    color: color.text,
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo código" subtitle="Licencia (activa un plan gratis) o descuento." maxWidth={480}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
        <div style={{ display: "flex", gap: space[2] }}>
          {kindTab("license", "Licencia", Ticket)}
          {kindTab("discount", "Descuento", Percent)}
          {kindTab("unlock", "Desbloqueo", Sparkles)}
        </div>

        {kind === "license" ? (
          <div style={{ display: "flex", gap: space[2] }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Plan</div>
              <select value={plan} onChange={(e) => setPlan(e.target.value as "pro" | "team")} className={selectCls} style={selectStyle}>
                <option value="pro">Pro</option>
                <option value="team">Team</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Duración (días)</div>
              <Input
                type="number"
                min="1"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="Sin vencimiento"
                disabled={submitting}
              />
            </div>
          </div>
        ) : kind === "discount" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            <div style={{ display: "flex", gap: space[2] }}>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Tipo</div>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                  className={selectCls}
                  style={selectStyle}
                >
                  <option value="percent">Porcentaje (%)</option>
                  <option value="amount">Monto fijo (USD)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>{discountType === "percent" ? "Porcentaje" : "Monto (USD)"}</div>
                <Input
                  type="number"
                  min="1"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === "percent" ? "20" : "10"}
                  disabled={submitting}
                />
              </div>
            </div>
            <div>
              <div style={labelStyle}>Aplica a</div>
              <select value={discountTarget} onChange={(e) => setDiscountTarget(e.target.value)} className={selectCls} style={selectStyle}>
                {DISCOUNT_TARGETS.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div>
            <div style={labelStyle}>Catálogo a desbloquear</div>
            <select value={catalog} onChange={(e) => setCatalog(e.target.value)} className={selectCls} style={selectStyle}>
              {Object.values(CATALOG_PACKS).map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: "flex", gap: space[2] }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Límite de usos</div>
            <Input
              type="number"
              min="1"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Ilimitado"
              disabled={submitting}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Vence el</div>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={submitting} />
          </div>
        </div>

        <div>
          <div style={labelStyle}>Nota (opcional)</div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: campaña Instagram, cliente X…"
            disabled={submitting}
          />
        </div>

        <div>
          <div style={labelStyle}>Código personalizado (opcional)</div>
          <Input
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value)}
            placeholder="Se genera automáticamente"
            disabled={submitting}
          />
        </div>

        <div style={{ display: "flex", gap: space[2], marginTop: space[1] }}>
          <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
            Crear código
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
