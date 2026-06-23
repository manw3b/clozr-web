import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Search,
  Plus,
  MoreHorizontal,
  Users,
  Phone,
  Pencil,
  Trash2,
  Mail,
  Copy,
  DollarSign,
  Upload,
  Zap,
  CalendarClock,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Input, Select } from "@/components/Input";
import { Tabs } from "@/components/Tabs";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { Drawer } from "@/components/Drawer";
import { Modal, ModalField } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { InstagramIcon } from "@/components/icons/SocialIcons";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuDivider,
  ContextMenuLabel,
  useContextMenu,
} from "@/components/ContextMenu";
import { DataTable, applySort, type ColumnDef } from "@/components/data-table";
import { ImportClientsModal } from "./ImportClientsModal";
import { QuickWhatsAppPicker } from "./QuickWhatsAppPicker";
import { TurnoFormDialog } from "./TurnoFormDialog";
import { RepairDialog } from "./Repairs";
import { confirmAsync } from "@/lib/confirmAsync";
import { openWhatsApp, openTel, openMail, openInstagram, instagramHandle } from "@/lib/openExternal";
import { AiSuggestions } from "./AiSuggestions";
import { AiSummary } from "./AiSummary";
import { useUIStore } from "@/store/uiStore";
import { usePermissions } from "@/store/usePermissions";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney, formatDateLong } from "@/lib/format";
import * as api from "@/lib/api";
import { CLIENT_TYPE_LABELS, CLIENT_TYPES } from "@/lib/types";
import type { ClientType, Customer, Sale } from "@/lib/types";

interface CustomerStats {
  purchases: number;
  lifetime: number;
  debt: number;
}

function typeBadgeTone(type: ClientType): "neutral" | "info" | "primary" | "warning" {
  switch (type) {
    case "revendedor":
      return "info";
    case "mayorista":
      return "primary";
    case "empresa":
      return "warning";
    default:
      return "neutral";
  }
}

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "final", label: "Final" },
  { value: "revendedor", label: "Revendedor" },
  { value: "mayorista", label: "Mayorista" },
  { value: "empresa", label: "Empresa" },
];

/**
 * Vista Clientes — re-portada desde la desktop (antes era una versión vieja
 * en Tailwind). Tabla con los componentes reales (DataTable) + drawer de
 * detalle + form. Las métricas Compras/Histórico/Deuda se calculan
 * client-side de listSales (la web no las trae del Worker). DIFERIDO de la
 * desktop: etiquetas, redes sociales, último-contacto/estado, historial
 * (timeline), deuda manual, import CSV, acciones masivas.
 */
export function Clientes({ onNewSale }: { onNewSale: () => void }) {
  const { showToast } = useUIStore();
  const { can } = usePermissions();
  const canWrite = can("customers.write");
  const canSell = can("sales.write");
  const canRepair = can("repairs.write");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [sort, setSort] = useState<{ columnId: string; direction: "asc" | "desc" } | null>({
    columnId: "name",
    direction: "asc",
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [quickFor, setQuickFor] = useState<Customer | null>(null);
  const [turnoFor, setTurnoFor] = useState<Customer | null>(null);
  const [repairFor, setRepairFor] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const ctxMenu = useContextMenu();
  const [ctxCustomer, setCtxCustomer] = useState<Customer | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.listCustomers(), api.listSales()])
      .then(([cs, sl]) => {
        setCustomers(cs);
        setSales(sl);
      })
      .catch(() => showToast("No se pudieron cargar los clientes", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const statsByCustomer = useMemo(() => {
    const map = new Map<string, CustomerStats>();
    for (const s of sales) {
      if (!s.customerId) continue;
      const st = map.get(s.customerId) ?? { purchases: 0, lifetime: 0, debt: 0 };
      st.purchases += 1;
      st.lifetime += s.total;
      if (s.balance > 0) st.debt += s.balance;
      map.set(s.customerId, st);
    }
    return map;
  }, [sales]);

  const statsFor = useCallback(
    (id: string): CustomerStats => statsByCustomer.get(id) ?? { purchases: 0, lifetime: 0, debt: 0 },
    [statsByCustomer],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (typeFilter !== "todos" && c.type !== typeFilter) return false;
      if (q) {
        return (
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [customers, search, typeFilter]);

  async function remove(c: Customer) {
    const ok = await confirmAsync({
      title: `Eliminar a ${c.name}`,
      message: `Vas a eliminar a ${c.name} de tu cartera. El historial de ventas queda en la DB pero sin nombre asociado.`,
      confirmText: "Eliminar",
      tone: "danger",
    });
    if (!ok) return;
    const snapshot = customers;
    setCustomers((prev) => prev.filter((x) => x.id !== c.id));
    if (openId === c.id) setOpenId(null);
    try {
      await api.deleteCustomer(c.id);
      showToast("Cliente eliminado", "success");
    } catch {
      setCustomers(snapshot);
      showToast("No se pudo eliminar", "error");
    }
  }

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        id: "name",
        header: "Cliente",
        sortable: true,
        width: "minmax(220px, 1.5fr)",
        cell: (c) => (
          <div style={{ display: "flex", alignItems: "center", gap: space[3], minWidth: 0 }}>
            <Avatar name={c.name} size={32} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.name}
              </div>
              {c.phone && (
                <div style={{ fontSize: text.xs, color: color.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.phone}
                </div>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "type",
        header: "Tipo",
        sortable: true,
        width: "140px",
        cell: (c) => (
          <Badge tone={typeBadgeTone(c.type)} size="sm">
            {CLIENT_TYPE_LABELS[c.type]}
          </Badge>
        ),
      },
      {
        id: "purchases",
        header: "Compras",
        sortable: true,
        width: "90px",
        align: "right",
        cell: (c) => (
          <span style={{ fontSize: text.sm, color: color.textMuted, fontVariantNumeric: "tabular-nums" }}>
            {statsFor(c.id).purchases}
          </span>
        ),
      },
      {
        id: "lifetime",
        header: "Histórico",
        sortable: true,
        width: "140px",
        align: "right",
        cell: (c) => {
          const v = statsFor(c.id).lifetime;
          return (
            <span style={{ fontSize: text.sm, color: color.text, fontWeight: weight.medium, fontVariantNumeric: "tabular-nums" }}>
              {v ? formatMoney(v) : "—"}
            </span>
          );
        },
      },
      {
        id: "debt",
        header: "Deuda",
        sortable: true,
        width: "130px",
        align: "right",
        cell: (c) => {
          const v = statsFor(c.id).debt;
          return v > 0 ? (
            <span style={{ fontSize: text.sm, color: color.danger, fontWeight: weight.semibold, fontVariantNumeric: "tabular-nums" }}>
              {formatMoney(v)}
            </span>
          ) : (
            <span style={{ color: color.textDim, fontSize: text.sm }}>—</span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        width: "168px",
        align: "right",
        cell: (c) => (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }} onClick={(e) => e.stopPropagation()}>
            <RowIconBtn ariaLabel="WhatsApp" disabled={!c.phone} onClick={() => c.phone && openWhatsApp(c.phone)}>
              <WhatsAppIcon size={13} color="var(--success)" />
            </RowIconBtn>
            {c.instagram && (
              <RowIconBtn ariaLabel="Instagram" onClick={() => c.instagram && openInstagram(c.instagram)}>
                <InstagramIcon size={13} color="#E1306C" />
              </RowIconBtn>
            )}
            <RowIconBtn ariaLabel="Llamar" disabled={!c.phone} onClick={() => c.phone && openTel(c.phone)}>
              <Phone size={13} strokeWidth={2.2} color="var(--text-muted)" />
            </RowIconBtn>
            {canSell && (
              <RowIconBtn ariaLabel="Nueva venta" tone="success" onClick={onNewSale}>
                <DollarSign size={13} strokeWidth={2.4} color="var(--success)" />
              </RowIconBtn>
            )}
            <RowIconBtn ariaLabel="Ver detalle" onClick={() => setOpenId(c.id)}>
              <MoreHorizontal size={14} strokeWidth={2.2} color="var(--text-muted)" />
            </RowIconBtn>
          </div>
        ),
      },
    ],
    [statsFor, onNewSale, canSell],
  );

  const sortedRows = useMemo(
    () =>
      applySort(filtered, columns, sort, (row, columnId) => {
        const c = row as Customer;
        switch (columnId) {
          case "name":
            return c.name;
          case "type":
            return c.type;
          case "purchases":
            return statsFor(c.id).purchases;
          case "lifetime":
            return statsFor(c.id).lifetime;
          case "debt":
            return statsFor(c.id).debt;
          default:
            return "";
        }
      }),
    [filtered, columns, sort, statsFor],
  );

  const openCustomer = openId ? customers.find((c) => c.id === openId) ?? null : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5], height: "100%" }}>
      <PageHeader
        title="Clientes"
        subtitle={loading ? "Cargando…" : `${filtered.length} de ${customers.length} ${customers.length === 1 ? "cliente" : "clientes"}`}
        actions={
          canWrite ? (
            <>
              <Button
                variant="secondary"
                size="md"
                iconLeft={<Upload size={16} />}
                onClick={() => setImportOpen(true)}
              >
                Importar
              </Button>
              <Button
                variant="primary"
                size="md"
                iconLeft={<Plus size={16} />}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Nuevo cliente
              </Button>
            </>
          ) : undefined
        }
      />

      <div style={{ display: "flex", alignItems: "center", gap: space[3], flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260, maxWidth: 400 }}>
          <Input
            placeholder="Buscar por nombre, teléfono o email…"
            iconLeft={<Search size={15} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs variant="pills" size="sm" value={typeFilter} onChange={setTypeFilter} items={TYPE_FILTERS} />
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <DataTable
          rows={sortedRows}
          columns={columns}
          getRowId={(c) => c.id}
          onRowClick={(c) => setOpenId(c.id)}
          onRowContextMenu={(c, e) => {
            setCtxCustomer(c);
            ctxMenu.openAt(e);
          }}
          activeRowId={openId || undefined}
          sort={sort || undefined}
          onSortChange={setSort}
          density="normal"
          empty={
            <EmptyState
              icon={<Users size={24} />}
              title={search.trim() ? "Sin resultados" : "Aún no tenés clientes"}
              description={
                search.trim()
                  ? `No encontramos clientes que coincidan con "${search}"`
                  : "Agregá tu primer cliente para empezar a registrar ventas y seguimientos."
              }
              action={
                search.trim()
                  ? { label: "Limpiar búsqueda", onClick: () => setSearch(""), variant: "secondary" }
                  : canWrite
                    ? { label: "Crear cliente", onClick: () => { setEditing(null); setFormOpen(true); }, iconLeft: <Plus size={14} /> }
                    : undefined
              }
            />
          }
        />
      </div>

      {openCustomer && (
        <ClientDrawer
          customer={openCustomer}
          sales={sales.filter((s) => s.customerId === openCustomer.id)}
          stats={statsFor(openCustomer.id)}
          onClose={() => setOpenId(null)}
          onEdit={() => {
            setEditing(openCustomer);
            setFormOpen(true);
          }}
          onNewSale={onNewSale}
          onSchedule={() => setTurnoFor(openCustomer)}
          onRepair={() => setRepairFor(openCustomer)}
          canWrite={canWrite}
          canSell={canSell}
          canRepair={canRepair}
        />
      )}

      {quickFor && <QuickWhatsAppPicker customer={quickFor} onClose={() => setQuickFor(null)} />}

      {turnoFor && (
        <TurnoFormDialog
          customers={customers}
          presetCustomer={{ id: turnoFor.id, name: turnoFor.name, phone: turnoFor.phone }}
          onClose={() => setTurnoFor(null)}
          onSaved={() => {}}
        />
      )}

      {repairFor && (
        <RepairDialog
          customers={customers}
          presetCustomer={{ id: repairFor.id, name: repairFor.name, phone: repairFor.phone }}
          onClose={() => setRepairFor(null)}
          onSaved={() => {}}
        />
      )}

      <ClientFormModal
        open={formOpen}
        customer={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          load();
        }}
      />

      <ImportClientsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />

      {ctxMenu.open && ctxCustomer && (
        <ContextMenu position={ctxMenu.position} onClose={ctxMenu.close}>
          <ContextMenuLabel>{ctxCustomer.name}</ContextMenuLabel>
          <ContextMenuItem icon={<Users size={14} />} onClick={() => { setOpenId(ctxCustomer.id); ctxMenu.close(); }}>
            Ver detalle
          </ContextMenuItem>
          <ContextMenuDivider />
          {ctxCustomer.phone && (
            <>
              <ContextMenuItem icon={<WhatsAppIcon size={13} color="var(--success)" />} onClick={() => { if (ctxCustomer.phone) openWhatsApp(ctxCustomer.phone); ctxMenu.close(); }}>
                WhatsApp
              </ContextMenuItem>
              <ContextMenuItem icon={<Zap size={14} />} onClick={() => { setQuickFor(ctxCustomer); ctxMenu.close(); }}>
                WhatsApp rápido
              </ContextMenuItem>
              <ContextMenuItem icon={<Phone size={14} />} onClick={() => { if (ctxCustomer.phone) openTel(ctxCustomer.phone); ctxMenu.close(); }}>
                Llamar
              </ContextMenuItem>
            </>
          )}
          {ctxCustomer.email && (
            <ContextMenuItem icon={<Mail size={14} />} onClick={() => { if (ctxCustomer.email) openMail(ctxCustomer.email); ctxMenu.close(); }}>
              Email
            </ContextMenuItem>
          )}
          {ctxCustomer.instagram && (
            <ContextMenuItem icon={<InstagramIcon size={13} color="#E1306C" />} onClick={() => { if (ctxCustomer.instagram) openInstagram(ctxCustomer.instagram); ctxMenu.close(); }}>
              Instagram
            </ContextMenuItem>
          )}
          <ContextMenuItem
            icon={<Copy size={14} />}
            onClick={() => {
              navigator.clipboard.writeText([ctxCustomer.name, ctxCustomer.phone, ctxCustomer.email].filter(Boolean).join(" · ")).catch(() => {});
              showToast("Datos copiados", "success");
              ctxMenu.close();
            }}
          >
            Copiar contacto
          </ContextMenuItem>
          {canWrite && (
            <>
              <ContextMenuDivider />
              <ContextMenuItem icon={<Pencil size={14} />} onClick={() => { setEditing(ctxCustomer); setFormOpen(true); ctxMenu.close(); }}>
                Editar
              </ContextMenuItem>
              <ContextMenuItem tone="danger" icon={<Trash2 size={14} />} onClick={() => { const c = ctxCustomer; ctxMenu.close(); remove(c); }}>
                Eliminar
              </ContextMenuItem>
            </>
          )}
        </ContextMenu>
      )}
    </div>
  );
}

/* ───────── RowIconBtn ───────── */

function RowIconBtn({
  children,
  ariaLabel,
  onClick,
  disabled,
  tone = "neutral",
}: {
  children: ReactNode;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "success";
}) {
  const hoverBg = tone === "success" ? "var(--success-bg)" : "var(--surface-hover)";
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      style={{
        width: 26,
        height: 26,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 100ms",
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

/* ───────── ClientDrawer ───────── */

function ClientDrawer({
  customer,
  sales,
  stats,
  onClose,
  onEdit,
  onNewSale,
  onSchedule,
  onRepair,
  canWrite,
  canSell,
  canRepair,
}: {
  customer: Customer;
  sales: Sale[];
  stats: CustomerStats;
  onClose: () => void;
  onEdit: () => void;
  onNewSale: () => void;
  onSchedule: () => void;
  onRepair: () => void;
  canWrite: boolean;
  canSell: boolean;
  canRepair: boolean;
}) {
  const [tab, setTab] = useState<"info" | "ventas">("info");

  return (
    <Drawer
      open
      onClose={onClose}
      header={
        <div style={{ padding: space[5], borderBottom: `1px solid ${color.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: space[3], marginBottom: space[3] }}>
            <Avatar name={customer.name} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: text.lg, fontWeight: weight.bold, color: color.text, letterSpacing: "-0.3px" }}>
                {customer.name}
              </h2>
              <div style={{ marginTop: 4 }}>
                <Badge tone={typeBadgeTone(customer.type)} size="sm">
                  {CLIENT_TYPE_LABELS[customer.type]}
                </Badge>
              </div>
            </div>
            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
              {canWrite && (
                <button onClick={onEdit} title="Editar" aria-label="Editar" className="btn-icon muted" style={{ width: 28, height: 28, borderRadius: radius.sm, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Pencil size={15} strokeWidth={2.2} />
                </button>
              )}
              <button onClick={onClose} title="Cerrar" aria-label="Cerrar" className="btn-icon muted" style={{ width: 28, height: 28, borderRadius: radius.sm, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 300 }}>×</span>
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: space[2] }}>
            <ContactButton onClick={() => customer.phone && openTel(customer.phone)} icon={<Phone size={14} />}>
              {customer.phone || "Sin tel."}
            </ContactButton>
            {customer.email && (
              <ContactButton onClick={() => openMail(customer.email!)} icon={<Mail size={14} />} minimal>
                {customer.email}
              </ContactButton>
            )}
          </div>
        </div>
      }
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
          <div style={{ display: "flex", gap: space[2] }}>
            <Button variant="secondary" size="md" iconLeft={<WhatsAppIcon size={15} color="var(--success)" />} onClick={() => customer.phone && openWhatsApp(customer.phone)} fullWidth>
              WhatsApp
            </Button>
            {customer.instagram && (
              <Button variant="secondary" size="md" iconLeft={<InstagramIcon size={15} color="#E1306C" />} onClick={() => customer.instagram && openInstagram(customer.instagram)} aria-label="Instagram" />
            )}
          </div>
          {(canSell || canRepair) && (
            <div style={{ display: "flex", gap: space[2] }}>
              {canSell && (
                <Button variant="secondary" size="md" iconLeft={<CalendarClock size={15} />} onClick={onSchedule} fullWidth>
                  Turno
                </Button>
              )}
              {canRepair && (
                <Button variant="secondary" size="md" iconLeft={<Wrench size={15} />} onClick={onRepair} fullWidth>
                  Reparación
                </Button>
              )}
              {canSell && (
                <Button variant="primary" size="md" iconLeft={<Plus size={15} />} onClick={onNewSale} fullWidth>
                  Venta
                </Button>
              )}
            </div>
          )}
        </div>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: `1px solid ${color.border}` }}>
        <Stat label="Compras" value={String(stats.purchases)} />
        <Stat label="Histórico" value={formatMoney(stats.lifetime)} compact />
        <Stat label="Deuda" value={formatMoney(stats.debt)} compact tone={stats.debt > 0 ? "danger" : "neutral"} />
      </div>

      <div style={{ padding: `${space[3]} ${space[5]} 0` }}>
        <Tabs
          variant="underline"
          size="sm"
          value={tab}
          onChange={(v) => setTab(v as "info" | "ventas")}
          items={[
            { value: "info", label: "Info" },
            { value: "ventas", label: "Ventas", count: sales.length },
          ]}
        />
      </div>

      <div style={{ padding: space[5] }}>
        {tab === "info" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: space[5] }}>
            <InfoSection title="Datos de contacto">
              <InfoRow label="Teléfono" value={customer.phone || "—"} />
              <InfoRow label="Email" value={customer.email || "—"} />
              {customer.instagram && <InfoRow label="Instagram" value={`@${instagramHandle(customer.instagram)}`} />}
              <InfoRow label="Tipo" value={CLIENT_TYPE_LABELS[customer.type]} />
              {customer.createdAt && <InfoRow label="Cliente desde" value={formatDateLong(customer.createdAt)} />}
            </InfoSection>
            <InfoSection title="Notas">
              {customer.notes ? (
                <p style={{ margin: 0, fontSize: text.sm, color: color.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{customer.notes}</p>
              ) : (
                <span style={{ fontSize: text.sm, color: color.textDim, fontStyle: "italic" }}>Sin notas.</span>
              )}
            </InfoSection>
            <AiSummary customer={customer} sales={sales} stats={stats} />
            <AiSuggestions customer={customer} />
          </div>
        ) : sales.length === 0 ? (
          <EmptyState size="compact" title="Sin ventas registradas" description="Cuando le vendás algo, va a aparecer acá." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            {sales.map((s) => (
              <div key={s.id} style={{ padding: space[4], background: color.surface2, border: `1px solid ${color.border}`, borderRadius: radius.md, display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>
                    {s.saleDate || s.createdAt ? new Date((s.saleDate ?? s.createdAt)!).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "Venta"}
                  </div>
                  <div style={{ marginTop: 2 }}>
                    {s.isPaid ? (
                      <Badge tone="success" size="sm" dot>Pagada</Badge>
                    ) : (
                      <Badge tone="warning" size="sm" dot>Debe {formatMoney(s.balance)}</Badge>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: text.sm, fontWeight: weight.bold, color: color.text }}>{formatMoney(s.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}

function ContactButton({ children, onClick, icon, minimal }: { children: ReactNode; onClick?: () => void; icon: ReactNode; minimal?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="btn-bordered"
      style={{
        flex: minimal ? "none" : 1,
        height: 32,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: `0 ${space[3]}`,
        background: color.surface2,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        color: color.text,
        fontSize: text.sm,
        fontWeight: weight.medium,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        minWidth: 0,
      }}
    >
      <span style={{ color: color.textMuted, display: "inline-flex", flexShrink: 0 }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{children}</span>
    </button>
  );
}

function Stat({ label, value, tone = "neutral", compact }: { label: string; value: string; tone?: "neutral" | "danger"; compact?: boolean }) {
  const toneColor = tone === "danger" ? color.danger : color.text;
  return (
    <div style={{ padding: `${space[3]} ${space[4]}`, borderRight: `1px solid ${color.border}`, display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: text.xs, color: color.textMuted, fontWeight: weight.medium, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
      <span style={{ fontSize: compact ? text.md : text.lg, fontWeight: weight.bold, color: toneColor, letterSpacing: "-0.3px", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </span>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 style={{ margin: 0, marginBottom: space[3], fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.8px" }}>{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: space[3], padding: `${space[2]} 0`, borderBottom: `1px solid ${color.border}` }}>
      <span style={{ fontSize: text.sm, color: color.textMuted }}>{label}</span>
      <span style={{ fontSize: text.sm, color: color.text, fontWeight: weight.medium, textAlign: "right", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

/* ───────── ClientFormModal ───────── */

function ClientFormModal({
  open,
  customer,
  onClose,
  onSaved,
}: {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useUIStore();
  const editing = !!customer;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [type, setType] = useState<ClientType>("final");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setEmail(customer?.email ?? "");
    setInstagram(customer?.instagram ?? "");
    setType(customer?.type ?? "final");
    setNotes(customer?.notes ?? "");
  }, [open, customer]);

  const canSubmit = name.trim().length >= 2;
  const isDirty = () => name.trim().length > 0 || phone.trim().length > 0 || email.trim().length > 0 || instagram.trim().length > 0 || notes.trim().length > 0 || type !== "final";

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      instagram: instagram.trim() || undefined,
      type,
      notes: notes.trim() || undefined,
    };
    try {
      if (editing && customer) {
        await api.updateCustomer(customer.id, payload);
        showToast("Cliente actualizado", "success");
      } else {
        await api.createCustomer(payload);
        showToast("Cliente creado", "success");
      }
      onSaved();
    } catch {
      showToast("No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      isDirty={isDirty}
      confirmCloseText="¿Cerrar y descartar los cambios?"
      title={editing ? "Editar cliente" : "Nuevo cliente"}
      maxWidth={520}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="md" onClick={submit} disabled={!canSubmit} loading={saving}>
            {editing ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </>
      }
    >
      <ModalField label="Nombre" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Carlos Pérez" autoFocus />
      </ModalField>
      <ModalField label="Teléfono">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 9 11 ..." />
      </ModalField>
      <ModalField label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
      </ModalField>
      <ModalField label="Instagram">
        <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario" />
      </ModalField>
      <ModalField label="Tipo" required>
        <Select value={type} onChange={(e) => setType(e.target.value as ClientType)}>
          {CLIENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CLIENT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </ModalField>
      <ModalField label="Notas">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observaciones, preferencias, lo que necesites recordar…"
          rows={4}
          style={{ width: "100%", padding: "10px 12px", background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: 8, color: "var(--text)", fontSize: 13, fontFamily: "inherit", lineHeight: 1.5, outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 90 }}
        />
      </ModalField>
    </Modal>
  );
}
