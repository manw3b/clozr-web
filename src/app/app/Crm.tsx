"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import {
  CLIENT_TYPE_LABELS,
  CLIENT_TYPES,
  PRIORITIES,
  PRIORITY_LABELS,
  SOURCE_LABELS,
  SOURCES,
} from "@/lib/types";
import type {
  ClientType,
  Currency,
  Customer,
  LeadPriority,
  LeadSource,
  PipelineItem,
  PipelineStage,
  User,
  Workspace,
} from "@/lib/types";

/* ───────── helpers ───────── */
function initials(name: string) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}
function money(n: number | null | undefined, cur: Currency) {
  if (n == null) return "—";
  return cur === "USD"
    ? `US$ ${Number(n).toLocaleString("en-US")}`
    : `$ ${Number(n).toLocaleString("es-AR")}`;
}
const PRIORITY_PILL: Record<LeadPriority, string> = {
  hot: "bg-[rgba(239,68,68,0.12)] text-danger",
  high: "bg-[rgba(245,158,11,0.12)] text-warning",
  medium: "bg-[rgba(59,130,246,0.12)] text-info",
  low: "bg-surface text-text-dim",
};

type ModalState =
  | { kind: "customer"; id?: string }
  | { kind: "item"; id?: string; presetStageId?: string }
  | null;

type View = "dashboard" | "pipeline" | "clientes";

export default function Crm({
  user,
  workspace,
  onLogout,
}: {
  user: User;
  workspace: Workspace;
  workspaces: Workspace[];
  onSwitchWorkspace: (w: Workspace) => void;
  onLogout: () => void;
}) {
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1900);
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      let st = await api.listStages();
      if (st.length === 0) {
        await api.seedDefaultStages();
        st = await api.listStages();
      }
      const [cs, it] = await Promise.all([api.listCustomers(), api.listItems()]);
      setStages(st);
      setCustomers(cs);
      setItems(it);
    } catch (e) {
      setError(
        e instanceof api.ApiError && e.status === 403
          ? "No tenés permisos en este espacio."
          : "No pudimos cargar los datos. Reintentá.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  const refreshCustomers = () => api.listCustomers().then(setCustomers);
  const refreshItems = () => api.listItems().then(setItems);

  return (
    <div className="grid h-screen grid-cols-[240px_1fr]">
      {/* Sidebar */}
      <aside className="flex flex-col border-r border-border bg-surface p-3">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="grid h-9 w-9 -skew-x-6 place-items-center rounded-lg bg-primary text-lg font-extrabold tracking-tighter text-white">
            CZ
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{workspace.name}</div>
            <div className="text-xs text-text-dim capitalize">{workspace.role}</div>
          </div>
        </div>
        <nav className="mt-2 flex flex-col gap-0.5">
          {([
            ["dashboard", "◧", "Resumen"],
            ["pipeline", "▦", "Pipeline"],
            ["clientes", "☰", "Clientes"],
          ] as const).map(([v, ico, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                view === v
                  ? "bg-[rgba(225,29,72,0.12)] text-primary-hover"
                  : "text-text-muted hover:bg-surface-hover hover:text-text"
              }`}
            >
              <span className="w-4 text-center">{ico}</span> {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-border pt-2">
          <div className="px-3 py-1.5 text-xs text-text-dim">{user.email}</div>
          <button
            onClick={onLogout}
            className="w-full rounded-md px-3 py-2 text-left text-xs text-text-dim hover:bg-surface-hover hover:text-text"
          >
            ↩ Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-col overflow-hidden">
        <header className="flex items-center gap-4 border-b border-border bg-surface px-7 py-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {view === "dashboard" ? "Resumen" : view === "pipeline" ? "Pipeline" : "Clientes"}
            </h2>
            <p className="text-xs text-text-dim">
              {view === "dashboard"
                ? "Tu actividad de ventas de un vistazo"
                : view === "pipeline"
                  ? "Arrastrá las oportunidades entre etapas"
                  : "Tu cartera de contactos"}
            </p>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setModal({ kind: "customer" })}
            className="rounded-lg bg-surface-2 px-3.5 py-2 text-sm font-semibold transition hover:bg-border-strong"
          >
            + Cliente
          </button>
          <button
            onClick={() => setModal({ kind: "item" })}
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            + Oportunidad
          </button>
        </header>

        <div className="flex-1 overflow-auto p-7">
          {loading ? (
            <div className="animate-pulse text-text-dim">Cargando datos…</div>
          ) : error ? (
            <div className="flex flex-col items-start gap-3 text-text-muted">
              <p>{error}</p>
              <button
                onClick={loadAll}
                className="rounded-lg bg-surface-2 px-4 py-2 text-sm font-semibold hover:bg-border-strong"
              >
                Reintentar
              </button>
            </div>
          ) : view === "dashboard" ? (
            <Dashboard stages={stages} items={items} customers={customers} />
          ) : view === "pipeline" ? (
            <Pipeline
              stages={stages}
              items={items}
              onMove={async (item, stage) => {
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === item.id
                      ? { ...i, stageId: stage.id, stageName: stage.name, stageOrder: stage.order }
                      : i,
                  ),
                );
                try {
                  await api.moveItem(item.id, stage);
                  flash(`Movido a ${stage.name}`);
                } catch {
                  refreshItems();
                  flash("No se pudo mover");
                }
              }}
              onOpen={(id) => setModal({ kind: "item", id })}
              onAdd={(stageId) => setModal({ kind: "item", presetStageId: stageId })}
            />
          ) : (
            <Clientes customers={customers} items={items} onOpen={(id) => setModal({ kind: "customer", id })} />
          )}
        </div>
      </main>

      {/* Modales */}
      {modal?.kind === "customer" && (
        <CustomerModal
          customer={modal.id ? customers.find((c) => c.id === modal.id) : undefined}
          onClose={() => setModal(null)}
          onSaved={(msg) => { setModal(null); refreshCustomers(); flash(msg); }}
        />
      )}
      {modal?.kind === "item" && (
        <ItemModal
          item={modal.id ? items.find((i) => i.id === modal.id) : undefined}
          presetStageId={modal.presetStageId}
          stages={stages}
          customers={customers}
          onNeedCustomer={() => setModal({ kind: "customer" })}
          onClose={() => setModal(null)}
          onSaved={(msg) => { setModal(null); refreshItems(); flash(msg); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg border border-border-strong bg-surface-2 px-4 py-2.5 text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ───────── Dashboard ───────── */
function Dashboard({
  stages,
  items,
  customers,
}: {
  stages: PipelineStage[];
  items: PipelineItem[];
  customers: Customer[];
}) {
  const wonIds = new Set(stages.filter((s) => s.isWon).map((s) => s.id));
  const lostIds = new Set(stages.filter((s) => s.isLost).map((s) => s.id));
  const open = items.filter((i) => !wonIds.has(i.stageId) && !lostIds.has(i.stageId));
  const won = items.filter((i) => wonIds.has(i.stageId));
  const lost = items.filter((i) => lostIds.has(i.stageId));
  const sum = (arr: PipelineItem[], cur: Currency) =>
    arr.filter((i) => i.currency === cur).reduce((a, i) => a + (Number(i.amount) || 0), 0);
  const closed = won.length + lost.length;
  const conv = closed ? Math.round((won.length / closed) * 100) : 0;

  const kpis = [
    { label: "Oportunidades abiertas", value: String(open.length), sub: `${items.length} en total` },
    { label: "Pipeline (ARS)", value: money(sum(open, "ARS"), "ARS"), sub: "por cerrar", sm: true },
    { label: "Pipeline (USD)", value: money(sum(open, "USD"), "USD"), sub: "por cerrar", sm: true },
    { label: "Ganados", value: String(won.length), sub: `${conv}% de conversión` },
    { label: "Clientes", value: String(customers.length), sub: "en cartera" },
  ];

  return (
    <div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-surface p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-dim">{k.label}</div>
            <div className={`mt-1.5 font-extrabold tracking-tight ${k.sm ? "text-2xl" : "text-3xl"}`}>
              {k.value}
            </div>
            <div className="mt-1 text-xs text-text-muted">{k.sub}</div>
          </div>
        ))}
      </div>

      <h3 className="mb-3 mt-8 text-xs font-bold uppercase tracking-wider text-text-dim">
        Embudo por etapa
      </h3>
      <div className="flex max-w-xl flex-col gap-2">
        {stages.map((s) => {
          const n = items.filter((i) => i.stageId === s.id).length;
          const pct = items.length ? Math.round((n / items.length) * 100) : 0;
          return (
            <div key={s.id} className="flex items-center gap-3">
              <div className="w-32 text-sm font-medium text-text-muted">{s.name}</div>
              <div className="h-5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="flex h-full items-center justify-end pr-2 text-xs font-bold text-white"
                  style={{ width: `${pct}%`, minWidth: n ? 26 : 0, background: s.color }}
                >
                  {n || ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Pipeline (kanban) ───────── */
function Pipeline({
  stages,
  items,
  onMove,
  onOpen,
  onAdd,
}: {
  stages: PipelineStage[];
  items: PipelineItem[];
  onMove: (item: PipelineItem, stage: PipelineStage) => void;
  onOpen: (id: string) => void;
  onAdd: (stageId: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  return (
    <div className="flex items-start gap-3.5 overflow-x-auto pb-3">
      {stages.map((s) => {
        const colItems = items.filter((i) => i.stageId === s.id);
        const ars = colItems.filter((i) => i.currency === "ARS").reduce((a, i) => a + (Number(i.amount) || 0), 0);
        return (
          <div
            key={s.id}
            className="flex max-h-[calc(100vh-200px)] w-[270px] flex-none flex-col rounded-xl border border-border bg-surface"
          >
            <div className="flex items-center gap-2 px-3.5 pb-2.5 pt-3.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-sm font-bold">{s.name}</span>
              <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-text-muted">
                {colItems.length}
              </span>
            </div>
            <div className="px-3.5 pb-2.5 text-xs font-semibold text-text-dim">
              {ars ? money(ars, "ARS") : " "}
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setOverStage(s.id); }}
              onDragLeave={() => setOverStage((cur) => (cur === s.id ? null : cur))}
              onDrop={() => {
                setOverStage(null);
                const item = items.find((i) => i.id === dragId);
                if (item && item.stageId !== s.id) onMove(item, s);
                setDragId(null);
              }}
              className={`flex min-h-[60px] flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pb-2.5 ${
                overStage === s.id ? "rounded-lg outline-2 outline-dashed outline-primary -outline-offset-4" : ""
              }`}
            >
              {colItems.map((i) => (
                <div
                  key={i.id}
                  draggable
                  onDragStart={() => setDragId(i.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onOpen(i.id)}
                  className={`cursor-grab rounded-lg border border-border bg-surface-2 p-3 transition hover:border-border-strong hover:bg-surface-hover ${
                    dragId === i.id ? "opacity-40" : ""
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[rgba(225,29,72,0.2)] text-[11px] font-bold text-primary-hover">
                      {initials(i.customerName)}
                    </span>
                    <span className="truncate text-sm font-semibold">{i.customerName}</span>
                  </div>
                  {i.product && <div className="mb-2 truncate text-xs text-text-dim">{i.product}</div>}
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-sm font-bold">{money(i.amount, i.currency)}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PRIORITY_PILL[i.priority]}`}
                    >
                      {PRIORITY_LABELS[i.priority]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => onAdd(s.id)}
              className="m-2.5 rounded-lg border border-dashed border-border-strong py-2 text-xs font-semibold text-text-dim transition hover:border-primary hover:text-primary-hover"
            >
              + Oportunidad
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ───────── Clientes ───────── */
function Clientes({
  customers,
  items,
  onOpen,
}: {
  customers: Customer[];
  items: PipelineItem[];
  onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const query = q.toLowerCase();
  const rows = customers.filter(
    (c) =>
      !query ||
      c.name.toLowerCase().includes(query) ||
      (c.email ?? "").toLowerCase().includes(query) ||
      (c.phone ?? "").includes(query),
  );
  const TYPE_BADGE: Record<ClientType, string> = {
    empresa: "bg-[rgba(59,130,246,0.12)] text-info",
    mayorista: "bg-[rgba(225,29,72,0.12)] text-primary-hover",
    revendedor: "bg-[rgba(245,158,11,0.12)] text-warning",
    final: "bg-surface-2 text-text-muted",
  };

  return (
    <div>
      <div className="mb-4 max-w-sm">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono…"
          className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>
      {rows.length ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full border-collapse bg-surface">
            <thead>
              <tr>
                {["Nombre", "Tipo", "Teléfono", "Email", "Oportunidades"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-text-dim"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onOpen(c.id)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-hover"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 font-semibold">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[rgba(225,29,72,0.2)] text-[11px] font-bold text-primary-hover">
                        {initials(c.name)}
                      </span>
                      {c.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TYPE_BADGE[c.type]}`}>
                      {CLIENT_TYPE_LABELS[c.type]}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm ${c.phone ? "" : "text-text-dim"}`}>{c.phone || "—"}</td>
                  <td className={`px-4 py-3 text-sm ${c.email ? "" : "text-text-dim"}`}>{c.email || "—"}</td>
                  <td className="px-4 py-3 text-sm">{items.filter((i) => i.customerId === c.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-16 text-center text-text-dim">
          <div className="mb-3 text-4xl">☰</div>
          {customers.length ? "Sin resultados." : "Todavía no cargaste clientes."}
        </div>
      )}
    </div>
  );
}

/* ───────── Modal shell ───────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(2,6,23,0.7)] p-5 backdrop-blur-sm"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl border border-border-strong bg-surface shadow-2xl">
        <div className="flex items-center border-b border-border px-5 py-4">
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} className="ml-auto text-xl text-text-dim hover:text-text">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
const fieldCls =
  "w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary";
const labelCls = "text-xs font-semibold text-text-muted";

/* ───────── Customer modal ───────── */
function CustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [type, setType] = useState<ClientType>(customer?.type ?? "final");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const data = { name: name.trim(), phone, email, type, notes };
      if (customer) await api.updateCustomer(customer.id, data);
      else await api.createCustomer(data);
      onSaved(customer ? "Cliente actualizado" : "Cliente creado");
    } catch {
      setBusy(false);
    }
  }
  async function remove() {
    if (!customer || !confirm("¿Eliminar este cliente?")) return;
    setBusy(true);
    try {
      await api.deleteCustomer(customer.id);
      onSaved("Cliente eliminado");
    } catch {
      setBusy(false);
    }
  }

  return (
    <Modal title={customer ? "Editar cliente" : "Nuevo cliente"} onClose={onClose}>
      <div className="flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Nombre *</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Teléfono</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Tipo</span>
            <select value={type} onChange={(e) => setType(e.target.value as ClientType)} className={fieldCls}>
              {CLIENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CLIENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Notas</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fieldCls} min-h-16 resize-y`} />
        </label>
      </div>
      <div className="flex items-center gap-2.5 border-t border-border px-5 py-4">
        {customer && (
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-lg bg-[rgba(239,68,68,0.12)] px-3 py-2 text-sm font-semibold text-danger hover:bg-danger hover:text-white disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
        <div className="flex-1" />
        <button onClick={onClose} className="rounded-lg bg-surface-2 px-3.5 py-2 text-sm font-semibold hover:bg-border-strong">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={busy || !name.trim()}
          className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}

/* ───────── Item modal ───────── */
function ItemModal({
  item,
  presetStageId,
  stages,
  customers,
  onNeedCustomer,
  onClose,
  onSaved,
}: {
  item?: PipelineItem;
  presetStageId?: string;
  stages: PipelineStage[];
  customers: Customer[];
  onNeedCustomer: () => void;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [customerId, setCustomerId] = useState(item?.customerId ?? customers[0]?.id ?? "");
  const [product, setProduct] = useState(item?.product ?? "");
  const [amount, setAmount] = useState<string>(item?.amount != null ? String(item.amount) : "");
  const [currency, setCurrency] = useState<Currency>(item?.currency ?? "ARS");
  const [stageId, setStageId] = useState(item?.stageId ?? presetStageId ?? stages[0]?.id ?? "");
  const [priority, setPriority] = useState<LeadPriority>(item?.priority ?? "medium");
  const [source, setSource] = useState<LeadSource>(item?.source ?? "otro");
  const [busy, setBusy] = useState(false);

  if (customers.length === 0) {
    return (
      <Modal title="Necesitás un cliente" onClose={onClose}>
        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-text-muted">
            Primero creá un cliente para asociarle la oportunidad.
          </p>
          <button onClick={onNeedCustomer} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover">
            + Crear cliente
          </button>
        </div>
      </Modal>
    );
  }

  async function save() {
    const stage = stages.find((s) => s.id === stageId);
    const cust = customers.find((c) => c.id === customerId);
    if (!stage || !cust) return;
    setBusy(true);
    const data = {
      customerId: cust.id,
      customerName: cust.name,
      stage,
      amount: amount === "" ? null : Number(amount),
      currency,
      product,
      priority,
      source,
    };
    try {
      if (item) await api.updateItem(item.id, data);
      else await api.createItem(data);
      onSaved(item ? "Oportunidad actualizada" : "Oportunidad creada");
    } catch {
      setBusy(false);
    }
  }
  async function remove() {
    if (!item || !confirm("¿Eliminar esta oportunidad?")) return;
    setBusy(true);
    try {
      await api.deleteItem(item.id);
      onSaved("Oportunidad eliminada");
    } catch {
      setBusy(false);
    }
  }

  return (
    <Modal title={item ? "Editar oportunidad" : "Nueva oportunidad"} onClose={onClose}>
      <div className="flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Cliente *</span>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={fieldCls}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Producto / detalle</span>
          <input value={product} onChange={(e) => setProduct(e.target.value)} className={fieldCls} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Monto</span>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Moneda</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={fieldCls}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Etapa</span>
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={fieldCls}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Prioridad</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as LeadPriority)} className={fieldCls}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Origen</span>
          <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)} className={fieldCls}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2.5 border-t border-border px-5 py-4">
        {item && (
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-lg bg-[rgba(239,68,68,0.12)] px-3 py-2 text-sm font-semibold text-danger hover:bg-danger hover:text-white disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
        <div className="flex-1" />
        <button onClick={onClose} className="rounded-lg bg-surface-2 px-3.5 py-2 text-sm font-semibold hover:bg-border-strong">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}
