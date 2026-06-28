"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as api from "@/lib/api";
import { displayName } from "@/lib/format";
import { color, radius, shadow, space, text, weight } from "@/tokens";
import {
  CLIENT_TYPE_LABELS,
  CLIENT_TYPES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS_MANUAL,
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
import { useCustomersChanged, notifyCustomersChanged } from "@/lib/customerEvents";
import { usePermissions } from "@/store/usePermissions";
import { useBlueRate } from "@/store/dollarStore";
import { printComprobante } from "@/lib/comprobante";
import { isValidDeviceId } from "@/lib/deviceId";
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
import { ClozrAi } from "./ClozrAi";
import { Clientes as ClientesView } from "./Clientes";
import { Ventas as VentasView } from "./Ventas";
import { Agenda } from "./Agenda";
import { Repairs } from "./Repairs";
import { Pipeline as PipelineView } from "./Pipeline";
import { useStagesChanged } from "@/lib/stageEvents";
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
  lines?: { description: string; quantity: string; unitPrice: string; currency?: "ARS" | "USD" }[];
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
  | "agenda"
  | "cash"
  | "deudas"
  | "inventory"
  | "repairs"
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
  // Click en un turno de la Agenda → abrir esa venta en la vista Ventas.
  const [pendingSaleId, setPendingSaleId] = useState<string | null>(null);
  const openSaleFromAgenda = (id: string) => { setPendingSaleId(id); setView("sales"); };

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
  const blue = useBlueRate(); // para sembrar el precio (USD→ARS) en la venta rápida
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
  // B: refrescar clientes cuando cambian en cualquier otra pantalla.
  useCustomersChanged(refreshCustomers);
  // Refrescar etapas cuando se crean/borran en Ajustes — el form de oportunidad
  // usa esta copia, así no muestra etapas viejas (sin F5).
  useStagesChanged(() => { api.listStages().then(setStages).catch(() => {}); });

  // Refrescar items cuando el Pipeline mueve una oportunidad por drag (o
  // cualquier emisor del evento), para que el ItemModal no arranque con la
  // etapa vieja y revierta el movimiento al guardar.
  useEffect(() => {
    const onItemChanged = () => { api.listItems().then(setItems); };
    window.addEventListener("clozr:item-changed", onItemChanged);
    return () => window.removeEventListener("clozr:item-changed", onItemChanged);
  }, []);

  // A: al abrir "nueva venta", refrescar clientes (pudo crearse uno recién en otra pantalla).
  useEffect(() => {
    if (modal?.kind === "sale") refreshCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal?.kind]);

  // Al abrir "agregar/editar oportunidad", refrescar etapas (pudieron crearse o
  // borrarse en Ajustes mientras esta pantalla seguía montada).
  useEffect(() => {
    if (modal?.kind === "item") api.listStages().then(setStages).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal?.kind]);

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
        user={{ name: displayName(user), email: user.email }}
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
          <VentasView
            key={activeWs.id}
            customers={customers}
            onNewSale={() => setModal({ kind: "sale" })}
            initialOpenSaleId={pendingSaleId}
            onConsumeInitial={() => setPendingSaleId(null)}
          />
        ) : view === "agenda" ? (
          <Agenda key={activeWs.id} sales={sales} items={items} customers={customers} onOpenSale={openSaleFromAgenda} onOpenPipeline={() => setView("pipeline")} />
        ) : view === "repairs" ? (
          <Repairs key={activeWs.id} customers={customers} onOpenSale={openSaleFromAgenda} />
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
          <Inventario
            key={activeWs.id}
            onQuickSale={
              can("sales.write")
                ? (p) =>
                    setModal({
                      kind: "sale",
                      preset: {
                        lines: [
                          {
                            description: p.name,
                            quantity: "1",
                            // La línea arranca en la MONEDA del producto (US$ si el
                            // catálogo está en dólares). El Total convierte a pesos al blue.
                            unitPrice: String(p.price || 0),
                            currency: p.currency === "USD" ? "USD" : "ARS",
                          },
                        ],
                      },
                    })
                : undefined
            }
          />
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
          key={modal.id ?? "new"}
          customer={modal.id ? customers.find((c) => c.id === modal.id) : undefined}
          customers={customers}
          onOpenExisting={(id) => setModal({ kind: "customer", id })}
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
          sellerName={displayName(user)}
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
      <ClozrAi />
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
  initialName,
  customers = [],
  onOpenExisting,
  onClose,
  onSaved,
}: {
  customer?: Customer;
  initialName?: string;
  customers?: Customer[];
  onOpenExisting?: (id: string) => void;
  onClose: () => void;
  onSaved: (msg: string, createdId?: string) => void;
}) {
  const [name, setName] = useState(customer?.name ?? initialName ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [type, setType] = useState<ClientType>(customer?.type ?? "final");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [busy, setBusy] = useState(false);

  // Tel-first anti-duplicado: al crear, si el teléfono coincide con un cliente
  // existente (últimos 8 dígitos), ofrecemos abrir su ficha en vez de duplicar.
  const digits = (p?: string | null) => (p ?? "").replace(/\D/g, "");
  const phoneDigits = digits(phone);
  const dupe = !customer && phoneDigits.length >= 6
    ? customers.find((c) => { const d = digits(c.phone); return d.length >= 6 && d.slice(-8) === phoneDigits.slice(-8); })
    : null;

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const data = { name: name.trim(), phone, email, type, notes };
      let createdId: string | undefined;
      if (customer) await api.updateCustomer(customer.id, data);
      else createdId = await api.createCustomer(data);
      notifyCustomersChanged();
      onSaved(customer ? "Cliente actualizado" : "Cliente creado", createdId);
    } catch {
      setBusy(false);
    }
  }
  async function remove() {
    if (!customer || !confirm("¿Archivar este cliente? Se oculta de tu lista; el historial de ventas se conserva.")) return;
    setBusy(true);
    try {
      await api.deleteCustomer(customer.id);
      notifyCustomersChanged();
      onSaved("Cliente archivado");
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
        {dupe && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[2], padding: `${space[2]} ${space[3]}`, background: color.warningBg, border: `1px solid ${color.warning}`, borderRadius: radius.md }}>
            <span style={{ fontSize: text.sm, color: color.warning }}>Ya existe un cliente con ese teléfono: <strong>{dupe.name}</strong></span>
            {onOpenExisting && (
              <button type="button" onClick={() => onOpenExisting(dupe.id)} style={{ background: "none", border: "none", color: color.warning, fontWeight: weight.semibold, fontSize: text.sm, cursor: "pointer", textDecoration: "underline", whiteSpace: "nowrap" }}>
                Ver ficha
              </button>
            )}
          </div>
        )}
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
  const [shortNote, setShortNote] = useState(item?.shortNote ?? "");
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
      shortNote: shortNote.trim() || null,
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
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Leyenda / nota <span className="font-normal text-text-dim">· se ve en la tarjeta</span></span>
          <textarea
            value={shortNote}
            onChange={(e) => setShortNote(e.target.value)}
            className={fieldCls}
            disabled={readOnly}
            rows={2}
            placeholder="Recordatorio o aclaración (ej: 'llamar después de las 18h', 'seña pagada')…"
          />
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
type SaleLine = { description: string; quantity: string; unitPrice: string; currency?: "ARS" | "USD"; catalogItemId?: string; imei?: string; priceAuto?: boolean };

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

/** Selector de cliente con buscador (input + dropdown en portal). "" = consumidor final. */
function ClientPicker({
  customers,
  value,
  walkInName,
  onChange,
  presetName,
  onCreateNew,
  onUseWalkIn,
}: {
  customers: Customer[];
  value: string;
  walkInName?: string;
  onChange: (id: string) => void;
  presetName?: string;
  onCreateNew?: (name: string) => void;
  onUseWalkIn?: (name: string) => void;
}) {
  const selectedName =
    value === ""
      ? walkInName ?? ""
      : customers.find((c) => c.id === value)?.name ?? presetName ?? "";
  const [q, setQ] = useState(selectedName);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [rect, setRect] = useState<{ left: number; width: number; openUp: boolean; maxH: number; top?: number; bottom?: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  // Reflejar selección externa (ej. preset) en el texto del input.
  useEffect(() => { setQ(selectedName); }, [selectedName]);

  const matches = useMemo(() => {
    const query = normName(q);
    const list = query
      ? customers.filter((c) => normName(c.name).includes(query) || (c.phone ? c.phone.includes(q.trim()) : false))
      : customers;
    return list.slice(0, 8);
  }, [q, customers]);

  // index 0 = consumidor final; luego los matches (con teléfono para desambiguar)
  const options = useMemo(
    () => [
      { id: "", name: "Consumidor final", phone: null as string | null },
      ...matches.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? null })),
    ],
    [matches],
  );

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

  useEffect(() => {
    if (!open) { setRect(null); return; }
    const measure = () => {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      const above = r.top;
      const openUp = below < 260 && above > below;
      const maxH = Math.max(120, Math.min(280, (openUp ? above : below) - 12));
      setRect({
        left: r.left, width: r.width, openUp, maxH,
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

  function choose(id: string, name: string) {
    onChange(id);
    setQ(id === "" ? "" : name);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => { setOpen(true); inputRef.current?.select(); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, options.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && open && options[hi]) { e.preventDefault(); choose(options[hi].id, options[hi].name); }
          else if (e.key === "Escape") { if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); } }
        }}
        placeholder="Consumidor final"
        autoComplete="off"
        className={fieldCls}
      />
      {open && rect &&
        createPortal(
          <div
            ref={popRef}
            role="listbox"
            style={{
              position: "fixed", left: rect.left, width: rect.width,
              ...(rect.openUp ? { bottom: rect.bottom } : { top: rect.top }),
              zIndex: 9999, maxHeight: rect.maxH, overflowY: "auto",
              background: color.surface, border: `1px solid ${color.border}`,
              borderRadius: radius.lg, boxShadow: shadow.lg,
            }}
          >
            {options.map((o, idx) => (
              <button
                key={o.id || "__cf"}
                type="button"
                role="option"
                aria-selected={idx === hi}
                onMouseEnter={() => setHi(idx)}
                onMouseDown={(e) => { e.preventDefault(); choose(o.id, o.name); }}
                style={{
                  display: "flex", width: "100%", alignItems: "center", gap: 8,
                  padding: "9px 12px", textAlign: "left", border: "none", cursor: "pointer",
                  background: idx === hi ? color.surface2 : "transparent",
                  color: o.id === "" ? color.textMuted : color.text, fontSize: 14,
                }}
              >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span>
                {o.phone && (
                  <span style={{ color: color.textDim, fontSize: 12, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {o.phone}
                  </span>
                )}
              </button>
            ))}
            {q.trim() !== "" && matches.length === 0 && (
              <div style={{ padding: "9px 12px", fontSize: 13, color: color.textDim }}>Sin clientes con ese nombre</div>
            )}
            {q.trim() !== "" && !customers.some((c) => normName(c.name) === normName(q)) && (
              <>
                {matches.length > 0 && (
                  <div
                    style={{
                      padding: "7px 12px",
                      fontSize: 12,
                      color: color.warning,
                      background: color.warningBg,
                      borderTop: `1px solid ${color.border}`,
                    }}
                  >
                    ¿Es alguno de arriba? Elegilo para no duplicar la ficha.
                  </div>
                )}
                {onUseWalkIn && (
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); onUseWalkIn(q.trim()); setOpen(false); }}
                    style={{
                      display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "9px 12px",
                      textAlign: "left", border: "none", borderTop: `1px solid ${color.border}`,
                      background: "transparent", color: color.text, fontSize: 14, cursor: "pointer",
                    }}
                  >
                    Usar «{q.trim()}» <span style={{ color: color.textDim }}>(mostrador)</span>
                  </button>
                )}
                {onCreateNew && (
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); onCreateNew(q.trim()); setOpen(false); }}
                    style={{
                      display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "9px 12px",
                      textAlign: "left", border: "none", borderTop: `1px solid ${color.border}`,
                      background: "transparent", color: color.primary, fontSize: 14, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    + Guardar «{q.trim()}» como cliente
                  </button>
                )}
              </>
            )}
          </div>,
          document.body,
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
  const [walkInName, setWalkInName] = useState(""); // nombre suelto de mostrador (cliente no guardado)
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
  // Plan canje: equipo usado recibido como parte de pago.
  const [tradeInOpen, setTradeInOpen] = useState(false);
  const [tiDesc, setTiDesc] = useState("");
  const [tiImei, setTiImei] = useState("");
  const [tiCondition, setTiCondition] = useState("");
  const [tiValue, setTiValue] = useState("");
  // Lista local de clientes (para reflejar al instante uno creado al vuelo).
  const [localCustomers, setLocalCustomers] = useState(customers);
  useEffect(() => { setLocalCustomers(customers); }, [customers]);
  const [newClientName, setNewClientName] = useState<string | null>(null);
  // IMEIs por producto del catálogo (cache lazy). Un producto es "serializado"
  // si tiene unidades cargadas → en la venta se ELIGE cuál sale (no texto libre)
  // y la cantidad queda fija en 1 (cada equipo es una unidad).
  const [imeisByItem, setImeisByItem] = useState<Record<string, api.CatalogImei[]>>({});
  const imeisRequested = useRef<Set<string>>(new Set());
  const linkedItemIds = useMemo(
    () => Array.from(new Set(lines.map((l) => l.catalogItemId).filter(Boolean) as string[])),
    [lines],
  );
  useEffect(() => {
    const missing = linkedItemIds.filter((id) => !imeisRequested.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => imeisRequested.current.add(id));
    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        api.listCatalogImeis(id).then((list) => [id, list] as const).catch(() => [id, [] as api.CatalogImei[]] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setImeisByItem((prev) => {
        const next = { ...prev };
        for (const [id, list] of entries) next[id] = list;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [linkedItemIds]);
  // ¿La línea vende una unidad serializada? (producto con IMEIs cargados)
  const isSerialLine = (l: SaleLine) => !!(l.catalogItemId && imeisByItem[l.catalogItemId]?.length);

  const blue = useBlueRate(); // cotización del dólar blue (para convertir USD→ARS)
  // Moneda por ítem: subtotal por moneda (cada línea en la suya) + total en ARS
  // de referencia (los ítems en USD se convierten al dólar blue del momento).
  const rate = Number(blue) || 0;
  const lineAmount = (l: SaleLine) =>
    (isSerialLine(l) ? 1 : Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
  const subtotalUsd = lines.reduce((a, l) => a + ((l.currency ?? "ARS") === "USD" ? lineAmount(l) : 0), 0);
  const subtotalArs = lines.reduce((a, l) => a + ((l.currency ?? "ARS") === "USD" ? 0 : lineAmount(l)), 0);
  const total = subtotalArs + subtotalUsd * rate;
  // Plan canje: el equipo recibido vale `tradeInValue`, cuenta como pago (baja
  // el saldo) y entra al stock como unidad usada al cerrar la venta.
  const tradeInValue = tradeInOpen ? Math.max(0, Number(tiValue) || 0) : 0;
  const due = Math.max(0, total - tradeInValue); // lo que queda a pagar
  const cashPaid = paidFull ? due : Math.max(0, Number(partial) || 0);
  const paidAmount = tradeInValue + cashPaid; // total cobrado (canje + efectivo/otro)
  const balance = total - paidAmount;
  // USD-nativo: el dólar es el número principal; el peso es referencia (≈ al blue).
  const totalUsd = subtotalUsd + (rate > 0 ? subtotalArs / rate : 0);
  const tradeInUsd = rate > 0 ? tradeInValue / rate : tradeInValue;
  const dueUsd = Math.max(0, totalUsd - tradeInUsd);
  const balanceUsd = totalUsd - (rate > 0 ? paidAmount / rate : paidAmount);
  // El canje está "activo" si se empezó a cargar; si es así exige modelo + valor.
  const tradeInActive = tradeInOpen && (tiDesc.trim() !== "" || tiValue.trim() !== "");
  const tradeInOk = !tradeInActive || (tiDesc.trim() !== "" && tradeInValue > 0 && isValidDeviceId(tiImei));

  // El modal está sucio si hay datos que se perderían al cerrar → click afuera
  // hace shake (no cierra), igual que en la desktop.
  function isDirty(): boolean {
    if (busy) return false;
    if (customerId) return true;
    if (notes.trim() !== "") return true;
    if (tradeInActive || tiImei.trim() !== "" || tiCondition.trim() !== "") return true;
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
  // Lista de precios a aplicar (tipo de cliente). Arranca según el cliente del
  // preset (o "final" para venta de mostrador) y se puede cambiar a mano: así
  // se cobra precio de revendedor/mayorista aun sin un cliente cargado.
  const [priceType, setPriceType] = useState<ClientType>(() => {
    const c = customers.find((x) => x.id === (preset?.customerId ?? ""));
    return c?.type ?? "final";
  });
  // Siembra del precio de un ítem: arranca en la MONEDA del producto (US$ si el
  // catálogo está en dólares) para que veas el precio que cargaste; el Total
  // convierte a pesos al blue. Respeta el precio por tipo de cliente.
  function seedFor(p: Product, type: ClientType = priceType): { unitPrice: string; currency: Currency } {
    const base = priceByKey.get(`${p.id}|${type}`) ?? p.price;
    return { unitPrice: String(base ?? 0), currency: p.currency === "USD" ? "USD" : "ARS" };
  }
  // Costo del producto llevado a pesos (para el margen): si está en USD, al blue.
  function costArs(p: Product): number | null {
    if (p.cost == null) return null;
    return p.currency === "USD" && blue && blue > 0 ? p.cost * blue : p.cost;
  }
  function costArsById(id: string | null | undefined): number | null {
    if (!id) return null;
    const p = productById.get(id);
    return p ? costArs(p) : null;
  }
  // Re-sugiere el precio de las líneas linkeadas autocompletadas (priceAuto)
  // para un tipo dado, sin pisar precios editados a mano ni los del preset.
  function resuggestFor(newType: ClientType) {
    setLines((prev) =>
      prev.map((l) => {
        if (!l.catalogItemId || !l.priceAuto) return l;
        const p = productById.get(l.catalogItemId);
        if (!p) return l;
        return { ...l, ...seedFor(p, newType) };
      }),
    );
  }
  // Cambiar de cliente re-sugiere el precio de las líneas linkeadas que fueron
  // autocompletadas (priceAuto), respetando precios editados a mano o del preset.
  function changeCustomer(newId: string) {
    setCustomerId(newId);
    setWalkInName("");
    const c = customers.find((x) => x.id === newId);
    const newType: ClientType = c?.type ?? "final";
    setPriceType(newType);
    resuggestFor(newType);
  }
  // Cambiar la lista de precios a mano (sin tocar el cliente).
  function changePriceType(newType: ClientType) {
    setPriceType(newType);
    resuggestFor(newType);
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
          const seed = seedFor(exact);
          next.unitPrice = seed.unitPrice;
          next.currency = seed.currency;
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
          const seed = seedFor(p);
          next.unitPrice = seed.unitPrice;
          next.currency = seed.currency;
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
  // Unidades disponibles de un producto serializado para una línea: sin vender y
  // no elegidas en OTRA línea del mismo producto. Devuelve null si el producto
  // no es serializado (sin IMEIs cargados) → la línea usa IMEI de texto libre.
  function availableUnitsFor(lineIdx: number): api.CatalogImei[] | null {
    const l = lines[lineIdx];
    if (!l?.catalogItemId) return null;
    const all = imeisByItem[l.catalogItemId];
    if (!all || all.length === 0) return null;
    const chosenElsewhere = new Set(
      lines
        .filter((x, idx) => idx !== lineIdx && x.catalogItemId === l.catalogItemId && x.imei)
        .map((x) => x.imei as string),
    );
    return all.filter((u) => !u.soldAt && !chosenElsewhere.has(u.imei));
  }

  // Estado de linkeo de una línea: linkeada con costo (→ margen), linkeada sin
  // costo cargado, o texto libre. Define el chip y la cobertura del margen.
  function lineStatus(l: SaleLine): { kind: "linked" | "nocost" | "free"; marginPct: number | null } {
    const p = l.catalogItemId ? productById.get(l.catalogItemId) : undefined;
    if (!p) return { kind: "free", marginPct: null };
    const c = costArs(p); // costo en pesos (USD → blue) para comparar con el precio
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
      const c = p ? costArs(p) : null; // costo en pesos (USD → blue)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, productById, blue]);

  const validLines = lines.filter(
    (l) => l.description.trim() && Number(l.unitPrice) > 0 && Number(l.quantity) > 0,
  );
  // Si hay ítems en USD necesitamos la cotización para convertir el total a pesos.
  const needsRate = subtotalUsd > 0 && rate <= 0;
  const canSave = validLines.length > 0 && total > 0 && tradeInOk && !needsRate && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    const cust = customers.find((c) => c.id === customerId);
    // Si el cliente del preset no está en la lista local (cliente borrado o
    // lista vieja), igual mandamos su id+nombre — existe en la DB.
    const isPresetCust = !!customerId && customerId === preset?.customerId;
    const finalCustomerId = cust?.id ?? (isPresetCust ? customerId : undefined);
    const finalCustomerName =
      cust?.name || walkInName.trim() || (isPresetCust ? preset?.customerName : "") || "Consumidor final";
    const payments: Array<{ method: string; amount: number; currency: Currency }> = [];
    if (tradeInValue > 0) payments.push({ method: "canje", amount: tradeInValue, currency: "ARS" });
    if (cashPaid > 0) payments.push({ method, amount: cashPaid, currency: "ARS" });
    try {
      await api.createSale({
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        sellerName,
        notes: notes.trim() || undefined,
        usdToArs: rate > 0 ? rate : undefined,
        items: validLines.map((l) => ({
          description: l.description.trim(),
          // validLines garantiza quantity > 0 — sin el ||1 que coerce vacío→1
          // (eso divergía el total mostrado del persistido). Serializado = 1
          // unidad por IMEI elegido.
          quantity: isSerialLine(l) ? 1 : Number(l.quantity),
          unitPrice: Number(l.unitPrice) || 0,
          currency: l.currency ?? "ARS",
          catalogItemId: l.catalogItemId ?? null,
          imei: l.imei?.trim() || null,
          // Snapshot del costo (en pesos, USD→blue) al momento de la venta →
          // margen histórico exacto aunque después cambie el costo o el dólar.
          unitCost: costArsById(l.catalogItemId),
        })),
        payments,
        tradeIn:
          tradeInActive && tiDesc.trim() && tradeInValue > 0
            ? {
                description: tiDesc.trim(),
                imei: tiImei.trim() || undefined,
                value: tradeInValue,
                condition: tiCondition.trim() || undefined,
              }
            : undefined,
      });
      onSaved("Venta registrada");
    } catch {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose} isDirty={isDirty}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>Cliente</span>
          <ClientPicker
            customers={localCustomers}
            value={customerId}
            walkInName={walkInName}
            onChange={changeCustomer}
            presetName={preset?.customerName ?? undefined}
            onCreateNew={(name) => setNewClientName(name)}
            onUseWalkIn={(name) => { changeCustomer(""); setWalkInName(name); }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>Lista de precios</span>
          <select
            value={priceType}
            onChange={(e) => changePriceType(e.target.value as ClientType)}
            className={fieldCls}
          >
            {CLIENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CLIENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <span className="text-xs text-text-dim">
            {blue
              ? `Catálogo en US$ → la línea arranca en US$; el Total convierte a pesos al blue ($${Math.round(blue).toLocaleString("es-AR")}). Podés cambiar precio y moneda por línea.`
              : "⚠ Cargá la cotización del dólar (chip arriba) para sugerir precios en pesos."}
          </span>
        </div>

        {newClientName !== null && (
          <CustomerModal
            initialName={newClientName}
            onClose={() => setNewClientName(null)}
            onSaved={async (_msg, createdId) => {
              setNewClientName(null);
              try {
                const fresh = await api.listCustomers();
                setLocalCustomers(fresh);
              } catch { /* ignore */ }
              if (createdId) changeCustomer(createdId);
            }}
          />
        )}

        <div className="flex flex-col gap-2">
          <span className={labelCls}>Productos / ítems</span>
          {lines.map((l, i) => {
            const st = lineStatus(l);
            const units = availableUnitsFor(i);
            const serial = units !== null;
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
                    value={serial ? "1" : l.quantity}
                    onChange={(e) => setLine(i, { quantity: e.target.value })}
                    disabled={serial}
                    title={serial ? "Cada equipo es una unidad" : undefined}
                    className={fieldCls}
                    style={{ width: 56, flexShrink: 0, opacity: serial ? 0.6 : undefined }}
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
                    type="button"
                    onClick={() => setLine(i, { currency: (l.currency ?? "ARS") === "ARS" ? "USD" : "ARS", priceAuto: false })}
                    title="Moneda de la línea — clic para cambiar entre pesos ($) y dólares (US$)"
                    className={`${fieldCls} font-bold ${(l.currency ?? "ARS") === "USD" ? "text-primary" : "text-text-dim"}`}
                    style={{ width: 48, flexShrink: 0, cursor: "pointer" }}
                  >
                    {(l.currency ?? "ARS") === "USD" ? "US$" : "$"}
                  </button>
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
                    {Number(l.unitPrice) > 0 && (() => {
                      // Lectura formateada del precio + su equivalente en la otra
                      // moneda al blue — para que "1015050" se lea "$ 1.015.050 ≈ US$ 670".
                      const cur = l.currency ?? "ARS";
                      const p = Number(l.unitPrice) || 0;
                      const ref =
                        cur === "USD"
                          ? rate > 0 ? ` · ≈ ${money(Math.round(p * rate), "ARS")}` : ""
                          : rate > 0 ? ` · ≈ ${money(Math.round(p / rate), "USD")}` : "";
                      return (
                        <span className="whitespace-nowrap text-xs text-text-dim">
                          {money(p, cur)}{ref}
                        </span>
                      );
                    })()}
                    <span className="flex-1" />
                    {serial ? (
                      // Producto serializado → elegir la unidad exacta que sale.
                      (() => {
                        const noStock = units!.length === 0 && !l.imei;
                        return (
                          <select
                            value={l.imei ?? ""}
                            onChange={(e) => setLine(i, { imei: e.target.value || undefined, quantity: "1" })}
                            disabled={noStock}
                            className={fieldCls}
                            style={{
                              fontSize: 12,
                              padding: "6px 10px",
                              width: 224,
                              flexShrink: 0,
                              color: l.imei ? undefined : color.textDim,
                            }}
                          >
                            <option value="">{noStock ? "Sin unidades en stock" : "Elegí el equipo (IMEI)…"}</option>
                            {units!.map((u) => (
                              <option key={u.id} value={u.imei}>
                                {u.imei}
                              </option>
                            ))}
                          </select>
                        );
                      })()
                    ) : (
                      // Producto no serializado → IMEI / N° de serie libre (opcional).
                      <input
                        value={l.imei ?? ""}
                        onChange={(e) => setLine(i, { imei: e.target.value })}
                        placeholder="IMEI / N° de serie (opcional)"
                        autoComplete="off"
                        className={fieldCls}
                        style={{ fontSize: 12, padding: "6px 10px", width: 224, flexShrink: 0 }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={addLine} className="mt-0.5 w-full rounded-lg border border-dashed border-border-strong py-2 text-xs font-semibold text-text-muted transition-colors hover:border-primary hover:text-primary">
            + Agregar ítem
          </button>
        </div>

        {/* Plan canje: recibir un equipo usado como parte de pago */}
        {!tradeInOpen ? (
          <button
            onClick={() => setTradeInOpen(true)}
            className="-mt-1 w-full rounded-lg border border-dashed border-border-strong py-2 text-xs font-semibold text-text-muted transition-colors hover:border-primary hover:text-primary"
          >
            ↔ Plan canje · recibo un equipo en parte de pago
          </button>
        ) : (
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Plan canje · equipo recibido</span>
              <button
                onClick={() => {
                  setTradeInOpen(false);
                  setTiDesc("");
                  setTiImei("");
                  setTiCondition("");
                  setTiValue("");
                }}
                className="text-lg leading-none text-text-dim hover:text-danger"
                aria-label="Quitar plan canje"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <input
                value={tiDesc}
                onChange={(e) => setTiDesc(e.target.value)}
                placeholder="Equipo recibido (ej: iPhone 12 128GB)"
                className={fieldCls}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={tiImei}
                  onChange={(e) => setTiImei(e.target.value)}
                  placeholder="IMEI / N° de serie"
                  autoComplete="off"
                  className={fieldCls}
                />
                <input
                  value={tiCondition}
                  onChange={(e) => setTiCondition(e.target.value)}
                  placeholder="Estado (ej: batería 89%)"
                  className={fieldCls}
                />
              </div>
              {tradeInActive && tiImei.trim() === "" && (
                <div style={{ fontSize: text.xs, color: color.textDim }}>El IMEI/serie del equipo recibido es obligatorio — es el “DNI” del celular.</div>
              )}
              {tradeInActive && tiImei.trim() !== "" && !isValidDeviceId(tiImei) && (
                <div style={{ fontSize: text.xs, color: color.danger }}>IMEI inválido: deben ser 15 dígitos. Si no tiene IMEI, usá el N° de serie (con letras).</div>
              )}
              <input
                type="number"
                value={tiValue}
                onChange={(e) => setTiValue(e.target.value)}
                placeholder="Valor de toma ($)"
                className={fieldCls}
              />
              <span className="text-xs text-text-dim">
                Entra al stock como unidad usada (costo {money(tradeInValue, "ARS")}) y se descuenta del total.
              </span>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-surface-2 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-text-muted">Total</span>
            <span className="flex flex-col items-end">
              <span className="text-xl font-extrabold tracking-tight">{rate > 0 ? money(totalUsd, "USD") : money(total, "ARS")}</span>
              {rate > 0 && <span className="text-xs text-text-dim">≈ {money(total, "ARS")}</span>}
            </span>
          </div>
          {subtotalUsd > 0 && (
            <div className="mt-2 border-t border-border pt-2 text-xs">
              <div className="flex items-baseline justify-between">
                <span className="text-text-dim">Ítems en dólares</span>
                <span className="font-semibold">{money(subtotalUsd, "USD")}</span>
              </div>
              {subtotalArs > 0 && (
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="text-text-dim">Ítems en pesos</span>
                  <span className="font-semibold">{money(subtotalArs, "ARS")}</span>
                </div>
              )}
              <div className="mt-1 text-text-dim">
                {rate > 0
                  ? `Total en US$; la referencia ≈ en pesos usa el blue ${money(rate, "ARS")}.`
                  : "⚠ Cargá la cotización del dólar (chip arriba) para convertir los ítems en USD."}
              </div>
            </div>
          )}
          {tradeInValue > 0 && (
            <>
              <div className="mt-1.5 flex items-baseline justify-between text-sm">
                <span className="text-text-muted">Plan canje</span>
                <span className="font-semibold" style={{ color: color.success }}>
                  − {money(tradeInValue, "ARS")}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between border-t border-border pt-2">
                <span className="text-sm font-medium text-text-muted">A pagar</span>
                <span className="flex flex-col items-end">
                  <span className="text-lg font-extrabold tracking-tight">{rate > 0 ? money(dueUsd, "USD") : money(due, "ARS")}</span>
                  {rate > 0 && <span className="text-xs text-text-dim">≈ {money(due, "ARS")}</span>}
                </span>
              </div>
            </>
          )}
          {coverage.hasCosted && (
            <div
              className="mt-2 flex justify-between text-sm"
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
              {PAYMENT_METHODS_MANUAL.map((m) => (
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
            <span className="text-xs text-text-dim">Queda debiendo {rate > 0 ? money(Math.max(0, balanceUsd), "USD") : money(Math.max(0, balance), "ARS")}{rate > 0 ? ` (≈ ${money(Math.max(0, balance), "ARS")})` : ""}</span>
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
  const ws = useWorkspaceStore((s) => s.activeWorkspace);
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payMethod, setPayMethod] = useState<string>("efectivo");
  const [payAmount, setPayAmount] = useState("");
  // US$ es la moneda madre: al cobrar arrancamos en la moneda nativa de la venta.
  const [payCurrency, setPayCurrency] = useState<Currency>("ARS");

  async function load() {
    setLoadErr(false);
    try {
      const s = await api.getSale(saleId);
      setSale(s);
      // Default a la moneda de la venta (US$ si es US$-nativa) + prefill del saldo.
      const cur: Currency = s.balanceUsd != null ? "USD" : "ARS";
      const bal = cur === "USD" ? s.balanceUsd ?? 0 : s.balance;
      setPayCurrency(cur);
      setPayAmount(bal > 0.01 ? String(cur === "USD" ? Math.round(bal * 100) / 100 : Math.round(bal)) : "");
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
      await api.addPayment(saleId, { method: payMethod, amount: amt, currency: payCurrency });
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
                      <span className="font-semibold">{money(it.subtotal, it.currency ?? "ARS")}</span>
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
                <span className="flex flex-col items-end">
                  <span className="font-bold">{sale.totalUsd != null ? money(sale.totalUsd, "USD") : money(sale.total, "ARS")}</span>
                  {sale.totalUsd != null && <span className="text-xs text-text-dim">≈ {money(sale.total, "ARS")}</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Cobrado</span>
                <span>{sale.totalPaidUsd != null ? money(sale.totalPaidUsd, "USD") : money(sale.totalPaid, "ARS")}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-1">
                <span className="text-text-muted">Saldo</span>
                <span className={`font-bold ${sale.balance > 0.01 ? "text-warning" : "text-success"}`}>
                  {sale.balanceUsd != null ? money(sale.balanceUsd, "USD") : money(sale.balance, "ARS")}
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

            {(sale.balanceUsd != null ? sale.balanceUsd > 0.01 : sale.balance > 0.01) && (
              <div className="rounded-lg border border-border p-3">
                <div className={`${labelCls} mb-2`}>Registrar un pago</div>
                {/* Toggle US$/$ sólo en ventas US$-nativas (las legacy quedan en pesos). */}
                {sale.balanceUsd != null && (
                  <div className="mb-2 flex gap-1.5">
                    {(["USD", "ARS"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setPayCurrency(c);
                          const bal = c === "USD" ? sale.balanceUsd ?? 0 : sale.balance;
                          setPayAmount(bal > 0.01 ? String(c === "USD" ? Math.round(bal * 100) / 100 : Math.round(bal)) : "");
                        }}
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                          payCurrency === c
                            ? "border-primary bg-primary-bg text-primary"
                            : "border-border bg-surface-2 text-text-muted"
                        }`}
                      >
                        {c === "USD" ? "US$ Dólares" : "$ Pesos"}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={`${fieldCls} flex-1`}>
                    {PAYMENT_METHODS_MANUAL.map((m) => (
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
            <button
              onClick={() =>
                printComprobante(
                  { name: ws?.name ?? "Mi negocio", logoUrl: ws?.logoKey ? api.assetUrl(ws.logoKey) : null },
                  sale,
                )
              }
              className="rounded-lg bg-surface-2 px-3.5 py-2 text-sm font-semibold hover:bg-border-strong"
            >
              Comprobante
            </button>
            <button onClick={onClose} className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-hover">
              Cerrar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
