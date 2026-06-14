"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  clearSession,
  createWorkspace,
  fetchMe,
  getToken,
  getWorkspaceId,
  requestCode,
  setWorkspaceId,
  verifyCode,
} from "@/lib/api";
import type { User, Workspace } from "@/lib/types";
import Crm from "./Crm";

type Phase = "loading" | "auth" | "workspace" | "ready";

function LogoMark({ size = "h-12 w-12 text-xl" }: { size?: string }) {
  return (
    <div
      className={`grid ${size} -skew-x-6 place-items-center rounded-xl bg-primary font-extrabold tracking-tighter text-white`}
    >
      CZ
    </div>
  );
}

export default function AppClient() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWs, setActiveWs] = useState<Workspace | null>(null);

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
    if (!getToken()) setPhase("auth");
    else loadMe();
  }, []);

  if (phase === "loading") {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="animate-pulse text-text-dim">Cargando…</div>
      </div>
    );
  }

  if (phase === "auth") {
    return <AuthScreen onAuthed={() => { setPhase("loading"); loadMe(); }} />;
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
function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoFocus
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

/* ─────────────────── Crear workspace ─────────────────── */
function WorkspaceSetup({ onCreated }: { onCreated: (w: Workspace) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const w = await createWorkspace(name.trim());
      onCreated(w);
    } catch {
      setError("No pudimos crear el espacio. Intentá de nuevo.");
      setBusy(false);
    }
  }

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
        <form onSubmit={create} className="flex flex-col gap-3">
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mi empresa"
            className="rounded-lg border border-border bg-surface-2 px-4 py-3 outline-none focus:border-primary"
          />
          <button
            disabled={busy}
            className="rounded-lg bg-primary py-3 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? "Creando…" : "Crear espacio"}
          </button>
        </form>
        {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
