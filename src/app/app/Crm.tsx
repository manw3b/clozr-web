"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import {
  CLIENT_TYPE_LABELS,
  CLIENT_TYPES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
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
  Sale,
  SaleDetail,
  User,
  Workspace,
} from "@/lib/types";
import { AppShell } from "@/layout/AppShell";
import type { NewAction } from "@/layout/Topbar";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmHost } from "@/components/ConfirmHost";
import Toaster from "@/components/Toaster";
import { Tareas } from "./Tareas";
import { Deudas } from "./Deudas";
import { Equipo } from "./Equipo";
import { Reportes } from "./Reportes";
import { Inventario } from "./Inventario";
import { MiDia } from "./MiDia";
import { Ajustes } from "./Ajustes";
import { Caja } from "./Caja";
import { CommandPalette } from "./CommandPalette";
import { Clientes as ClientesView } from "./Clientes";
import { Ventas as VentasView } from "./Ventas";
import { Pipeline as PipelineView } from "./Pipeline";

/* ───────── helpers ───────── */
function money(n: number | null | undefined, cur: Currency) {
  if (n == null) return "—";
  return cur === "USD"
    ? `US$ ${Number(n).toLocaleString("en-US")}`
    : `$ ${Number(n).toLocaleString("es-AR")}`;
}

type ModalState =
  | { kind: "customer"; id?: string }
  | { kind: "item"; id?: string; presetStageId?: string }
  | { kind: "sale" }
  | { kind: "saleDetail"; id: string }
  | null;

type View =
  | "home"
  | "pipeline"
  | "customers"
  | "sales"
  | "cash"
  | "deudas"
  | "inventory"
  | "tasks"
  | "reportes"
  | "team"
  | "settings";


export default function Crm({
  user,
  workspace,
  workspaces,
  onLogout,
}: {
  user: User;
  workspace: Workspace;
  workspaces: Workspace[];
  onSwitchWorkspace: (w: Workspace) => void;
  onLogout: () => void;
}) {
  const [view, setView] = useState<View>("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1900);
  }

  // Sembrar el workspaceStore desde los props (el switcher del topbar lo usa).
  useEffect(() => {
    useWorkspaceStore.setState({ workspaces, activeWorkspace: workspace, isLoading: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const activeWs = useWorkspaceStore((s) => s.activeWorkspace) ?? workspace;

  function handleNew(action: NewAction) {
    if (action === "cliente") setModal({ kind: "customer" });
    else if (action === "venta") setModal({ kind: "sale" });
    else if (action === "lead") setModal({ kind: "item" });
    else if (action === "tarea") setView("tasks");
    else flash("Próximamente");
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
      const [cs, it, sl] = await Promise.all([
        api.listCustomers(),
        api.listItems(),
        api.listSales(),
      ]);
      setStages(st);
      setCustomers(cs);
      setItems(it);
      setSales(sl);
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
  }, [activeWs.id]);

  const refreshCustomers = () => api.listCustomers().then(setCustomers);
  const refreshItems = () => api.listItems().then(setItems);
  const refreshSales = () => api.listSales().then(setSales);

  // Refrescar items cuando el Pipeline mueve una oportunidad por drag (o
  // cualquier emisor del evento), para que el ItemModal no arranque con la
  // etapa vieja y revierta el movimiento al guardar.
  useEffect(() => {
    const onItemChanged = () => { api.listItems().then(setItems); };
    window.addEventListener("clozr:item-changed", onItemChanged);
    return () => window.removeEventListener("clozr:item-changed", onItemChanged);
  }, []);

  return (
    <>
      <AppShell
        active={view}
        onNavigate={(id) => setView(id as View)}
        workspace={{ name: activeWs.name }}
        user={{ name: user.name ?? user.email, email: user.email }}
        onLogout={onLogout}
        onSearchClick={() => setPaletteOpen(true)}
        onNewAction={handleNew}
        onNotificationClick={(s) => setView(s as View)}
      >
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
        ) : view === "home" ? (
          <MiDia
            key={activeWs.id}
            user={user}
            onNavigate={(v) => setView(v as View)}
            onNewSale={() => setModal({ kind: "sale" })}
          />
        ) : view === "pipeline" ? (
          <PipelineView
            key={activeWs.id}
            onOpenItem={(id) => setModal({ kind: "item", id })}
            onAddItem={(stageId) => setModal({ kind: "item", presetStageId: stageId })}
          />
        ) : view === "customers" ? (
          <ClientesView key={activeWs.id} onNewSale={() => setModal({ kind: "sale" })} />
        ) : view === "sales" ? (
          <VentasView key={activeWs.id} onNewSale={() => setModal({ kind: "sale" })} />
        ) : view === "tasks" ? (
          <Tareas key={activeWs.id} />
        ) : view === "deudas" ? (
          <Deudas key={activeWs.id} />
        ) : view === "team" ? (
          <Equipo key={activeWs.id} user={user} />
        ) : view === "reportes" ? (
          <Reportes key={activeWs.id} />
        ) : view === "inventory" ? (
          <Inventario key={activeWs.id} />
        ) : view === "settings" ? (
          <Ajustes key={activeWs.id} user={user} onLogout={onLogout} />
        ) : view === "cash" ? (
          <Caja key={activeWs.id} />
        ) : (
          <EmptyState title="Próximamente" description="Esta vista se está portando desde la app desktop." />
        )}
      </AppShell>

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
          onSaved={(msg) => { setModal(null); refreshItems(); flash(msg); window.dispatchEvent(new Event("clozr:item-changed")); }}
        />
      )}
      {modal?.kind === "sale" && (
        <SaleModal
          customers={customers}
          sellerName={user.name ?? user.email}
          onClose={() => setModal(null)}
          onSaved={(msg) => { setModal(null); refreshSales(); flash(msg); window.dispatchEvent(new Event("clozr:sale-changed")); }}
        />
      )}
      {modal?.kind === "saleDetail" && (
        <SaleDetailModal
          saleId={modal.id}
          onClose={() => setModal(null)}
          onChanged={(msg) => { refreshSales(); flash(msg); }}
          onDeleted={(msg) => { setModal(null); refreshSales(); flash(msg); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg border border-border-strong bg-surface-2 px-4 py-2.5 text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}

      <Toaster />
      <ConfirmHost />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(v) => setView(v as View)}
        onOpenCustomer={(id) => setModal({ kind: "customer", id })}
        onOpenSale={(id) => setModal({ kind: "saleDetail", id })}
        onOpenItem={(id) => setModal({ kind: "item", id })}
      />
    </>
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
  const [stageId, setStageId] = useState(item?.stageId || presetStageId || stages[0]?.id || "");
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

/* ───────── helper de fecha (compartido por los modales de venta) ───────── */
function fmtDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

/* ───────── Sale modal (crear) ───────── */
type SaleLine = { description: string; quantity: string; unitPrice: string };

function SaleModal({
  customers,
  sellerName,
  onClose,
  onSaved,
}: {
  customers: Customer[];
  sellerName: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [customerId, setCustomerId] = useState(""); // "" = consumidor final
  const [lines, setLines] = useState<SaleLine[]>([{ description: "", quantity: "1", unitPrice: "" }]);
  const [method, setMethod] = useState<string>("efectivo");
  const [paidFull, setPaidFull] = useState(true);
  const [partial, setPartial] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const total = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const paidAmount = paidFull ? total : Number(partial) || 0;
  const balance = total - paidAmount;

  function setLine(i: number, patch: Partial<SaleLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { description: "", quantity: "1", unitPrice: "" }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  const validLines = lines.filter((l) => l.description.trim() && Number(l.unitPrice) > 0);
  const canSave = validLines.length > 0 && total > 0 && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    const cust = customers.find((c) => c.id === customerId);
    const payments = paidAmount > 0 ? [{ method, amount: paidAmount, currency: "ARS" as Currency }] : [];
    try {
      await api.createSale({
        customerId: cust?.id,
        customerName: cust?.name ?? "Consumidor final",
        sellerName,
        notes: notes.trim() || undefined,
        items: validLines.map((l) => ({
          description: l.description.trim(),
          quantity: Number(l.quantity) || 1,
          unitPrice: Number(l.unitPrice) || 0,
        })),
        payments,
      });
      onSaved("Venta registrada");
    } catch {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nueva venta" onClose={onClose}>
      <div className="flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Cliente</span>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={fieldCls}>
            <option value="">Consumidor final</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <span className={labelCls}>Productos / ítems</span>
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={l.description}
                onChange={(e) => setLine(i, { description: e.target.value })}
                placeholder="Descripción"
                className={`${fieldCls} flex-1`}
              />
              <input
                type="number"
                value={l.quantity}
                onChange={(e) => setLine(i, { quantity: e.target.value })}
                className={`${fieldCls} w-14`}
              />
              <input
                type="number"
                value={l.unitPrice}
                onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                placeholder="Precio"
                className={`${fieldCls} w-24`}
              />
              <button
                onClick={() => removeLine(i)}
                disabled={lines.length === 1}
                className="text-lg text-text-dim hover:text-danger disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
          <button onClick={addLine} className="self-start text-xs font-semibold text-primary-hover hover:underline">
            + Agregar ítem
          </button>
        </div>

        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Total</span>
            <span className="font-bold">{money(total, "ARS")}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Método de pago</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={fieldCls}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Cobro</span>
            <select
              value={paidFull ? "full" : "partial"}
              onChange={(e) => setPaidFull(e.target.value === "full")}
              className={fieldCls}
            >
              <option value="full">Pagado total</option>
              <option value="partial">Pago parcial / fiado</option>
            </select>
          </label>
        </div>
        {!paidFull && (
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Monto cobrado ahora</span>
            <input
              type="number"
              value={partial}
              onChange={(e) => setPartial(e.target.value)}
              placeholder="0"
              className={fieldCls}
            />
            <span className="text-xs text-text-dim">Queda debiendo {money(Math.max(0, balance), "ARS")}</span>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Notas</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fieldCls} min-h-16 resize-y`} />
        </label>
      </div>
      <div className="flex items-center gap-2.5 border-t border-border px-5 py-4">
        <div className="flex-1" />
        <button onClick={onClose} className="rounded-lg bg-surface-2 px-3.5 py-2 text-sm font-semibold hover:bg-border-strong">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={!canSave}
          className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          Registrar venta
        </button>
      </div>
    </Modal>
  );
}

/* ───────── Sale detail modal (ver + cobrar + eliminar) ───────── */
function SaleDetailModal({
  saleId,
  onClose,
  onChanged,
  onDeleted,
}: {
  saleId: string;
  onClose: () => void;
  onChanged: (msg: string) => void;
  onDeleted: (msg: string) => void;
}) {
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payMethod, setPayMethod] = useState<string>("efectivo");
  const [payAmount, setPayAmount] = useState("");

  async function load() {
    setLoadErr(false);
    try {
      setSale(await api.getSale(saleId));
    } catch {
      setLoadErr(true);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  async function addPay() {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return;
    setBusy(true);
    try {
      await api.addPayment(saleId, { method: payMethod, amount: amt, currency: "ARS" });
      setPayAmount("");
      await load();
      onChanged("Pago registrado");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm("¿Eliminar esta venta?")) return;
    setBusy(true);
    try {
      await api.deleteSale(saleId);
      onDeleted("Venta eliminada");
    } catch {
      setBusy(false);
    }
  }

  return (
    <Modal title="Detalle de venta" onClose={onClose}>
      {!sale ? (
        <div className="p-6 text-sm text-text-dim">{loadErr ? "No se pudo cargar la venta." : "Cargando…"}</div>
      ) : (
        <>
          <div className="flex flex-col gap-4 p-5">
            <div>
              <div className="text-lg font-bold">{sale.customerName}</div>
              <div className="text-xs text-text-dim">
                {fmtDate(sale.saleDate ?? sale.createdAt)}
                {sale.sellerName ? ` · ${sale.sellerName}` : ""}
              </div>
            </div>

            <div>
              <div className={`${labelCls} mb-1.5`}>Ítems</div>
              <div className="overflow-hidden rounded-lg border border-border">
                {sale.items.length ? (
                  sale.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-0"
                    >
                      <span>
                        {it.quantity}× {it.description}
                      </span>
                      <span className="font-semibold">{money(it.subtotal, "ARS")}</span>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-text-dim">Sin ítems</div>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-surface-2 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Total</span>
                <span className="font-bold">{money(sale.total, "ARS")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Cobrado</span>
                <span>{money(sale.totalPaid, "ARS")}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-1">
                <span className="text-text-muted">Saldo</span>
                <span className={`font-bold ${sale.balance > 0.01 ? "text-warning" : "text-[#10B981]"}`}>
                  {money(sale.balance, "ARS")}
                </span>
              </div>
            </div>

            {sale.payments.length > 0 && (
              <div>
                <div className={`${labelCls} mb-1.5`}>Pagos</div>
                <div className="flex flex-col gap-1">
                  {sale.payments.map((p) => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="text-text-muted">
                        {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method}
                      </span>
                      <span>{money(p.amount, p.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sale.notes && <div className="text-sm text-text-muted">{sale.notes}</div>}

            {sale.balance > 0.01 && (
              <div className="rounded-lg border border-border p-3">
                <div className={`${labelCls} mb-2`}>Registrar un pago</div>
                <div className="flex items-end gap-2">
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={`${fieldCls} flex-1`}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Monto"
                    className={`${fieldCls} w-28`}
                  />
                  <button
                    onClick={addPay}
                    disabled={busy || !(Number(payAmount) > 0)}
                    className="rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    Cobrar
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5 border-t border-border px-5 py-4">
            <button
              onClick={remove}
              disabled={busy}
              className="rounded-lg bg-[rgba(239,68,68,0.12)] px-3 py-2 text-sm font-semibold text-danger hover:bg-danger hover:text-white disabled:opacity-50"
            >
              Eliminar
            </button>
            <div className="flex-1" />
            <button onClick={onClose} className="rounded-lg bg-surface-2 px-3.5 py-2 text-sm font-semibold hover:bg-border-strong">
              Cerrar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
