"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as api from "@/lib/api";
import { color, radius, shadow } from "@/tokens";
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
  CatalogPrice,
  ClientType,
  Currency,
  Customer,
  LeadPriority,
  LeadSource,
  PipelineItem,
  PipelineStage,
  Product,
  Sale,
  SaleDetail,
  User,
  Workspace,
} from "@/lib/types";
import { AppShell } from "@/layout/AppShell";
import type { NewAction } from "@/layout/Topbar";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { usePermissions } from "@/store/usePermissions";
import { can as canFor } from "@/lib/permissions";
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
import { Consola } from "./Consola";
import { CommandPalette } from "./CommandPalette";
import { Clientes as ClientesView } from "./Clientes";
import { Ventas as VentasView } from "./Ventas";
import { Pipeline as PipelineView } from "./Pipeline";
import { UndoToastHost } from "@/components/UndoToastHost";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";
import { WhatsNewModal } from "./WhatsNewModal";
import { TipsModal } from "./TipsModal";

/* ───────── helpers ───────── */
function money(n: number | null | undefined, cur: Currency) {
  if (n == null) return "—";
  return cur === "USD"
    ? `US$ ${Number(n).toLocaleString("en-US")}`
    : `$ ${Number(n).toLocaleString("es-AR")}`;
}

type SalePreset = {
  customerId?: string;
  /** Nombre del cliente del preset — sirve de fallback si el id no está en la
   *  lista local de customers (cliente borrado o lista desincronizada). */
  customerName?: string;
  lines?: { description: string; quantity: string; unitPrice: string }[];
};

type ModalState =
  | { kind: "customer"; id?: string }
  | { kind: "item"; id?: string; presetStageId?: string }
  | { kind: "sale"; preset?: SalePreset; fromItemId?: string }
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
  | "settings"
  | "console";


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
  const { can } = usePermissions();
  const [view, setView] = useState<View>("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [catalog, setCatalog] = useState<Product[]>([]);
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
  // Caja restringida a managers (decisión de producto): ocultamos el item del
  // sidebar y la vista para vendedor/viewer (el server además devuelve 403).
  const isManager = activeWs.role === "owner" || activeWs.role === "admin";
  // Items de nav ocultos: Caja para no-managers; Consola para no-super-admin.
  // El acceso real lo enforcea el Worker (403); esto es solo visibilidad.
  const hiddenNav = [
    ...(isManager ? [] : ["cash"]),
    ...(user.isSuperAdmin ? [] : ["console"]),
  ];

  function handleNew(action: NewAction) {
    if (action === "cliente") { if (can("customers.write")) setModal({ kind: "customer" }); }
    else if (action === "venta") { if (can("sales.write")) setModal({ kind: "sale" }); }
    else if (action === "lead") { if (can("pipeline.write")) setModal({ kind: "item" }); }
    else if (action === "tarea") setView("tasks");
    else flash("Próximamente");
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      let st = await api.listStages();
      if (st.length === 0) {
        await api.seedStagesForIndustry(activeWs.industry);
        st = await api.listStages();
      }
      const [cs, it, sl, ct] = await Promise.all([
        api.listCustomers(),
        api.listItems(),
        api.listSales(),
        api.listCatalog().catch(() => [] as Product[]),
      ]);
      setStages(st);
      setCustomers(cs);
      setItems(it);
      setSales(sl);
      setCatalog(ct);
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

  // Atajos de teclado globales (solo cuando no estás escribiendo). El "?"
  // (ayuda) lo maneja ShortcutsHelp; ⌘K el SearchTrigger del topbar.
  useEffect(() => {
    const NAV: Record<string, View> = {
      "1": "home", "2": "pipeline", "3": "customers", "4": "sales",
      "5": "cash", "6": "deudas", "7": "inventory", "8": "tasks", "9": "reportes",
    };
    const editable = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (editable(e.target)) return;
      // No disparar atajos con un modal/drawer abierto (sino navega/cambia
      // lo de atrás). Todos los overlays llevan aria-modal.
      if (document.querySelector('[aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      // Permisos en vivo (este efecto corre una sola vez; evitamos closures viejos).
      const role = useWorkspaceStore.getState().activeWorkspace?.role;
      if (NAV[k]) { e.preventDefault(); setView(NAV[k]); return; }
      if (k === "l") { e.preventDefault(); setView("pipeline"); return; }
      if (k === "v") { e.preventDefault(); if (canFor(role, "sales.write")) setModal({ kind: "sale" }); return; }
      if (k === "c") { e.preventDefault(); if (canFor(role, "customers.write")) setModal({ kind: "customer" }); return; }
      if (k === "m") { e.preventDefault(); setView("cash"); return; }
      if (k === "t") { e.preventDefault(); setView("tasks"); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        hiddenNav={hiddenNav.length ? hiddenNav : undefined}
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
            onConvertItem={(item) =>
              setModal({
                kind: "sale",
                fromItemId: item.id,
                preset: {
                  customerId: item.customerId,
                  customerName: item.customerName,
                  lines: [
                    {
                      description: item.product || item.customerName,
                      quantity: "1",
                      unitPrice: item.amount != null ? String(item.amount) : "",
                    },
                  ],
                },
              })
            }
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
          can("team.manage") ? (
            <Equipo key={activeWs.id} user={user} onUpgrade={() => setView("settings")} />
          ) : (
            <EmptyState title="Sin acceso" description="No tenés permisos para gestionar el equipo." />
          )
        ) : view === "reportes" ? (
          can("reports.view") ? (
            <Reportes key={activeWs.id} />
          ) : (
            <EmptyState title="Sin acceso" description="Los reportes del negocio son solo para dueños y encargados." />
          )
        ) : view === "inventory" ? (
          <Inventario key={activeWs.id} />
        ) : view === "settings" ? (
          <Ajustes key={activeWs.id} user={user} onLogout={onLogout} />
        ) : view === "console" ? (
          user.isSuperAdmin ? (
            <Consola />
          ) : (
            <EmptyState title="Sin acceso" description="La Consola es solo para administradores de la plataforma." />
          )
        ) : view === "cash" ? (
          isManager ? (
            <Caja key={activeWs.id} />
          ) : (
            <EmptyState
              title="Caja restringida"
              description="La caja del negocio es visible solo para el dueño y los encargados."
            />
          )
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
          readOnly={!can("pipeline.write")}
        />
      )}
      {modal?.kind === "sale" && (
        <SaleModal
          customers={customers}
          catalog={catalog}
          sellerName={user.name ?? user.email}
          preset={modal.preset}
          title={modal.fromItemId ? "Convertir en venta" : "Nueva venta"}
          onClose={() => setModal(null)}
          onSaved={async (msg) => {
            const fromItemId = modal.fromItemId;
            setModal(null);
            refreshSales();
            flash(msg);
            window.dispatchEvent(new Event("clozr:sale-changed"));
            // Convertir: al registrar la venta, mover la oportunidad a "ganada".
            if (fromItemId) {
              const won = stages.find((s) => s.isWon);
              if (!won) {
                flash("Venta registrada. No hay etapa “ganada” configurada.");
                return;
              }
              try {
                await api.moveItem(fromItemId, won);
                window.dispatchEvent(new Event("clozr:item-changed"));
              } catch {
                flash("Venta registrada, pero no se pudo marcar la oportunidad como ganada.");
              }
            }
          }}
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
      <UndoToastHost />
      <ShortcutsHelp />
      <WhatsNewModal />
      <TipsModal enabled={!loading} onNavigate={(s) => setView(s as View)} />
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
function Modal({ title, onClose, children, isDirty }: { title: string; onClose: () => void; children: React.ReactNode; isDirty?: () => boolean }) {
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<number | null>(null);
  function triggerShake() {
    setShaking(false);
    if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
    requestAnimationFrame(() => {
      setShaking(true);
      shakeTimer.current = window.setTimeout(() => setShaking(false), 450);
    });
  }
  return (
    <div
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (isDirty?.()) { triggerShake(); return; } // hay datos → no cerrar, avisar con shake
        onClose();
      }}
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(2,6,23,0.7)] p-5 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl border border-border-strong bg-surface shadow-2xl"
        style={shaking ? { animation: "cz-modal-shake 420ms cubic-bezier(0.36, 0.07, 0.19, 0.97)" } : undefined}
      >
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
  readOnly = false,
}: {
  item?: PipelineItem;
  presetStageId?: string;
  stages: PipelineStage[];
  customers: Customer[];
  onNeedCustomer: () => void;
  onClose: () => void;
  onSaved: (msg: string) => void;
  readOnly?: boolean;
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
    if (readOnly) return;
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
    <Modal title={readOnly ? "Oportunidad" : item ? "Editar oportunidad" : "Nueva oportunidad"} onClose={onClose}>
      <div className="flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Cliente *</span>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={fieldCls} disabled={readOnly}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Producto / detalle</span>
          <input value={product} onChange={(e) => setProduct(e.target.value)} className={fieldCls} disabled={readOnly} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Monto</span>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldCls} disabled={readOnly} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Moneda</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={fieldCls} disabled={readOnly}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Etapa</span>
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={fieldCls} disabled={readOnly}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Prioridad</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as LeadPriority)} className={fieldCls} disabled={readOnly}>
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
          <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)} className={fieldCls} disabled={readOnly}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2.5 border-t border-border px-5 py-4">
        {item && !readOnly && (
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
          {readOnly ? "Cerrar" : "Cancelar"}
        </button>
        {!readOnly && (
          <button
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            Guardar
          </button>
        )}
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
type SaleLine = { description: string; quantity: string; unitPrice: string; catalogItemId?: string; imei?: string; priceAuto?: boolean };

/** Normaliza un nombre para matchear contra el catálogo: minúsculas, sin
 *  acentos, espacios colapsados. Así "iPhone 15" y "iphone  15" linkean igual. */
function normName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/** Miniatura del producto en el dropdown (imagen del catálogo o 📦). */
function ThumbMini({ src }: { src?: string | null }) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [src]);
  const show = !!src && !err;
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: radius.sm,
        background: color.surface2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        overflow: "hidden",
        fontSize: 15,
        lineHeight: 1,
      }}
    >
      {show ? (
        <img src={src!} alt="" onError={() => setErr(true)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <span aria-hidden>📦</span>
      )}
    </div>
  );
}

/** Combobox de catálogo por ítem: input + dropdown filtrable. Elegir una
 *  opción setea descripción + precio + linkea el producto (catalogItemId). */
function CatalogLineInput({
  value,
  catalog,
  onChangeText,
  onPick,
}: {
  value: string;
  catalog: Product[];
  onChangeText: (v: string) => void;
  onPick: (p: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [rect, setRect] = useState<{
    left: number;
    width: number;
    openUp: boolean;
    maxH: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const matches = useMemo(() => {
    const q = normName(value);
    const active = catalog.filter((p) => p.active !== false);
    const list = q
      ? active.filter((p) => normName(p.name).includes(q) || (p.sku ? normName(p.sku).includes(q) : false))
      : active;
    return list.slice(0, 7);
  }, [value, catalog]);

  // Cerrar al click afuera (input o popover, que vive en un portal aparte).
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // El dropdown se renderiza con position:fixed en un portal (para no recortarse
  // dentro del overflow del modal). Medimos el input y reposicionamos al
  // scrollear/redimensionar; si no hay lugar abajo, abrimos hacia arriba.
  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      const above = r.top;
      const openUp = below < 260 && above > below;
      const maxH = Math.max(120, Math.min(256, (openUp ? above : below) - 12));
      setRect({
        left: r.left,
        width: r.width,
        openUp,
        maxH,
        top: openUp ? undefined : r.bottom + 4,
        bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
      });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  // Mantener el highlight dentro de rango cuando cambia la lista filtrada.
  useEffect(() => {
    setHi((h) => (h >= matches.length ? 0 : h));
  }, [matches.length]);

  function choose(p: Product) {
    onPick(p);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChangeText(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHi((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && open && matches[hi]) {
            e.preventDefault();
            choose(matches[hi]);
          } else if (e.key === "Escape") {
            // Solo cerrar el dropdown; si ya está cerrado, dejar burbujear (Esc
            // del modal). stopPropagation evita cerrar el modal de un saque.
            if (open) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }
          }
        }}
        placeholder="Producto del catálogo o texto libre"
        autoComplete="off"
        className={`${fieldCls} w-full`}
      />
      {open && rect && matches.length > 0 &&
        createPortal(
        <div
          ref={popRef}
          role="listbox"
          style={{
            position: "fixed",
            left: rect.left,
            width: rect.width,
            ...(rect.openUp ? { bottom: rect.bottom } : { top: rect.top }),
            zIndex: 9999,
            maxHeight: rect.maxH,
            overflowY: "auto",
            background: color.surface,
            border: `1px solid ${color.border}`,
            borderRadius: radius.lg,
            boxShadow: shadow.lg,
          }}
        >
          {matches.map((p, idx) => {
            const c = p.cost;
            const costed = c != null && c > 0;
            const pct = costed && p.price > 0 ? Math.round(((p.price - c!) / p.price) * 100) : null;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={idx === hi}
                onMouseEnter={() => setHi(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  textAlign: "left",
                  background: idx === hi ? color.surface2 : "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <ThumbMini src={p.imagePath} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: color.textMuted }}>
                    {money(p.price, "ARS")}
                    {costed ? ` · costo ${money(c, "ARS")}` : " · sin costo"}
                  </div>
                </div>
                {pct != null && (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: radius.sm,
                      background: color.successBg,
                      color: color.success,
                    }}
                  >
                    +{pct}%
                  </span>
                )}
              </button>
            );
          })}
        </div>,
          document.body,
        )}
    </div>
  );
}

/** Chip de estado de linkeo por línea (debajo de cada ítem). */
function LineStatusChip({ status }: { status: { kind: "linked" | "nocost" | "free"; marginPct: number | null } }) {
  let fg: string;
  let label: string;
  if (status.kind === "linked") {
    const neg = status.marginPct != null && status.marginPct < 0;
    fg = neg ? color.danger : color.success;
    label =
      status.marginPct != null
        ? `Linkeado · margen ${Math.round(status.marginPct)}%${neg ? " (bajo costo)" : ""}`
        : "Linkeado al catálogo";
  } else if (status.kind === "nocost") {
    fg = color.warning;
    label = "Sin costo en Inventario — no entra en el margen";
  } else {
    fg = color.textDim;
    label = "Texto libre — no entra en el margen";
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: fg, paddingLeft: 2 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: fg, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function SaleModal({
  customers,
  catalog,
  sellerName,
  preset,
  title = "Nueva venta",
  onClose,
  onSaved,
}: {
  customers: Customer[];
  catalog: Product[];
  sellerName: string;
  preset?: SalePreset;
  title?: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [customerId, setCustomerId] = useState(preset?.customerId ?? ""); // "" = consumidor final
  const [lines, setLines] = useState<SaleLine[]>(() => {
    const base: SaleLine[] =
      preset?.lines && preset.lines.length
        ? preset.lines.map((l) => ({ ...l }))
        : [{ description: "", quantity: "1", unitPrice: "" }];
    // Linkear automáticamente las líneas del preset (convertir oportunidad →
    // venta) si su descripción coincide con un producto del catálogo (first-wins).
    const byName = new Map<string, Product>();
    for (const p of catalog) {
      if (p.active === false) continue;
      const k = normName(p.name);
      if (!byName.has(k)) byName.set(k, p);
    }
    return base.map((l) => {
      const m = byName.get(normName(l.description));
      return m ? { ...l, catalogItemId: m.id } : l;
    });
  });
  const [method, setMethod] = useState<string>("efectivo");
  const [paidFull, setPaidFull] = useState(true);
  const [partial, setPartial] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const total = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const paidAmount = paidFull ? total : Number(partial) || 0;
  const balance = total - paidAmount;

  // El modal está sucio si hay datos que se perderían al cerrar → click afuera
  // hace shake (no cierra), igual que en la desktop.
  function isDirty(): boolean {
    if (busy) return false;
    if (customerId) return true;
    if (notes.trim() !== "") return true;
    return lines.some((l) => l.description.trim() !== "" || String(l.unitPrice).trim() !== "");
  }

  // Índice de productos del catálogo por nombre normalizado, para linkear el
  // ítem al catálogo (y heredar su costo → margen exacto en Reportes).
  const productByName = useMemo(() => {
    const m = new Map<string, Product>();
    // first-wins: ante nombres duplicados queda el primero del catálogo (estable).
    for (const p of catalog) {
      if (p.active === false) continue;
      const k = normName(p.name);
      if (!m.has(k)) m.set(k, p);
    }
    return m;
  }, [catalog]);
  // Por id, para resolver el costo del producto linkeado (status + cobertura).
  const productById = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of catalog) m.set(p.id, p);
    return m;
  }, [catalog]);

  // Precios por tipo de cliente (precios por tipo). Se cargan una vez; el
  // precio sugerido de cada ítem depende del tipo del cliente seleccionado.
  const [catalogPrices, setCatalogPrices] = useState<CatalogPrice[]>([]);
  useEffect(() => {
    api.listCatalogPrices().then(setCatalogPrices).catch(() => {});
  }, []);
  const priceByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of catalogPrices) m.set(`${p.catalogItemId}|${p.customerType}`, p.price);
    return m;
  }, [catalogPrices]);
  // Tipo del cliente elegido (consumidor final / sin cliente → "final").
  const custType: ClientType = useMemo(() => {
    const c = customers.find((x) => x.id === customerId);
    return c?.type ?? "final";
  }, [customers, customerId]);
  // Precio sugerido de un producto para el tipo actual; si no hay precio
  // especial para ese tipo, cae al precio base del catálogo.
  function suggestedPrice(p: Product, type: ClientType = custType): number {
    return priceByKey.get(`${p.id}|${type}`) ?? p.price;
  }
  // Cambiar de cliente re-sugiere el precio de las líneas linkeadas que fueron
  // autocompletadas (priceAuto), respetando precios editados a mano o del preset.
  function changeCustomer(newId: string) {
    setCustomerId(newId);
    const c = customers.find((x) => x.id === newId);
    const newType: ClientType = c?.type ?? "final";
    setLines((prev) =>
      prev.map((l) => {
        if (!l.catalogItemId || !l.priceAuto) return l;
        const p = productById.get(l.catalogItemId);
        if (!p) return l;
        return { ...l, unitPrice: String(suggestedPrice(p, newType)) };
      }),
    );
  }

  function setLine(i: number, patch: Partial<SaleLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  // Al escribir la descripción a mano:
  //  - coincidencia exacta con un producto → (re)linkea ese producto;
  //  - si no, mantenemos el link existente mientras la descripción siga
  //    conteniendo el nombre del producto (permite anotar "… (sello)" sin
  //    perder el costo); si ya no lo contiene, queda como texto libre.
  function setDescription(i: number, value: string) {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        const norm = normName(value);
        const exact = productByName.get(norm);
        let catalogItemId = l.catalogItemId;
        if (exact) {
          catalogItemId = exact.id;
        } else if (l.catalogItemId) {
          const linked = productById.get(l.catalogItemId);
          if (!linked || !norm.includes(normName(linked.name))) catalogItemId = undefined;
        }
        const next: SaleLine = { ...l, description: value, catalogItemId };
        if (exact && (!l.unitPrice || l.unitPrice.trim() === "")) {
          next.unitPrice = String(suggestedPrice(exact));
          next.priceAuto = true;
        }
        return next;
      }),
    );
  }
  // Al elegir un producto del dropdown: linkeo determinístico por id (a prueba
  // de nombres duplicados) + autocompleto precio si está vacío.
  function pickProduct(i: number, p: Product) {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        const next: SaleLine = { ...l, description: p.name, catalogItemId: p.id };
        if (!l.unitPrice || l.unitPrice.trim() === "") {
          next.unitPrice = String(suggestedPrice(p));
          next.priceAuto = true;
        }
        return next;
      }),
    );
  }
  function addLine() {
    setLines((prev) => [...prev, { description: "", quantity: "1", unitPrice: "" }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  // Estado de linkeo de una línea: linkeada con costo (→ margen), linkeada sin
  // costo cargado, o texto libre. Define el chip y la cobertura del margen.
  function lineStatus(l: SaleLine): { kind: "linked" | "nocost" | "free"; marginPct: number | null } {
    const p = l.catalogItemId ? productById.get(l.catalogItemId) : undefined;
    if (!p) return { kind: "free", marginPct: null };
    const c = p.cost;
    if (c == null || c <= 0) return { kind: "nocost", marginPct: null };
    const price = Number(l.unitPrice) || 0;
    return { kind: "linked", marginPct: price > 0 ? ((price - c) / price) * 100 : null };
  }

  // Cobertura del margen sobre el total de la venta: cuánto factura con costo
  // asignado (→ margen estimado) vs cuánto queda sin costo (no entra al margen).
  const coverage = useMemo(() => {
    let costedRev = 0,
      cost = 0,
      uncostedRev = 0;
    for (const l of lines) {
      // Solo las líneas que realmente se guardan (mismo criterio que validLines):
      // así la cobertura mostrada coincide con lo que Reportes leerá.
      if (!l.description.trim()) continue;
      const qty = Number(l.quantity) || 0;
      const price = Number(l.unitPrice) || 0;
      const rev = qty * price;
      if (rev <= 0) continue;
      const p = l.catalogItemId ? productById.get(l.catalogItemId) : undefined;
      const c = p?.cost;
      if (p && c != null && c > 0) {
        costedRev += rev;
        cost += c * qty;
      } else {
        uncostedRev += rev;
      }
    }
    const marginEst = costedRev - cost;
    return {
      marginEst,
      marginPct: costedRev > 0 ? (marginEst / costedRev) * 100 : null,
      uncostedRev,
      hasCosted: costedRev > 0,
    };
  }, [lines, productById]);

  const validLines = lines.filter(
    (l) => l.description.trim() && Number(l.unitPrice) > 0 && Number(l.quantity) > 0,
  );
  const canSave = validLines.length > 0 && total > 0 && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    const cust = customers.find((c) => c.id === customerId);
    // Si el cliente del preset no está en la lista local (cliente borrado o
    // lista vieja), igual mandamos su id+nombre — existe en la DB.
    const isPresetCust = !!customerId && customerId === preset?.customerId;
    const finalCustomerId = cust?.id ?? (isPresetCust ? customerId : undefined);
    const finalCustomerName =
      cust?.name || (isPresetCust ? preset?.customerName : "") || "Consumidor final";
    const payments = paidAmount > 0 ? [{ method, amount: paidAmount, currency: "ARS" as Currency }] : [];
    try {
      await api.createSale({
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        sellerName,
        notes: notes.trim() || undefined,
        items: validLines.map((l) => ({
          description: l.description.trim(),
          // validLines garantiza quantity > 0 — sin el ||1 que coerce vacío→1
          // (eso divergía el total mostrado del persistido).
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice) || 0,
          catalogItemId: l.catalogItemId ?? null,
          imei: l.imei?.trim() || null,
          // Snapshot del costo del catálogo al momento de la venta → margen
          // histórico exacto aunque después se edite el costo del producto.
          unitCost: l.catalogItemId ? productById.get(l.catalogItemId)?.cost ?? null : null,
        })),
        payments,
      });
      onSaved("Venta registrada");
    } catch {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose} isDirty={isDirty}>
      <div className="flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Cliente</span>
          <select value={customerId} onChange={(e) => changeCustomer(e.target.value)} className={fieldCls}>
            <option value="">Consumidor final</option>
            {preset?.customerId && !customers.some((c) => c.id === preset.customerId) && (
              <option value={preset.customerId}>{preset.customerName ?? "Cliente de la oportunidad"}</option>
            )}
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <span className={labelCls}>Productos / ítems</span>
          {lines.map((l, i) => {
            const st = lineStatus(l);
            return (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <CatalogLineInput
                    value={l.description}
                    catalog={catalog}
                    onChangeText={(v) => setDescription(i, v)}
                    onPick={(p) => pickProduct(i, p)}
                  />
                  <input
                    type="number"
                    min="1"
                    value={l.quantity}
                    onChange={(e) => setLine(i, { quantity: e.target.value })}
                    className={fieldCls}
                    style={{ width: 56, flexShrink: 0 }}
                  />
                  <input
                    type="number"
                    value={l.unitPrice}
                    onChange={(e) => setLine(i, { unitPrice: e.target.value, priceAuto: false })}
                    placeholder="Precio"
                    className={fieldCls}
                    style={{ width: 104, flexShrink: 0 }}
                  />
                  <button
                    onClick={() => removeLine(i)}
                    disabled={lines.length === 1}
                    className="text-lg text-text-dim hover:text-danger disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
                {l.description.trim() !== "" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <LineStatusChip status={st} />
                    <span className="flex-1" />
                    <input
                      value={l.imei ?? ""}
                      onChange={(e) => setLine(i, { imei: e.target.value })}
                      placeholder="IMEI / N° de serie (opcional)"
                      autoComplete="off"
                      className={fieldCls}
                      style={{ fontSize: 12, padding: "6px 10px", width: 224, flexShrink: 0 }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={addLine} className="self-start text-xs font-semibold text-primary-hover hover:underline">
            + Agregar ítem
          </button>
        </div>

        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Total</span>
            <span className="font-bold">{money(total, "ARS")}</span>
          </div>
          {coverage.hasCosted && (
            <div
              className="mt-1.5 flex justify-between"
              style={{ color: coverage.marginEst < 0 ? color.danger : color.success }}
            >
              <span>Margen estimado{coverage.marginPct != null ? ` · ${Math.round(coverage.marginPct)}%` : ""}</span>
              <span className="font-semibold">{money(coverage.marginEst, "ARS")}</span>
            </div>
          )}
          {coverage.uncostedRev > 0 && (
            <div className="mt-1 flex items-center gap-1.5" style={{ color: color.warning, fontSize: 11 }}>
              <span aria-hidden>⚠</span>
              {money(coverage.uncostedRev, "ARS")} sin costo asignado — no entra en el margen
            </div>
          )}
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
                        {it.imei && (
                          <span className="ml-1 text-xs text-text-dim">· IMEI {it.imei}</span>
                        )}
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
                <span className={`font-bold ${sale.balance > 0.01 ? "text-warning" : "text-success"}`}>
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
