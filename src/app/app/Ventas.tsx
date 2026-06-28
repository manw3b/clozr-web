import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, Plus, MoreHorizontal, Check, Copy, Eye, Trash2, CheckCircle2, Clock, AlertCircle, Package, ShieldCheck, Download, FileText, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Input, Select } from "@/components/Input";
import { Tabs } from "@/components/Tabs";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { Drawer } from "@/components/Drawer";
import { Modal, ModalField } from "@/components/Modal";
import { Card, MetricCard } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { DataTable, applySort, type ColumnDef } from "@/components/data-table";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuDivider,
  ContextMenuLabel,
  useContextMenu,
} from "@/components/ContextMenu";
import { confirmAsync } from "@/lib/confirmAsync";
import { useUIStore } from "@/store/uiStore";
import { usePermissions } from "@/store/usePermissions";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney, dualMoney, formatRelative, formatDateLong, formatTime } from "@/lib/format";
import { useBlueRate } from "@/store/dollarStore";
import * as api from "@/lib/api";
import { exportToCsv, timestamp } from "@/lib/csv";
import { buildComprobanteText, printComprobante } from "@/lib/comprobante";
import { shareOnWhatsApp } from "@/lib/openExternal";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { TurnoFormDialog } from "./TurnoFormDialog";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS_MANUAL, saleCode } from "@/lib/types";
import type { Currency, Customer, Sale, SaleDetail } from "@/lib/types";

type SaleStatus = "paid" | "partial" | "pending";

function statusOf(s: Sale): SaleStatus {
  if (s.isPaid || s.balance <= 0.01) return "paid";
  if (s.totalPaid > 0) return "partial";
  return "pending";
}

const STATUS_FILTERS = [
  { value: "todos", label: "Todas" },
  { value: "paid", label: "Pagadas" },
  { value: "partial", label: "Parciales" },
  { value: "pending", label: "Pendientes" },
];

const PERIOD_FILTERS = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "all", label: "Todas" },
];

/**
 * Vista Ventas — re-portada desde la desktop (antes era la versión vieja en
 * Tailwind). Tabla + KPIs + filtros + drawer de detalle (ítems + cobros)
 * con los componentes reales. La creación reusa el modal de Crm (callback
 * onNewSale + evento `clozr:sale-changed` para refrescar). DIFERIDO: spark
 * chart lateral, export CSV, mensaje/comprobante por WhatsApp, banner de
 * regularización.
 */
/** Etiqueta corta del turno para la lista, ej "3 jul · 14:00". appointmentAt es
 *  wall-clock local → new Date lo parsea en hora local (sin corrimiento UTC). */
function turnoShort(at: string): string {
  const d = new Date(at);
  if (isNaN(d.getTime())) return at;
  return `${d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} · ${formatTime(at)}`;
}

export function Ventas({
  onNewSale,
  customers = [],
  initialOpenSaleId,
  onConsumeInitial,
}: {
  onNewSale: () => void;
  customers?: Customer[];
  initialOpenSaleId?: string | null;
  onConsumeInitial?: () => void;
}) {
  const { showToast } = useUIStore();
  const blue = useBlueRate();
  const { can } = usePermissions();
  const canWrite = can("sales.write");
  const businessName = useWorkspaceStore((s) => s.activeWorkspace?.name) ?? "";
  // Teléfono por cliente para prefillar el comprobante por WhatsApp (si la venta
  // tiene cliente cargado; si no, se abre el selector de contactos).
  const phoneById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of customers) if (c.phone) m.set(c.id, c.phone);
    return m;
  }, [customers]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [periodFilter, setPeriodFilter] = useState("30d");
  const [sort, setSort] = useState<{ columnId: string; direction: "asc" | "desc" } | null>({
    columnId: "createdAt",
    direction: "desc",
  });
  const [openId, setOpenId] = useState<string | null>(null);
  // Abrir una venta puntual al entrar desde la Agenda (click en un turno).
  useEffect(() => {
    if (initialOpenSaleId) {
      setOpenId(initialOpenSaleId);
      onConsumeInitial?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpenSaleId]);
  const ctxMenu = useContextMenu();
  const [ctxSale, setCtxSale] = useState<Sale | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listSales()
      .then(setSales)
      .catch(() => showToast("No se pudieron cargar las ventas", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Refrescar cuando se crea/cambia una venta desde fuera (modal de Crm).
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("clozr:sale-changed", handler);
    return () => window.removeEventListener("clozr:sale-changed", handler);
  }, [load]);

  const periodFiltered = useMemo(() => {
    if (periodFilter === "all") return sales;
    const now = Date.now();
    let cutoff = 0;
    if (periodFilter === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      cutoff = d.getTime();
    } else if (periodFilter === "7d") cutoff = now - 7 * 86400_000;
    else if (periodFilter === "30d") cutoff = now - 30 * 86400_000;
    return sales.filter((s) => {
      const dt = s.createdAt ?? s.saleDate;
      return dt ? new Date(dt).getTime() >= cutoff : false;
    });
  }, [sales, periodFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodFiltered.filter((s) => {
      if (statusFilter !== "todos" && statusOf(s) !== statusFilter) return false;
      if (q) return (s.customerName ?? "").toLowerCase().includes(q) || String(s.total).includes(q);
      return true;
    });
  }, [periodFiltered, search, statusFilter]);

  const totals = useMemo(() => {
    let vendido = 0,
      cobrado = 0,
      porCobrar = 0;
    for (const s of periodFiltered) {
      vendido += s.total;
      cobrado += s.totalPaid;
      if (s.balance > 0) porCobrar += s.balance;
    }
    return { vendido, cobrado, porCobrar, count: periodFiltered.length };
  }, [periodFiltered]);

  const columns = useMemo<ColumnDef<Sale>[]>(
    () => [
      {
        id: "clientName",
        header: "Cliente",
        sortable: true,
        width: "minmax(200px, 1.5fr)",
        cell: (s) => {
          const code = saleCode(s);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: space[3], minWidth: 0 }}>
              <Avatar name={s.customerName || "Consumidor final"} size={28} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.customerName || "Consumidor final"}
                </div>
                {code && (
                  <div style={{ fontSize: 10, color: color.textMuted, fontVariantNumeric: "tabular-nums", letterSpacing: "0.5px", marginTop: 1 }}>
                    {code}
                  </div>
                )}
                {s.appointmentAt && (
                  <div style={{ fontSize: 10, color: color.primary, fontWeight: weight.semibold, display: "flex", alignItems: "center", gap: 3, marginTop: 1 }}>
                    <CalendarClock size={10} /> {turnoShort(s.appointmentAt)}
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "amount",
        header: "Monto",
        sortable: true,
        width: "150px",
        align: "right",
        cell: (s) => (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: text.sm, fontWeight: weight.bold, color: color.text, fontVariantNumeric: "tabular-nums" }}>
              {formatMoney(s.total)}
            </div>
            {statusOf(s) === "partial" && (
              <div style={{ fontSize: 10, color: color.warning, fontWeight: weight.semibold, marginTop: 1 }}>
                Falta {formatMoney(s.balance)}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "status",
        header: "Estado",
        sortable: true,
        width: "120px",
        cell: (s) => {
          const st = statusOf(s);
          return st === "paid" ? (
            <Badge tone="success" size="sm" dot>Pagado</Badge>
          ) : st === "partial" ? (
            <Badge tone="warning" size="sm" dot>Parcial</Badge>
          ) : (
            <Badge tone="danger" size="sm" dot>Pendiente</Badge>
          );
        },
      },
      {
        id: "paymentMethod",
        header: "Pago",
        sortable: true,
        width: "130px",
        cell: (s) => (
          <span style={{ fontSize: text.xs, color: color.textMuted }}>
            {s.paymentMethod ? PAYMENT_METHOD_LABELS[s.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? s.paymentMethod : "—"}
          </span>
        ),
      },
      {
        id: "createdAt",
        header: "Fecha",
        sortable: true,
        width: "120px",
        cell: (s) => (
          <span style={{ fontSize: text.xs, color: color.textMuted }}>
            {s.createdAt || s.saleDate ? formatRelative((s.createdAt ?? s.saleDate)!) : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        width: "56px",
        align: "right",
        cell: (s) => (
          <button
            aria-label="Más acciones"
            className="btn-icon muted"
            onClick={(e) => {
              e.stopPropagation();
              setCtxSale(s);
              ctxMenu.openAt(e);
            }}
            style={{ width: 28, height: 28, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <MoreHorizontal size={14} strokeWidth={2.2} />
          </button>
        ),
      },
    ],
    [ctxMenu],
  );

  const sortedRows = useMemo(
    () =>
      applySort(filtered, columns, sort, (row, columnId) => {
        const s = row as Sale;
        switch (columnId) {
          case "clientName":
            return s.customerName ?? "";
          case "amount":
            return s.total;
          case "status":
            return statusOf(s);
          case "paymentMethod":
            return s.paymentMethod ?? "";
          case "createdAt":
            return new Date((s.createdAt ?? s.saleDate) ?? 0).getTime();
          default:
            return "";
        }
      }),
    [filtered, columns, sort],
  );

  async function markPaid(s: Sale) {
    try {
      // US$ es la moneda madre: saldamos el saldo congelado en US$ (no se licúa
      // con el blue). Legacy sin US$ → cae a pesos.
      if (s.balanceUsd != null && s.balanceUsd > 0.01) {
        await api.addPayment(s.id, { method: "efectivo", amount: s.balanceUsd, currency: "USD" });
      } else {
        await api.addPayment(s.id, { method: "efectivo", amount: s.balance, currency: "ARS" });
      }
      showToast("Venta marcada como pagada", "success");
      load();
    } catch {
      showToast("No se pudo registrar el pago", "error");
    }
  }

  async function remove(s: Sale) {
    const ok = await confirmAsync({
      title: "Eliminar venta",
      message: `¿Eliminar la venta de ${s.customerName || "Consumidor final"} por ${formatMoney(s.total)}?`,
      confirmText: "Eliminar",
      tone: "danger",
    });
    if (!ok) return;
    const snapshot = sales;
    setSales((prev) => prev.filter((x) => x.id !== s.id));
    if (openId === s.id) setOpenId(null);
    try {
      await api.deleteSale(s.id);
      showToast("Venta eliminada", "success");
    } catch {
      setSales(snapshot);
      showToast("No se pudo eliminar", "error");
    }
  }

  function exportCsv() {
    exportToCsv(`ventas-${timestamp()}.csv`, filtered, [
      ["Fecha", (s) => { const d = s.createdAt ?? s.saleDate; return d ? new Date(d).toLocaleString("es-AR") : ""; }],
      ["Cliente", (s) => s.customerName || "Consumidor final"],
      ["Total", (s) => s.total],
      ["Cobrado", (s) => s.totalPaid],
      ["Saldo", (s) => s.balance],
      ["Estado", (s) => (statusOf(s) === "paid" ? "Pagado" : statusOf(s) === "partial" ? "Parcial" : "Pendiente")],
      ["Pago", (s) => (s.paymentMethod ? PAYMENT_METHOD_LABELS[s.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? s.paymentMethod : "")],
      ["Vendedor", (s) => s.sellerName ?? ""],
      ["Comprobante", (s) => saleCode(s) ?? s.id.slice(-6).toUpperCase()],
    ]);
    showToast(`${filtered.length} ${filtered.length === 1 ? "venta exportada" : "ventas exportadas"}`, "success");
  }

  async function sendReceiptWhatsApp(s: Sale) {
    try {
      const d = await api.getSale(s.id);
      shareOnWhatsApp(buildComprobanteText({ name: businessName }, d), s.customerId ? phoneById.get(s.customerId) : undefined);
    } catch {
      showToast("No se pudo generar el comprobante", "error");
    }
  }

  const openSale = openId ? sales.find((s) => s.id === openId) ?? null : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5], height: "100%" }}>
      <PageHeader
        title="Ventas"
        subtitle={loading ? "Cargando…" : `${filtered.length} ${filtered.length === 1 ? "venta" : "ventas"} · ${dualMoney(totals.vendido, blue).main} en el período`}
        actions={
          <div style={{ display: "flex", gap: space[2] }}>
            <Button variant="secondary" size="md" iconLeft={<Download size={15} />} onClick={exportCsv} disabled={filtered.length === 0}>
              Exportar
            </Button>
            {canWrite && (
              <Button variant="primary" size="md" iconLeft={<Plus size={16} />} onClick={onNewSale}>
                Nueva venta
              </Button>
            )}
          </div>
        }
      />

      <div className="cz-metric-grid">
        <MetricCard label="Vendido" value={dualMoney(totals.vendido, blue).main} sub={dualMoney(totals.vendido, blue).sub} />
        <MetricCard label="Cobrado" value={dualMoney(totals.cobrado, blue).main} sub={dualMoney(totals.cobrado, blue).sub} tone="success" />
        <MetricCard label="Por cobrar" value={dualMoney(totals.porCobrar, blue).main} sub={dualMoney(totals.porCobrar, blue).sub} tone={totals.porCobrar > 0 ? "warning" : "neutral"} />
        <MetricCard label="Ventas" value={String(totals.count)} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: space[3], flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240, maxWidth: 380 }}>
          <Input placeholder="Buscar por cliente o monto…" iconLeft={<Search size={15} />} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs variant="pills" size="sm" value={statusFilter} onChange={setStatusFilter} items={STATUS_FILTERS} />
        <div style={{ flex: 1 }} />
        <Tabs variant="pills" size="sm" value={periodFilter} onChange={setPeriodFilter} items={PERIOD_FILTERS} />
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <DataTable
          rows={sortedRows}
          columns={columns}
          getRowId={(s) => s.id}
          onRowClick={(s) => setOpenId(s.id)}
          onRowContextMenu={(s, e) => {
            setCtxSale(s);
            ctxMenu.openAt(e);
          }}
          activeRowId={openId || undefined}
          sort={sort || undefined}
          onSortChange={setSort}
          density="normal"
          empty={
            <EmptyState
              icon={<Search size={24} />}
              title={search.trim() ? "Sin resultados" : "Sin ventas en este período"}
              description={search.trim() ? `No encontramos ventas que coincidan con "${search}"` : "Probá ampliar el período o crear una nueva venta."}
              action={search.trim() ? { label: "Limpiar búsqueda", onClick: () => setSearch(""), variant: "secondary" } : canWrite ? { label: "Nueva venta", onClick: onNewSale, iconLeft: <Plus size={14} /> } : undefined}
            />
          }
        />
      </div>

      {openSale && (
        <SaleDrawer
          sale={openSale}
          customerPhone={openSale.customerId ? phoneById.get(openSale.customerId) : undefined}
          onClose={() => setOpenId(null)}
          onChanged={load}
          canWrite={canWrite}
        />
      )}

      {ctxMenu.open && ctxSale && (
        <ContextMenu position={ctxMenu.position} onClose={ctxMenu.close}>
          <ContextMenuLabel>
            {(ctxSale.customerName || "Sin cliente") + " · " + formatMoney(ctxSale.total)}
          </ContextMenuLabel>
          <ContextMenuItem icon={<Eye size={14} />} onClick={() => { setOpenId(ctxSale.id); ctxMenu.close(); }}>
            Ver detalle
          </ContextMenuItem>
          {canWrite && statusOf(ctxSale) !== "paid" && (
            <ContextMenuItem icon={<Check size={14} />} onClick={() => { const s = ctxSale; ctxMenu.close(); markPaid(s); }}>
              Marcar como pagada
            </ContextMenuItem>
          )}
          <ContextMenuItem icon={<Copy size={14} />} onClick={() => { navigator.clipboard.writeText(ctxSale.id).catch(() => {}); showToast("ID copiado", "success"); ctxMenu.close(); }}>
            Copiar ID
          </ContextMenuItem>
          <ContextMenuItem icon={<WhatsAppIcon size={13} color="var(--success)" />} onClick={() => { const s = ctxSale; ctxMenu.close(); sendReceiptWhatsApp(s); }}>
            Comprobante por WhatsApp
          </ContextMenuItem>
          {canWrite && (
            <>
              <ContextMenuDivider />
              <ContextMenuItem tone="danger" icon={<Trash2 size={14} />} onClick={() => { const s = ctxSale; ctxMenu.close(); remove(s); }}>
                Eliminar
              </ContextMenuItem>
            </>
          )}
        </ContextMenu>
      )}
    </div>
  );
}

/* ───────── SaleDrawer ───────── */

function SaleDrawer({ sale, customerPhone, onClose, onChanged, canWrite }: { sale: Sale; customerPhone?: string; onClose: () => void; onChanged: () => void; canWrite: boolean }) {
  const { showToast } = useUIStore();
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [warrantyOpen, setWarrantyOpen] = useState(false);
  const [turnoOpen, setTurnoOpen] = useState(false);
  const businessName = useWorkspaceStore((s) => s.activeWorkspace?.name) ?? "";
  const code = saleCode(sale);

  const reload = useCallback(() => {
    api.getSale(sale.id).then(setDetail).catch(() => {});
  }, [sale.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const st = statusOf(sale);
  const remaining = sale.balance;

  async function markPaid() {
    try {
      // US$ es la moneda madre: saldamos el saldo congelado en US$. Legacy → pesos.
      if (sale.balanceUsd != null && sale.balanceUsd > 0.01) {
        await api.addPayment(sale.id, { method: "efectivo", amount: sale.balanceUsd, currency: "USD" });
      } else {
        await api.addPayment(sale.id, { method: "efectivo", amount: remaining, currency: "ARS" });
      }
      showToast("Venta cobrada", "success");
      reload();
      onChanged();
    } catch {
      showToast("No se pudo registrar el pago", "error");
    }
  }

  function sendReceipt() {
    if (!detail) return;
    shareOnWhatsApp(buildComprobanteText({ name: businessName }, detail), customerPhone);
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width="560px"
      header={
        <header style={{ padding: `${space[4]} ${space[5]}`, borderBottom: `1px solid ${color.border}`, display: "flex", alignItems: "flex-start", gap: space[3], flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>
              Venta{code ? ` · ${code}` : ""}
            </div>
            <h2 style={{ margin: 0, fontSize: text.lg, fontWeight: weight.bold, color: color.text, letterSpacing: "-0.3px" }}>
              {sale.customerName || "Consumidor final"}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="btn-icon muted" style={{ width: 28, height: 28, borderRadius: radius.sm, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 300 }}>×</span>
          </button>
        </header>
      }
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
          {canWrite && st !== "paid" && (
            <div style={{ display: "flex", gap: space[2] }}>
              <Button variant="secondary" size="md" onClick={() => setPayOpen(true)} fullWidth>
                Registrar pago
              </Button>
              <Button variant="primary" size="md" iconLeft={<CheckCircle2 size={15} />} onClick={markPaid} fullWidth>
                Marcar pagado
              </Button>
            </div>
          )}
          {st === "paid" && (
            <div style={{ textAlign: "center", fontSize: text.sm, color: color.success, fontWeight: weight.semibold }}>✓ Venta cobrada</div>
          )}
          <div style={{ display: "flex", gap: space[2] }}>
            <Button variant="secondary" size="md" iconLeft={<WhatsAppIcon size={15} color="var(--success)" />} onClick={sendReceipt} disabled={!detail} fullWidth>
              Comprobante WhatsApp
            </Button>
            <Button variant="ghost" size="md" iconLeft={<FileText size={15} />} onClick={() => detail && printComprobante({ name: businessName }, detail)} disabled={!detail} title="Comprobante en PDF" />
          </div>
          {canWrite && (
            <Button variant="secondary" size="md" iconLeft={<CalendarClock size={15} />} onClick={() => setTurnoOpen(true)} disabled={!detail} fullWidth>
              Generar turno
            </Button>
          )}
          {canWrite && (
            <Button variant="ghost" size="md" iconLeft={<ShieldCheck size={15} />} onClick={() => setWarrantyOpen(true)} fullWidth>
              Enviar garantía por mail
            </Button>
          )}
        </div>
      }
    >
      <div style={{ padding: space[5], borderBottom: `1px solid ${color.border}`, textAlign: "center" }}>
        <div style={{ fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>
          Total de la venta
        </div>
        <div style={{ fontSize: text["3xl"], fontWeight: weight.bold, color: color.text, letterSpacing: "-0.8px", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
          {formatMoney(sale.total)}
        </div>
        <div style={{ marginTop: space[2], display: "inline-flex" }}>
          {st === "paid" ? <Badge tone="success" size="md" dot>Pagado</Badge> : st === "partial" ? <Badge tone="warning" size="md" dot>Parcial</Badge> : <Badge tone="danger" size="md" dot>Sin pagar</Badge>}
        </div>
        {st !== "paid" && (
          <div style={{ marginTop: space[3], padding: `${space[2]} ${space[3]}`, background: color.warningBg, border: `1px solid ${color.warning}`, borderRadius: radius.md, display: "inline-flex", alignItems: "center", gap: space[2], fontSize: text.sm, fontWeight: weight.semibold, color: color.warning }}>
            <AlertCircle size={14} strokeWidth={2.4} />
            <span>Falta {formatMoney(remaining)}</span>
          </div>
        )}
      </div>

      <div style={{ padding: space[5] }}>
        <Section title={`Productos${detail ? ` · ${detail.items.length}` : ""}`}>
          {!detail ? (
            <div style={{ fontSize: text.sm, color: color.textMuted, padding: space[3] }}>Cargando…</div>
          ) : detail.items.length === 0 ? (
            <div style={{ padding: space[3], background: color.surface2, border: `1px solid ${color.border}`, borderRadius: radius.md, fontSize: text.sm, color: color.textMuted }}>Sin ítems detallados.</div>
          ) : (
            <div style={{ background: color.surface2, border: `1px solid ${color.border}`, borderRadius: radius.md, overflow: "hidden" }}>
              {detail.items.map((it, idx) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: space[3], padding: space[3], borderBottom: idx < detail.items.length - 1 ? `1px solid ${color.border}` : "none" }}>
                  <div style={{ width: 40, height: 40, background: color.surface, borderRadius: radius.sm, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: color.textDim }}>
                    <Package size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.description}</div>
                    <div style={{ fontSize: text.xs, color: color.textMuted, marginTop: 2 }}>
                      {it.quantity > 1 ? `${it.quantity} × ${formatMoney(it.unitPrice)}` : formatMoney(it.unitPrice)}
                    </div>
                  </div>
                  <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text, fontVariantNumeric: "tabular-nums" }}>{formatMoney(it.subtotal)}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Detalle">
          <Row label="Forma de pago" value={sale.paymentMethod ? PAYMENT_METHOD_LABELS[sale.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? sale.paymentMethod : "—"} />
          {(sale.createdAt || sale.saleDate) && <Row label="Fecha" value={`${formatDateLong((sale.createdAt ?? sale.saleDate)!)} · ${formatTime((sale.createdAt ?? sale.saleDate)!)}`} />}
          {sale.appointmentAt && <Row label="Turno" value={`${formatDateLong(sale.appointmentAt)} · ${formatTime(sale.appointmentAt)}`} />}
          {sale.origin && <Row label="Origen" value={sale.origin} />}
          {sale.sellerName && <Row label="Vendedor" value={sale.sellerName} />}
        </Section>

        <Section title="Cobros">
          {detail && detail.payments.length > 0 ? (
            detail.payments.map((p) => (
              <PaymentRow key={p.id} amount={p.amount} currency={p.currency} kind="paid" method={p.method} />
            ))
          ) : sale.totalPaid > 0 ? (
            <PaymentRow
              amount={sale.totalPaidUsd ?? sale.totalPaid}
              currency={sale.totalPaidUsd != null ? "USD" : "ARS"}
              kind="paid"
              method={sale.paymentMethod}
            />
          ) : null}
          {remaining > 0 && (
            <PaymentRow
              amount={sale.balanceUsd ?? remaining}
              currency={sale.balanceUsd != null ? "USD" : "ARS"}
              kind="pending"
            />
          )}
        </Section>

        {sale.notes && (
          <Section title="Notas">
            <p style={{ margin: 0, fontSize: text.sm, color: color.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{sale.notes}</p>
          </Section>
        )}
      </div>

      <PaymentModal
        open={payOpen}
        maxAmount={remaining}
        maxAmountUsd={sale.balanceUsd ?? null}
        onClose={() => setPayOpen(false)}
        onSubmit={async (amount, method, currency) => {
          try {
            await api.addPayment(sale.id, { method, amount, currency });
            showToast("Pago registrado", "success");
            setPayOpen(false);
            reload();
            onChanged();
          } catch {
            showToast("No se pudo registrar el pago", "error");
          }
        }}
      />

      <WarrantyModal
        open={warrantyOpen}
        sale={sale}
        detail={detail}
        businessName={businessName}
        onClose={() => setWarrantyOpen(false)}
      />

      {turnoOpen && detail && (
        <TurnoFormDialog
          customers={[]}
          sale={detail}
          salePhone={customerPhone}
          onClose={() => setTurnoOpen(false)}
          onSaved={() => { reload(); onChanged(); }}
        />
      )}
    </Drawer>
  );
}

function WarrantyModal({
  open,
  sale,
  detail,
  businessName,
  onClose,
}: {
  open: boolean;
  sale: Sale;
  detail: SaleDetail | null;
  businessName: string;
  onClose: () => void;
}) {
  const { showToast } = useUIStore();
  const [email, setEmail] = useState("");
  const [months, setMonths] = useState("6");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setMonths("6");
    }
  }, [open]);

  const items = (detail?.items ?? []).map((i) => i.description).filter(Boolean).join(", ");
  const canSend = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar garantía"
      maxWidth={420}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!canSend}
            loading={sending}
            onClick={async () => {
              setSending(true);
              try {
                await api.sendWarranty(sale.id, {
                  to: email.trim(),
                  customerName: sale.customerName || "Cliente",
                  businessName,
                  items,
                  months: Number(months),
                  startDate: new Date().toLocaleDateString("es-AR"),
                });
                showToast("Garantía enviada al cliente", "success");
                onClose();
              } catch {
                showToast("No se pudo enviar la garantía", "error");
              } finally {
                setSending(false);
              }
            }}
          >
            Enviar
          </Button>
        </>
      }
    >
      <ModalField label="Email del cliente" required>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@gmail.com" autoFocus />
      </ModalField>
      <ModalField label="Garantía">
        <Select value={months} onChange={(e) => setMonths(e.target.value)}>
          <option value="3">3 meses</option>
          <option value="6">6 meses</option>
          <option value="12">12 meses</option>
        </Select>
      </ModalField>
      {items && (
        <div style={{ fontSize: text.xs, color: color.textMuted, marginTop: space[2] }}>
          Producto: {items}
        </div>
      )}
    </Modal>
  );
}

function PaymentModal({
  open,
  maxAmount,
  maxAmountUsd,
  onClose,
  onSubmit,
}: {
  open: boolean;
  maxAmount: number;            // saldo en ARS (referencia / venta legacy)
  maxAmountUsd?: number | null; // saldo en US$ congelado (si la venta es US$-nativa)
  onClose: () => void;
  onSubmit: (amount: number, method: string, currency: Currency) => void;
}) {
  // El toggle US$/$ sólo aplica a ventas US$-nativas (con saldo en dólares). En
  // las legacy en pesos no lo mostramos: cobrar US$ sobre un total ARS mezclaría
  // monedas en el saldo. Cuando el dueño corre el backfill, pasan a US$ y aparece.
  const hasUsd = maxAmountUsd != null;
  const [currency, setCurrency] = useState<Currency>(hasUsd ? "USD" : "ARS");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const balanceFor = useCallback(
    (c: Currency) => (c === "USD" ? maxAmountUsd ?? 0 : maxAmount),
    [maxAmount, maxAmountUsd],
  );
  const prefillFor = useCallback(
    (c: Currency) => {
      const m = balanceFor(c);
      if (m <= 0) return "";
      return String(c === "USD" ? Math.round(m * 100) / 100 : Math.round(m));
    },
    [balanceFor],
  );

  useEffect(() => {
    if (!open) return;
    const c: Currency = hasUsd ? "USD" : "ARS";
    setCurrency(c);
    setAmount(prefillFor(c));
    setMethod("efectivo");
    // Seleccionar el saldo prefilleado al abrir: si el monto es el correcto
    // alcanza con Enter; si no, se tipea otro encima sin tener que borrar.
    const id = requestAnimationFrame(() => amountRef.current?.select());
    return () => cancelAnimationFrame(id);
  }, [open, hasUsd, prefillFor]);

  function pickCurrency(c: Currency) {
    if (c === currency) return;
    setCurrency(c);
    setAmount(prefillFor(c));
  }

  const n = Number(amount);
  const canSubmit = n > 0;

  async function handleSubmit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    await onSubmit(n, method, currency);
    setSaving(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar pago"
      maxWidth={420}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!canSubmit} loading={saving} onClick={handleSubmit}>
            Registrar
          </Button>
        </>
      }
    >
      {hasUsd && (
        <ModalField label="Moneda">
          <div style={{ display: "flex", gap: space[2] }}>
            {(["USD", "ARS"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pickCurrency(c)}
                style={{
                  flex: 1,
                  padding: `${space[2]} ${space[3]}`,
                  borderRadius: radius.md,
                  background: currency === c ? color.primaryBg : color.surface2,
                  border: `1px solid ${currency === c ? color.primary : color.border}`,
                  color: currency === c ? color.primary : color.textMuted,
                  fontSize: text.sm,
                  fontWeight: weight.semibold,
                  cursor: "pointer",
                }}
              >
                {c === "USD" ? "US$ Dólares" : "$ Pesos"}
              </button>
            ))}
          </div>
        </ModalField>
      )}
      <ModalField label="Monto" required>
        <Input
          ref={amountRef}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="0"
          autoFocus
        />
        {balanceFor(currency) > 0 && (
          <div style={{ marginTop: space[1], fontSize: text.xs, color: color.textDim }}>
            Saldo: {formatMoney(Math.round(balanceFor(currency)), currency)}
          </div>
        )}
      </ModalField>
      <ModalField label="Método">
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          {PAYMENT_METHODS_MANUAL.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
      </ModalField>
    </Modal>
  );
}

/* ───────── helpers ───────── */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: space[5] }}>
      <h3 style={{ margin: 0, marginBottom: space[3], fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.8px" }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: space[3], padding: `${space[2]} 0`, borderBottom: `1px solid ${color.border}` }}>
      <span style={{ fontSize: text.sm, color: color.textMuted }}>{label}</span>
      <span style={{ fontSize: text.sm, color: color.text, fontWeight: weight.medium, textAlign: "right", minWidth: 0 }}>{value}</span>
    </div>
  );
}

function PaymentRow({ amount, kind, method, currency = "ARS" }: { amount: number; kind: "paid" | "pending"; method?: string; currency?: Currency }) {
  return (
    <div style={{ padding: space[3], background: color.surface2, border: `1px solid ${color.border}`, borderRadius: radius.md, display: "flex", alignItems: "center", gap: space[3], marginBottom: space[2] }}>
      <div style={{ width: 32, height: 32, borderRadius: radius.md, background: kind === "paid" ? color.successBg : color.warningBg, color: kind === "paid" ? color.success : color.warning, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {kind === "paid" ? <CheckCircle2 size={15} strokeWidth={2.4} /> : <Clock size={15} strokeWidth={2.4} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text, marginBottom: 1 }}>{kind === "paid" ? "Cobrado" : "Pendiente de cobro"}</div>
        {method && <div style={{ fontSize: text.xs, color: color.textMuted }}>{PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method}</div>}
      </div>
      <div style={{ fontSize: text.sm, fontWeight: weight.bold, color: color.text, fontVariantNumeric: "tabular-nums" }}>{formatMoney(Math.round(amount), currency)}</div>
    </div>
  );
}
