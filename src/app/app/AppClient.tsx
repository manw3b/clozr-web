"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  clearSession,
  createBillingCheckout,
  createWorkspace,
  fetchMe,
  getToken,
  getWorkspaceId,
  requestCode,
  setToken,
  setWorkspaceId,
  verifyCode,
  WORKER_URL,
} from "@/lib/api";
import type { User, Workspace } from "@/lib/types";
import { PLANS, SEATS_UNLIMITED, formatArs, BILLING_TRIAL_DAYS, type PlanId } from "@/lib/types";
import Crm from "./Crm";

type Phase = "loading" | "auth" | "workspace" | "ready";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

function LogoMark({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-isotipo.svg" alt="Clozr" className={className} />
  );
}

export default function AppClient() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWs, setActiveWs] = useState<Workspace | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  async function loadMe() {
    try {
      const { user, workspaces } = await fetchMe();
      setUser(user);
      setWorkspaces(workspaces);
      const stored = getWorkspaceId();
      const active = workspaces.find((w) => w.id === stored) ?? workspaces[0];
      if (!active) {
        setPhase("workspace");
      } else {
        setWorkspaceId(active.id);
        setActiveWs(active);
        setPhase("ready");
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        setPhase("auth");
      } else {
        // Error de red / Worker: volvemos a auth con sesión intacta para reintentar.
        setPhase("auth");
      }
    }
  }

  useEffect(() => {
    // Vuelta de Google OAuth: el Worker redirige con #token=... o #error=...
    const hash = window.location.hash.slice(1);
    if (hash) {
      const params = new URLSearchParams(hash);
      const token = params.get("token");
      const err = params.get("error");
      if (token || err) {
        history.replaceState(null, "", window.location.pathname);
        if (token) {
          setToken(token);
          loadMe();
          return;
        }
        setAuthError(
          err === "email_not_verified"
            ? "Tu cuenta de Google no tiene el email verificado."
            : "No pudimos completar el ingreso con Google. Probá de nuevo.",
        );
        setPhase("auth");
        return;
      }
    }
    if (!getToken()) setPhase("auth");
    else loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "loading") {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="animate-pulse text-text-dim">Cargando…</div>
      </div>
    );
  }

  if (phase === "auth") {
    return (
      <AuthScreen
        initialError={authError}
        onAuthed={() => { setAuthError(null); setPhase("loading"); loadMe(); }}
      />
    );
  }

  if (phase === "workspace") {
    return (
      <WorkspaceSetup
        onCreated={(w) => {
          setWorkspaceId(w.id);
          setActiveWs(w);
          setWorkspaces((prev) => [...prev, w]);
          setPhase("ready");
        }}
      />
    );
  }

  return (
    <Crm
      user={user!}
      workspace={activeWs!}
      workspaces={workspaces}
      onSwitchWorkspace={(w) => {
        setWorkspaceId(w.id);
        setActiveWs(w);
      }}
      onLogout={() => {
        clearSession();
        setUser(null);
        setActiveWs(null);
        setPhase("auth");
      }}
    />
  );
}

/* ───────────────────────── Auth ───────────────────────── */
function AuthScreen({
  onAuthed,
  initialError,
}: {
  onAuthed: () => void;
  initialError?: string | null;
}) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  function googleLogin() {
    const redirect = `${window.location.origin}/app`;
    window.location.href = `${WORKER_URL}/auth/google/start?redirect=${encodeURIComponent(redirect)}`;
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestCode(email.trim().toLowerCase());
      setStep("code");
    } catch {
      setError("No pudimos enviar el código. Revisá el email e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await verifyCode(email.trim().toLowerCase(), code);
      onAuthed();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "error";
      setError(
        code === "invalid_code" || code === "expired"
          ? "Código inválido o vencido. Pedí uno nuevo."
          : "No pudimos verificar el código.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <LogoMark />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Entrá a Clozr</h1>
            <p className="mt-1 text-sm text-text-muted">
              {step === "email"
                ? "Te mandamos un código a tu email."
                : `Escribí el código que enviamos a ${email}.`}
            </p>
          </div>
        </div>

        {step === "email" ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={googleLogin}
              className="flex items-center justify-center gap-2.5 rounded-lg border border-border-strong bg-white py-3 font-semibold text-[#1f1f1f] transition hover:bg-gray-100"
            >
              <GoogleIcon /> Continuar con Google
            </button>
            <div className="flex items-center gap-3 py-1 text-xs text-text-dim">
              <span className="h-px flex-1 bg-border" /> o con tu email <span className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={sendCode} className="flex flex-col gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="rounded-lg border border-border bg-surface-2 px-4 py-3 outline-none focus:border-primary"
              />
              <button
                disabled={busy}
                className="rounded-lg bg-primary py-3 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
              >
                {busy ? "Enviando…" : "Enviar código"}
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={confirm} className="flex flex-col gap-3">
            <input
              inputMode="numeric"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none focus:border-primary"
            />
            <button
              disabled={busy}
              className="rounded-lg bg-primary py-3 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? "Verificando…" : "Ingresar"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); setError(null); }}
              className="text-sm text-text-dim hover:text-text"
            >
              ← Cambiar email
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

/* ─────────────────── Crear workspace + elegir plan ─────────────────── */
function WorkspaceSetup({ onCreated }: { onCreated: (w: Workspace) => void }) {
  const [step, setStep] = useState<"name" | "plan">("name");
  const [name, setName] = useState("");
  // El workspace se crea al elegir plan; lo guardamos para no duplicarlo si el
  // checkout falla y el usuario reintenta o decide entrar en Free.
  const [createdWs, setCreatedWs] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submitName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setStep("plan");
  }

  async function choosePlan(planId: PlanId) {
    setBusy(planId);
    setError(null);
    let w = createdWs;
    try {
      if (!w) {
        w = await createWorkspace(name.trim());
        setCreatedWs(w);
        setWorkspaceId(w.id); // el checkout resuelve el wid desde acá
      }
    } catch {
      setError("No pudimos crear el espacio. Intentá de nuevo.");
      setBusy(null);
      return;
    }
    if (planId === "free") {
      onCreated(w);
      return;
    }
    try {
      const { initPoint } = await createBillingCheckout(planId);
      window.location.assign(initPoint); // → Mercado Pago; al volver entra al /app
    } catch {
      // El espacio ya quedó creado en Free; que entre igual o reintente — el
      // plan se mejora luego desde Ajustes.
      setError("No pudimos iniciar el pago. Entrás en Free y mejorás el plan desde Ajustes cuando quieras.");
      setBusy(null);
    }
  }

  if (step === "name") {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <LogoMark />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Creá tu espacio</h1>
              <p className="mt-1 text-sm text-text-muted">
                Es donde van a vivir tus contactos y ventas. Podés invitar a tu
                equipo después.
              </p>
            </div>
          </div>
          <form onSubmit={submitName} className="flex flex-col gap-3">
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi empresa"
              className="rounded-lg border border-border bg-surface-2 px-4 py-3 outline-none focus:border-primary"
            />
            <button
              disabled={!name.trim()}
              className="rounded-lg bg-primary py-3 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              Continuar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoMark />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Elegí tu plan</h1>
            <p className="mt-1 text-sm text-text-muted">
              Empezá gratis o sumá a tu equipo. Lo cambiás cuando quieras.
            </p>
          </div>
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
                  disabled={busy !== null}
                  onClick={() => choosePlan(id)}
                  className={
                    isPaid
                      ? "mt-3 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
                      : "mt-3 w-full rounded-lg border border-border-strong bg-surface py-2.5 text-sm font-semibold transition hover:bg-border-strong disabled:opacity-50"
                  }
                >
                  {busy === id ? "Abriendo…" : id === "free" ? "Empezar gratis" : `Elegir ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-center text-xs text-text-dim">
          Los planes pagos incluyen {BILLING_TRIAL_DAYS} días de prueba y se cobran por Mercado Pago.
        </p>
        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
        <button
          type="button"
          onClick={() => {
            setStep("name");
            setError(null);
          }}
          className="mt-4 w-full text-center text-sm text-text-dim hover:text-text"
        >
          ← Volver
        </button>
      </div>
    </div>
  );
}
