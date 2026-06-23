import { useCallback, useEffect, useState } from "react";
import { Plus, ShieldCheck, UserMinus, Mail, RefreshCw, KeyRound, Copy, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { confirmAsync } from "@/lib/confirmAsync";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { usePermissions } from "@/store/usePermissions";
import { color, radius, space, text, weight } from "@/tokens";
import * as api from "@/lib/api";
import { roleLabel } from "@/lib/permissions";
import type { Member, User } from "@/lib/types";
import { PLANS, SEATS_UNLIMITED, type PlanId } from "@/lib/types";

const INVITABLE_ROLES: Array<{ value: "admin" | "vendedor" | "viewer"; label: string; desc: string }> = [
  { value: "admin", label: "Encargado", desc: "Casi todo menos equipo y facturación: precios, catálogo, costos, borrar ventas." },
  { value: "vendedor", label: "Vendedor", desc: "Vende y cobra, crea clientes y leads, registra caja. No ve costos ni edita precios." },
  { value: "viewer", label: "Solo lectura", desc: "Ve todo, pero no crea ni edita nada." },
];

/** Qué puede hacer cada rol — leyenda visible en la sección de equipo. */
const ROLE_LEGEND: Array<{ label: string; desc: string }> = [
  { label: "Dueño", desc: "Control total: maneja el equipo, el plan y la facturación, y los ajustes del workspace. Incluye todo lo del Encargado." },
  { label: "Encargado", desc: "Casi todo: ve costos, edita precios, catálogo e inventario, borra ventas y clientes, regulariza y maneja pagos. No toca equipo ni facturación." },
  { label: "Vendedor", desc: "El día a día: crea ventas y cobra, crea y edita clientes y leads, registra caja. No ve costos, no edita precios ni borra." },
  { label: "Solo lectura", desc: "Ve la información del negocio pero no puede crear ni editar nada." },
];

function errMsg(e: unknown, fallback: string): string {
  const code = e instanceof api.ApiError ? e.code : "";
  const M: Record<string, string> = {
    already_member: "Ese email ya es miembro o tiene invitación pendiente.",
    invalid_email: "Email inválido.",
    invalid_role: "Rol inválido.",
    forbidden: "Tu rol no puede hacer eso.",
    only_owner_can_promote_to_owner: "Solo un Dueño puede crear otro Dueño.",
    cant_modify_self: "No podés cambiar tu propio rol.",
    cant_revoke_self: "No podés expulsarte a vos mismo.",
    workspace_needs_one_owner: "Tiene que haber al menos un Dueño activo.",
    seat_limit: "Llegaste al límite de asientos de tu plan.",
  };
  return M[code] ?? fallback;
}

/**
 * Vista Equipo — port web de clozr/src/features/settings/CloudTeamSection.tsx.
 * Gestiona los miembros del workspace cloud (listar, invitar, cambiar rol,
 * expulsar, generar código de acceso) vía el Worker (api.ts). Reescrita con
 * los componentes de Clozr (Card/Button/Input/Modal/Badge).
 */
export function Equipo({ user, onUpgrade }: { user: User; onUpgrade?: () => void }) {
  const { showToast } = useUIStore();
  const { can } = usePermissions();
  const activeWs = useWorkspaceStore((s) => s.activeWorkspace);
  const canManage = can("team.manage");
  const isOwner = can("billing.manage"); // solo el dueño puede mejorar el plan
  const planId = (activeWs?.plan as PlanId) ?? "free";
  const seats = activeWs?.seats ?? 1;

  const [members, setMembers] = useState<Member[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "vendedor" | "viewer">("vendedor");
  const [submitting, setSubmitting] = useState(false);
  const [codeModal, setCodeModal] = useState<
    null | { email: string; code: string; expiresInMin: number; generating?: boolean }
  >(null);
  // T3: el invite pegó el seat-gate (402). Mostramos un CTA para mejorar el plan.
  const [seatLimit, setSeatLimit] = useState(false);
  // Código de la tienda (join-by-code): cualquiera con el código entra como empleado.
  const [storeCode, setStoreCode] = useState<
    null | { code: string; role: string; expiresAt: string; generating?: boolean }
  >(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listMembers()
      .then(setMembers)
      .catch((e) => showToast(errMsg(e, "No se pudo cargar el equipo"), "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      showToast("Escribí un email", "error");
      return;
    }
    setSubmitting(true);
    setSeatLimit(false);
    try {
      await api.inviteMember(email, inviteRole);
      showToast(`Invitación enviada a ${email}`, "success");
      setInviteEmail("");
      setShowInvite(false);
      load();
    } catch (e) {
      // 402 seat_limit → CTA "mejorá tu plan" en vez de un toast de error.
      if (e instanceof api.ApiError && e.code === "seat_limit") {
        setSeatLimit(true);
      } else {
        showToast(errMsg(e, "No se pudo invitar"), "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(m: Member, newRole: string) {
    try {
      await api.patchMemberRole(m.id, newRole);
      showToast(`Rol actualizado a ${roleLabel(newRole)}`, "success");
      load();
    } catch (e) {
      showToast(errMsg(e, "No se pudo cambiar el rol"), "error");
    }
  }

  async function revoke(m: Member) {
    const ok = await confirmAsync({
      title: "Expulsar del equipo",
      message: `¿Expulsar a ${m.email} del equipo? Puede ser re-invitado luego.`,
      confirmText: "Expulsar",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.revokeMember(m.id);
      showToast(`${m.email} expulsado del equipo`, "success");
      load();
    } catch (e) {
      showToast(errMsg(e, "No se pudo expulsar"), "error");
    }
  }

  async function genCode(m: Member) {
    setCodeModal({ email: m.email, code: "", expiresInMin: 0, generating: true });
    try {
      const r = await api.issueAccessCode(m.id);
      setCodeModal({ email: r.email, code: r.code, expiresInMin: r.expiresInMin });
    } catch (e) {
      setCodeModal(null);
      showToast(errMsg(e, "No se pudo generar el código"), "error");
    }
  }

  function copyInstructions() {
    if (!codeModal) return;
    const txt = `Hola! Te sumé a Clozr.

1) Entrá a https://www.clozr.online/app
2) Email: ${codeModal.email}
3) Pedí el código por email y, si no te llega, usá este: ${codeModal.code}

El código vence en ${codeModal.expiresInMin} minutos.`;
    navigator.clipboard.writeText(txt).then(
      () => showToast("Instrucciones copiadas", "success"),
      () => showToast("No se pudo copiar", "error"),
    );
  }

  const roleLabel = (r: string) => (r === "admin" ? "Encargado" : r === "viewer" ? "Solo lectura" : "Vendedor");

  async function genStoreCode() {
    setStoreCode({ code: "", role: "vendedor", expiresAt: "", generating: true });
    try {
      const r = await api.createJoinCode("vendedor");
      setStoreCode(r);
    } catch (e) {
      setStoreCode(null);
      showToast(errMsg(e, "No se pudo generar el código"), "error");
    }
  }

  function copyStoreInstructions() {
    if (!storeCode || !storeCode.code) return;
    const venceTxt = storeCode.expiresAt ? new Date(storeCode.expiresAt).toLocaleDateString("es-AR") : "";
    const txt = `Hola! Te sumo a mi tienda en Clozr como ${roleLabel(storeCode.role)}.

1) Entrá a https://www.clozr.online/app
2) Iniciá sesión con tu email (te llega un código por mail)
3) Tocá "Ya me invitaron — entrar con código" y pegá: ${storeCode.code}${venceTxt ? `\n\nEl código vence el ${venceTxt}.` : ""}`;
    navigator.clipboard.writeText(txt).then(
      () => showToast("Invitación copiada", "success"),
      () => showToast("No se pudo copiar", "error"),
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5], height: "100%" }}>
      <PageHeader
        title="Equipo"
        subtitle="Cada miembro entra desde su PC con su email — sin compartir contraseñas."
        actions={
          <>
            <Button
              variant="ghost"
              size="md"
              iconLeft={<RefreshCw size={14} />}
              onClick={load}
              disabled={loading}
            />
            {canManage && (
              <Button
                variant="secondary"
                size="md"
                iconLeft={<KeyRound size={14} />}
                onClick={genStoreCode}
              >
                Código de la tienda
              </Button>
            )}
            {canManage && (
              <Button
                variant="primary"
                size="md"
                iconLeft={<Plus size={16} />}
                onClick={() => setShowInvite((v) => !v)}
              >
                Invitar miembro
              </Button>
            )}
          </>
        }
      />

      {seatLimit && (
        <Card padding={4}>
          <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                flexShrink: 0,
                background: color.primaryBg,
                color: color.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CreditCard size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>
                Llegaste al límite de asientos
              </div>
              <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 2 }}>
                Tu plan {PLANS[planId]?.name ?? "actual"} incluye{" "}
                {seats >= SEATS_UNLIMITED
                  ? "asientos ilimitados"
                  : `${seats} ${seats === 1 ? "asiento" : "asientos"}`}
                . {isOwner ? "Mejorá tu plan para sumar a tu equipo." : "Pedile al dueño que mejore el plan."}
              </div>
            </div>
            {isOwner && onUpgrade && (
              <Button variant="primary" size="sm" onClick={onUpgrade}>
                Mejorá tu plan
              </Button>
            )}
          </div>
        </Card>
      )}

      {showInvite && canManage && (
        <Card padding={5}>
          <form onSubmit={invite} style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
            <div>
              <div style={{ fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, marginBottom: space[1] }}>
                Email
              </div>
              <Input
                type="email"
                autoFocus
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="encargado@gmail.com"
                disabled={submitting}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
              {INVITABLE_ROLES.map((r) => (
                <label
                  key={r.value}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: space[3],
                    padding: `${space[2]} ${space[3]}`,
                    borderRadius: radius.md,
                    background: inviteRole === r.value ? color.primaryBg : color.surface2,
                    border: `1px solid ${inviteRole === r.value ? color.primary : color.border}`,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    value={r.value}
                    checked={inviteRole === r.value}
                    onChange={() => setInviteRole(r.value)}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 2 }}>{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: space[2] }}>
              <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
                Enviar invitación
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowInvite(false);
                  setInviteEmail("");
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Leyenda de roles — qué puede hacer cada uno */}
      <div style={{ marginBottom: space[4] }}>
        <Card>
          <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text, marginBottom: 10 }}>
            ¿Qué puede hacer cada rol?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ROLE_LEGEND.map((r) => (
              <div key={r.label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <ShieldCheck size={15} color={color.primary} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>{r.label}</span>
                  <span style={{ fontSize: text.xs, color: color.textDim }}> — {r.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {members === null ? (
        <div style={{ fontSize: text.sm, color: color.textDim, padding: space[6] }}>
          {loading ? "Cargando equipo…" : ""}
        </div>
      ) : members.length === 0 ? (
        <EmptyState title="Equipo vacío" description="Invitá a alguien para empezar a trabajar en equipo." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
          {members.map((m) => {
            const isSelf = m.email === user.email;
            const isPending = m.status === "invited";
            const isOwner = m.role === "owner";
            return (
              <Card key={m.id} padding={4}>
                <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.full,
                      background: isOwner ? color.primaryBg : color.surface2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <ShieldCheck size={18} color={isOwner ? color.primary : color.textDim} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text, display: "flex", gap: space[2], alignItems: "center" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.email}
                      </span>
                      {isSelf && <span style={{ fontSize: text.xs, color: color.textDim, fontWeight: weight.regular }}>(vos)</span>}
                    </div>
                    <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 2, display: "flex", gap: space[2], alignItems: "center" }}>
                      <strong style={{ color: color.textMuted }}>{roleLabel(m.role)}</strong>
                      {isPending && (
                        <Badge tone="warning" variant="soft" size="sm">
                          <Mail size={10} /> Invitación pendiente
                        </Badge>
                      )}
                    </div>
                  </div>

                  {canManage && !isSelf && !isOwner && (
                    <div style={{ display: "flex", gap: space[2], alignItems: "center" }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={<KeyRound size={13} />}
                        onClick={() => genCode(m)}
                        title="Generar código de acceso para compartir"
                      >
                        Código
                      </Button>
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m, e.target.value)}
                        className="select-trigger"
                        style={{
                          padding: "5px 8px",
                          fontSize: text.xs,
                          borderRadius: radius.sm,
                          color: color.text,
                        }}
                      >
                        <option value="admin">Encargado</option>
                        <option value="vendedor">Vendedor</option>
                        <option value="viewer">Solo lectura</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={<UserMinus size={13} />}
                        onClick={() => revoke(m)}
                        title="Expulsar"
                      />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={!!codeModal}
        onClose={() => setCodeModal(null)}
        title="Código de acceso"
        subtitle={codeModal ? `Compartíselo a ${codeModal.email} por WhatsApp.` : undefined}
        maxWidth={460}
      >
        {codeModal?.generating ? (
          <div style={{ textAlign: "center", padding: space[8], color: color.textDim, fontSize: text.sm }}>
            Generando código…
          </div>
        ) : codeModal ? (
          <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 36,
                fontWeight: weight.bold,
                letterSpacing: 6,
                padding: `${space[4]} ${space[5]}`,
                background: color.surface2,
                border: `2px solid ${color.borderStrong}`,
                borderRadius: radius.lg,
                textAlign: "center",
                color: color.text,
                userSelect: "all",
              }}
            >
              {codeModal.code.slice(0, 3)} {codeModal.code.slice(3)}
            </div>
            <Button variant="primary" iconLeft={<Copy size={14} />} onClick={copyInstructions} fullWidth>
              Copiar instrucciones completas
            </Button>
            <p style={{ fontSize: text.xs, color: color.textDim, margin: 0, lineHeight: 1.5 }}>
              Vence en <strong style={{ color: color.textMuted }}>{codeModal.expiresInMin} minutos</strong>. La
              persona entra en clozr.online/app con su email + este código.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!storeCode}
        onClose={() => setStoreCode(null)}
        title="Código de la tienda"
        subtitle="Cualquiera con este código entra como empleado de tu tienda."
        maxWidth={460}
      >
        {storeCode?.generating ? (
          <div style={{ textAlign: "center", padding: space[8], color: color.textDim, fontSize: text.sm }}>
            Generando código…
          </div>
        ) : storeCode ? (
          <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 32,
                fontWeight: weight.bold,
                letterSpacing: 6,
                padding: `${space[4]} ${space[5]}`,
                background: color.surface2,
                border: `2px solid ${color.borderStrong}`,
                borderRadius: radius.lg,
                textAlign: "center",
                color: color.text,
                userSelect: "all",
              }}
            >
              {storeCode.code}
            </div>
            <Button variant="primary" iconLeft={<Copy size={14} />} onClick={copyStoreInstructions} fullWidth>
              Copiar invitación
            </Button>
            <p style={{ fontSize: text.xs, color: color.textDim, margin: 0, lineHeight: 1.5 }}>
              Entra como <strong style={{ color: color.textMuted }}>{roleLabel(storeCode.role)}</strong>.
              {storeCode.expiresAt ? (
                <>
                  {" "}Vence el{" "}
                  <strong style={{ color: color.textMuted }}>
                    {new Date(storeCode.expiresAt).toLocaleDateString("es-AR")}
                  </strong>
                  .
                </>
              ) : null}
              {" "}Generar uno nuevo invalida el anterior.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
