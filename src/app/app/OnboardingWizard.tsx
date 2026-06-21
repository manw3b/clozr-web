"use client";

import { useMemo, useState } from "react";
import * as api from "@/lib/api";
import { setWorkspaceId } from "@/lib/api";
import type { User, Workspace } from "@/lib/types";
import { PLANS, SEATS_UNLIMITED, BILLING_TRIAL_DAYS, formatArs, type PlanId } from "@/lib/types";

/**
 * Onboarding guiado (multi-paso) que reemplaza el alta de un solo campo.
 * 100% frontend sobre endpoints que ya existen:
 *   - updateMyName (PATCH /me)        → tu nombre, si falta
 *   - createWorkspace + updateWorkspace → negocio (nombre + rubro + objetivo)
 *   - inviteMember                     → invitar al equipo (opcional)
 *
 * Pasos: bienvenida → [tu nombre] → tu negocio → invitar equipo → listo.
 * El paso "tu nombre" se omite si ya lo tenemos (p.ej. login con Google).
 */

const INDUSTRIES = [
  "Celulares y tecnología",
  "Indumentaria y calzado",
  "Kiosco / almacén",
  "Servicios",
  "Otro",
];

const INVITE_ROLES: { value: "vendedor" | "admin" | "viewer"; label: string }[] = [
  { value: "vendedor", label: "Vendedor" },
  { value: "admin", label: "Encargado" },
  { value: "viewer", label: "Solo lectura" },
];

type Step = "welcome" | "name" | "business" | "plan" | "team" | "done";
type Invite = { email: string; role: "vendedor" | "admin" | "viewer" };

function LogoMark({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-isotipo.svg" alt="Clozr" className={className} />
  );
}

export default function OnboardingWizard({
  user,
  onNameChange,
  onComplete,
}: {
  user: User;
  onNameChange: (name: string) => void;
  onComplete: (w: Workspace) => void;
}) {
  const needsName = !user.name || !user.name.trim() || user.name === user.email;
  const steps = useMemo<Step[]>(
    () => (needsName ? ["welcome", "name", "business", "plan", "team", "done"] : ["welcome", "business", "plan", "team", "done"]),
    [needsName],
  );

  const [step, setStep] = useState<Step>("welcome");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // datos
  const [name, setName] = useState(needsName ? "" : user.name ?? "");
  const [bizName, setBizName] = useState("");
  const [industry, setIndustry] = useState<string | null>(null);
  const [industryOther, setIndustryOther] = useState("");
  const [goal, setGoal] = useState("");
  const [goalCur, setGoalCur] = useState("ARS");
  const [invites, setInvites] = useState<Invite[]>([{ email: "", role: "vendedor" }]);
  const [createdWs, setCreatedWs] = useState<Workspace | null>(null);
  const [planBusy, setPlanBusy] = useState<PlanId | null>(null);
  const [seatLimitHit, setSeatLimitHit] = useState(false);

  const idx = steps.indexOf(step);
  const goNext = () => setStep(steps[Math.min(idx + 1, steps.length - 1)]);

  async function saveName() {
    const n = name.trim();
    if (!n) {
      setError("Escribí tu nombre.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updateMyName(n);
      onNameChange(n);
      goNext();
    } catch {
      setError("No pudimos guardar tu nombre. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function createBusiness() {
    const n = bizName.trim();
    if (!n) {
      setError("Poné el nombre de tu negocio.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Si ya lo creamos (volver/reintentar), no duplicar: solo actualizar.
      const ws = createdWs ?? (await api.createWorkspace(n));
      setWorkspaceId(ws.id);
      const resolvedIndustry = industry === "Otro" ? industryOther.trim() : industry ?? "";
      const amount = goal ? Number(goal) : 0;
      await api.updateWorkspace({
        name: n,
        industry: resolvedIndustry || undefined,
        dailyGoal: amount,
        dailyGoalCurrency: goalCur,
      });
      const ready: Workspace = {
        ...ws,
        name: n,
        dailyGoal: amount,
        dailyGoalCurrency: goalCur,
      };
      setCreatedWs(ready);
      goNext();
    } catch {
      setError("No pudimos crear el espacio. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function choosePlan(planId: PlanId) {
    if (planId === "free") {
      goNext();
      return;
    }
    if (!createdWs) {
      setError("Primero creá tu espacio.");
      return;
    }
    setPlanBusy(planId);
    setError(null);
    try {
      setWorkspaceId(createdWs.id); // el checkout resuelve el wid desde acá
      const { initPoint } = await api.createBillingCheckout(planId);
      window.location.assign(initPoint); // → Mercado Pago; al volver entra al /app
    } catch {
      setError("No pudimos iniciar el pago. Seguí en Free y mejorá el plan luego desde Ajustes.");
      setPlanBusy(null);
    }
  }

  async function sendInvites() {
    const valid = invites
      .map((i) => ({ ...i, email: i.email.trim().toLowerCase() }))
      .filter((i) => i.email);
    if (valid.length === 0) {
      goNext();
      return;
    }
    setBusy(true);
    setError(null);
    setSeatLimitHit(false);
    const failed: string[] = [];
    let seatLimit = false;
    for (const inv of valid) {
      try {
        await api.inviteMember(inv.email, inv.role);
      } catch (e) {
        // Free = 1 asiento: invitar requiere un plan pago → lo mostramos como CTA.
        if (e instanceof api.ApiError && e.code === "seat_limit") seatLimit = true;
        else failed.push(inv.email);
      }
    }
    setBusy(false);
    if (seatLimit) {
      setSeatLimitHit(true);
      return;
    }
    if (failed.length > 0) {
      setError(`No pudimos invitar a: ${failed.join(", ")}. Podés intentarlo después desde Equipo.`);
      return;
    }
    goNext();
  }

  function finish() {
    if (createdWs) onComplete(createdWs);
  }

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md">
        {step !== "welcome" && step !== "done" && (
          <StepDots total={steps.length - 2} current={idx - 1} />
        )}

        {step === "welcome" && (
          <Centered>
            <LogoMark className="h-14 w-auto" />
            <h1 className="text-2xl font-bold tracking-tight">
              {needsName ? "Bienvenido a Clozr" : `Bienvenido, ${user.name}`}
            </h1>
            <p className="text-sm text-text-muted">
              En menos de un minuto dejamos tu espacio listo para vender. Vamos paso a paso.
            </p>
            <button
              onClick={goNext}
              className="mt-2 w-full rounded-lg bg-primary py-3 font-semibold text-white transition hover:bg-primary-hover"
            >
              Empezar
            </button>
          </Centered>
        )}

        {step === "name" && (
          <Form onSubmit={saveName}>
            <Heading title="¿Cómo te llamás?" subtitle="Así personalizamos tu día a día en Clozr." />
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              className={fieldCls}
            />
            <Primary busy={busy} label="Continuar" />
          </Form>
        )}

        {step === "business" && (
          <Form onSubmit={createBusiness}>
            <Heading title="Tu negocio" subtitle="Es donde van a vivir tus contactos y ventas." />
            <div>
              <Label>Nombre del negocio</Label>
              <input
                autoFocus
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                placeholder="Ej: Electrónica García"
                className={fieldCls}
              />
            </div>

            <div>
              <Label>¿A qué te dedicás? <span className="font-normal text-text-dim">(opcional)</span></Label>
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((it) => {
                  const active = industry === it;
                  return (
                    <button
                      type="button"
                      key={it}
                      onClick={() => setIndustry(it)}
                      className={
                        "rounded-full border px-3 py-1.5 text-sm transition " +
                        (active
                          ? "border-primary text-text"
                          : "border-border bg-surface-2 text-text-muted hover:border-border-strong")
                      }
                      style={active ? { background: "var(--primary-bg)" } : undefined}
                    >
                      {it}
                    </button>
                  );
                })}
              </div>
              {industry === "Otro" && (
                <input
                  value={industryOther}
                  onChange={(e) => setIndustryOther(e.target.value)}
                  placeholder="¿Cuál?"
                  className={fieldCls + " mt-2"}
                />
              )}
            </div>

            <div>
              <Label>Objetivo de ventas del día <span className="font-normal text-text-dim">(opcional)</span></Label>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="0"
                  className={fieldCls + " flex-1"}
                />
                <select
                  value={goalCur}
                  onChange={(e) => setGoalCur(e.target.value)}
                  className="rounded-lg border border-border bg-surface-2 px-3 outline-none focus:border-primary"
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <Primary busy={busy} label="Crear espacio" />
          </Form>
        )}

        {step === "plan" && (
          <Centered align="stretch">
            <div className="text-center">
              <Heading title="Elegí tu plan" subtitle="Empezá gratis o sumá a tu equipo. Lo cambiás cuando quieras." />
            </div>
            <div className="flex flex-col gap-3">
              {(["free", "pro", "team"] as PlanId[]).map((id) => {
                const p = PLANS[id];
                const isPaid = id !== "free";
                const seatsLabel =
                  p.seats >= SEATS_UNLIMITED
                    ? "Asientos ilimitados"
                    : `${p.seats} ${p.seats === 1 ? "asiento" : "asientos"}`;
                return (
                  <div key={id} className="rounded-xl border border-border bg-surface-2 p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold">{p.name}</span>
                      <span className="text-sm text-text-muted">
                        {p.priceArs > 0 ? `${formatArs(p.priceArs)}/mes` : "Gratis"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-dim">
                      {seatsLabel} · {p.tagline}
                    </p>
                    <button
                      type="button"
                      disabled={planBusy !== null}
                      onClick={() => choosePlan(id)}
                      className={
                        isPaid
                          ? "mt-3 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
                          : "mt-3 w-full rounded-lg border border-border-strong bg-surface py-2.5 text-sm font-semibold transition hover:bg-border-strong disabled:opacity-50"
                      }
                    >
                      {planBusy === id ? "Abriendo…" : id === "free" ? "Seguir en Free" : `Elegir ${p.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-center text-xs text-text-dim">
              Los planes pagos incluyen {BILLING_TRIAL_DAYS} días de prueba y se cobran por Mercado Pago.
            </p>
          </Centered>
        )}

        {step === "team" && (
          <Centered align="stretch">
            <div className="text-center">
              <Heading title="Invitá a tu equipo" subtitle="Sumá a quien venda con vos. Podés saltarlo y hacerlo después." />
            </div>
            {seatLimitHit && (
              <div className="rounded-lg border border-border bg-surface-2 p-3 text-center">
                <p className="text-sm font-semibold text-text">Tu plan Free incluye 1 asiento</p>
                <p className="mt-1 text-xs text-text-dim">
                  Para sumar a tu equipo necesitás un plan con más asientos.
                </p>
                <button
                  type="button"
                  onClick={() => { setSeatLimitHit(false); setStep("plan"); }}
                  className="mt-2 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
                >
                  Mejorá tu plan
                </button>
              </div>
            )}
            <div className="flex flex-col gap-2">


              {invites.map((inv, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="email"
                    value={inv.email}
                    onChange={(e) =>
                      setInvites((prev) => prev.map((p, j) => (j === i ? { ...p, email: e.target.value } : p)))
                    }
                    placeholder="email@ejemplo.com"
                    className={fieldCls + " flex-1"}
                  />
                  <select
                    value={inv.role}
                    onChange={(e) =>
                      setInvites((prev) =>
                        prev.map((p, j) => (j === i ? { ...p, role: e.target.value as Invite["role"] } : p)),
                      )
                    }
                    className="rounded-lg border border-border bg-surface-2 px-2 text-sm outline-none focus:border-primary"
                  >
                    {INVITE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setInvites((prev) => [...prev, { email: "", role: "vendedor" }])}
                className="self-start text-sm font-semibold text-primary hover:underline"
              >
                + Agregar otro
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              <button
                onClick={sendInvites}
                disabled={busy}
                className="w-full rounded-lg bg-primary py-3 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
              >
                {busy ? "Invitando…" : "Invitar y continuar"}
              </button>
              <button
                onClick={goNext}
                disabled={busy}
                className="w-full rounded-lg py-2 text-sm text-text-dim hover:text-text"
              >
                Saltar por ahora
              </button>
            </div>
          </Centered>
        )}

        {step === "done" && (
          <Centered>
            <div className="grid h-14 w-14 place-items-center rounded-full text-2xl" style={{ background: "var(--success-bg)" }}>🎉</div>
            <h1 className="text-2xl font-bold tracking-tight">¡Todo listo!</h1>
            <p className="text-sm text-text-muted">
              Tu espacio <strong className="text-text">{createdWs?.name}</strong> ya está armado. Cargá tu primer
              cliente o venta y empezá a cerrar.
            </p>
            <button
              onClick={finish}
              className="mt-2 w-full rounded-lg bg-primary py-3 font-semibold text-white transition hover:bg-primary-hover"
            >
              Entrar a Clozr
            </button>
          </Centered>
        )}

        {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

/* ───────── helpers de presentación ───────── */

const fieldCls =
  "w-full rounded-lg border border-border bg-surface-2 px-4 py-3 outline-none focus:border-primary";

function Centered({ children, align = "center" }: { children: React.ReactNode; align?: "center" | "stretch" }) {
  return (
    <div className={"flex flex-col gap-4 " + (align === "center" ? "items-center text-center" : "")}>{children}</div>
  );
}

function Form({ children, onSubmit }: { children: React.ReactNode; onSubmit: () => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      {children}
    </form>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">{children}</div>;
}

function Primary({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      disabled={busy}
      className="rounded-lg bg-primary py-3 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
    >
      {busy ? "Guardando…" : label}
    </button>
  );
}

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="mb-8 flex justify-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={"h-1.5 rounded-full transition-all " + (i <= current ? "w-6 bg-primary" : "w-1.5 bg-border")}
        />
      ))}
    </div>
  );
}
