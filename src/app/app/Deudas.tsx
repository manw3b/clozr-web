import { useCallback, useEffect, useMemo, useState } from "react";
import { Phone, Check, Eye } from "lucide-react";
import { confirmAsync } from "@/lib/confirmAsync";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { openWhatsApp, openTel } from "@/lib/openExternal";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuDivider,
  ContextMenuLabel,
  useContextMenu,
} from "@/components/ContextMenu";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/Card";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { useUIStore } from "@/store/uiStore";
import { usePermissions } from "@/store/usePermissions";
import { color, space, text, weight } from "@/tokens";
import { formatMoney } from "@/lib/format";
import { useBlueRate } from "@/store/dollarStore";
import * as api from "@/lib/api";
import { useCustomersChanged } from "@/lib/customerEvents";
import type { Customer, Sale } from "@/lib/types";

/**
 * Vista Deudas — port web de clozr/src/pages/deudas/Deudas.tsx.
 * Se DERIVA de las ventas impagas (sin endpoint nuevo): agrupa por cliente,
 * suma el saldo pendiente y los días de atraso. "Cobrar" registra el pago
 * del saldo restante (reusa api.addPayment).
 */
interface DeudaRow {
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  pendingSales: number;
  /** Saldo total adeudado en US$ (congelado por venta; las legacy se convierten al blue actual). */
  totalDue: number;
  oldestDueDate: string;
  maxDaysOverdue: number;
  sales: Sale[];
}

export function Deudas() {
  const { showToast } = useUIStore();
  const blue = useBlueRate();
  const { can } = usePermissions();
  const canWrite = can("sales.write");
  const ctxMenu = useContextMenu();
  const [ctxRow, setCtxRow] = useState<DeudaRow | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  useCustomersChanged(() => { api.listCustomers().then(setCustomers).catch(() => {}); });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.listSales(), api.listCustomers()])
      .then(([sl, cs]) => {
        setSales(sl);
        setCustomers(cs);
      })
      .catch(() => showToast("No se pudieron cargar las deudas", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingSales = useMemo(
    () =>
      sales.filter((s) => {
        if (s.isPaid) return false;
        // US$ es la moneda madre: si la venta tiene saldo en US$, ese manda.
        if (s.balanceUsd != null) return s.balanceUsd > 0.01;
        return s.balance > 0;
      }),
    [sales],
  );

  const rows: DeudaRow[] = useMemo(() => {
    const phoneById = new Map(customers.map((c) => [c.id, c.phone ?? null]));
    const grouped = new Map<string, DeudaRow>();
    const now = Date.now();

    for (const s of pendingSales) {
      const cid = s.customerId ?? "no-client";
      const cname = s.customerName ?? "Sin cliente";
      const date = s.createdAt ?? s.saleDate ?? "";
      const days = date
        ? Math.max(0, Math.floor((now - new Date(date).getTime()) / 86_400_000) - 30)
        : 0;
      let row = grouped.get(cid);
      if (!row) {
        row = {
          customerId: cid,
          customerName: cname,
          customerPhone: cid !== "no-client" ? phoneById.get(cid) ?? null : null,
          pendingSales: 0,
          totalDue: 0,
          oldestDueDate: date,
          maxDaysOverdue: 0,
          sales: [],
        };
        grouped.set(cid, row);
      }
      row.pendingSales += 1;
      // Saldo congelado en US$ (no se licúa con el blue); legacy sin US$ → convertir al blue actual.
      row.totalDue += s.balanceUsd != null ? s.balanceUsd : blue && blue > 0 ? s.balance / blue : 0;
      row.sales.push(s);
      if (date && (!row.oldestDueDate || date < row.oldestDueDate)) row.oldestDueDate = date;
      if (days > row.maxDaysOverdue) row.maxDaysOverdue = days;
    }

    return Array.from(grouped.values()).sort((a, b) => b.totalDue - a.totalDue);
  }, [pendingSales, customers, blue]);

  const totals = useMemo(() => {
    const totalDue = rows.reduce((s, r) => s + r.totalDue, 0);
    const overdueCount = rows.filter((r) => r.maxDaysOverdue > 0).length;
    return { totalDue, overdueCount, customerCount: rows.length };
  }, [rows]);

  function hasPhone(phone: string | null): boolean {
    return !!phone && phone.replace(/\D/g, "").length > 0;
  }

  async function cobrar(r: DeudaRow) {
    const ok = await confirmAsync({
      title: "Marcar como pagadas",
      message: `¿Marcar como pagadas las ${r.pendingSales} venta(s) pendiente(s) de ${r.customerName}?`,
      confirmText: "Marcar pagadas",
    });
    if (!ok) return;
    try {
      for (const s of r.sales) {
        // Cobramos el saldo congelado en US$; legacy sin US$ → cae a pesos.
        if (s.balanceUsd != null && s.balanceUsd > 0.01) {
          await api.addPayment(s.id, { method: "efectivo", amount: s.balanceUsd, currency: "USD" });
        } else {
          await api.addPayment(s.id, { method: "efectivo", amount: s.balance, currency: "ARS" });
        }
      }
      showToast("Cobrado", "success");
      load();
    } catch {
      showToast("No se pudo registrar el cobro", "error");
      load();
    }
  }

  const columns: ColumnDef<DeudaRow>[] = [
    {
      id: "customer",
      header: "Cliente",
      sortable: true,
      width: "minmax(220px, 1.4fr)",
      cell: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
          <Avatar name={r.customerName} size={32} />
          <div>
            <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>
              {r.customerName}
            </div>
            {r.customerPhone && (
              <div style={{ fontSize: text.xs, color: color.textMuted }}>{r.customerPhone}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "pendingSales",
      header: "Ventas",
      sortable: true,
      width: "100px",
      align: "center",
      cell: (r) => <span style={{ fontSize: text.sm, color: color.text }}>{r.pendingSales}</span>,
    },
    {
      id: "totalDue",
      header: "Saldo",
      sortable: true,
      width: "140px",
      align: "right",
      cell: (r) => (
        <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.danger }}>
            {formatMoney(Math.round(r.totalDue), "USD")}
          </span>
          {blue && blue > 0 && (
            <span style={{ fontSize: 11, color: color.textDim }}>
              ≈ {formatMoney(Math.round(r.totalDue * blue), "ARS")}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "maxDaysOverdue",
      header: "Atraso",
      sortable: true,
      width: "120px",
      cell: (r) =>
        r.maxDaysOverdue === 0 ? (
          <Badge tone="neutral">A tiempo</Badge>
        ) : r.maxDaysOverdue > 30 ? (
          <Badge tone="danger">+{r.maxDaysOverdue}d</Badge>
        ) : (
          <Badge tone="warning">+{r.maxDaysOverdue}d</Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      width: "240px",
      cell: (r) => (
        <div style={{ display: "flex", gap: space[2], justifyContent: "flex-end" }}>
          {hasPhone(r.customerPhone) && (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<WhatsAppIcon size={13} color="var(--success)" />}
              onClick={(e) => {
                e.stopPropagation();
                if (r.customerPhone) openWhatsApp(r.customerPhone);
              }}
            >
              WhatsApp
            </Button>
          )}
          {r.customerPhone && (
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Phone size={13} />}
              onClick={(e) => {
                e.stopPropagation();
                if (r.customerPhone) openTel(r.customerPhone);
              }}
            />
          )}
          {canWrite && (
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Check size={13} />}
              onClick={(e) => {
                e.stopPropagation();
                cobrar(r);
              }}
            >
              Cobrar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5], height: "100%" }}>
      <PageHeader
        title="Deudas"
        subtitle={
          loading
            ? "Cargando…"
            : `${totals.customerCount} cliente${totals.customerCount === 1 ? "" : "s"} con saldo pendiente`
        }
      />

      <div className="cz-metric-grid" style={{ ["--cz-cols"]: 3 } as React.CSSProperties}>
        <Card padding={5}>
          <div style={{ fontSize: text.sm, color: color.textMuted, marginBottom: space[2] }}>
            Saldo total
          </div>
          <div style={{ fontSize: text["2xl"], fontWeight: weight.bold, color: color.danger, letterSpacing: "-0.5px" }}>
            {formatMoney(Math.round(totals.totalDue), "USD")}
          </div>
          {blue && blue > 0 && (
            <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 2 }}>
              ≈ {formatMoney(Math.round(totals.totalDue * blue), "ARS")}
            </div>
          )}
        </Card>
        <Card padding={5}>
          <div style={{ fontSize: text.sm, color: color.textMuted, marginBottom: space[2] }}>
            Vencidas
          </div>
          <div style={{ fontSize: text["2xl"], fontWeight: weight.bold, color: color.warning, letterSpacing: "-0.5px" }}>
            {totals.overdueCount}
          </div>
        </Card>
        <Card padding={5}>
          <div style={{ fontSize: text.sm, color: color.textMuted, marginBottom: space[2] }}>
            Clientes con saldo
          </div>
          <div style={{ fontSize: text["2xl"], fontWeight: weight.bold, color: color.text, letterSpacing: "-0.5px" }}>
            {totals.customerCount}
          </div>
        </Card>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <DataTable<DeudaRow>
          rows={rows}
          columns={columns}
          getRowId={(r) => r.customerId}
          onRowContextMenu={(r, e) => {
            setCtxRow(r);
            ctxMenu.openAt(e);
          }}
          density="normal"
          empty={
            <EmptyState
              title="Sin deudas"
              description="Todos tus clientes están al día. Buen trabajo 🎉"
            />
          }
        />
      </div>

      {ctxMenu.open && ctxRow && (
        <ContextMenu position={ctxMenu.position} onClose={ctxMenu.close}>
          <ContextMenuLabel>{ctxRow.customerName}</ContextMenuLabel>
          {ctxRow.customerPhone && (
            <>
              <ContextMenuItem
                icon={<WhatsAppIcon size={13} color="var(--success)" />}
                onClick={() => {
                  if (ctxRow.customerPhone) openWhatsApp(ctxRow.customerPhone);
                  ctxMenu.close();
                }}
              >
                WhatsApp
              </ContextMenuItem>
              <ContextMenuItem
                icon={<Phone size={14} />}
                onClick={() => {
                  if (ctxRow.customerPhone) openTel(ctxRow.customerPhone);
                  ctxMenu.close();
                }}
              >
                Llamar
              </ContextMenuItem>
              <ContextMenuDivider />
            </>
          )}
          {canWrite && (
            <ContextMenuItem
              icon={<Check size={14} />}
              onClick={() => {
                const r = ctxRow;
                ctxMenu.close();
                cobrar(r);
              }}
            >
              Marcar pagadas
            </ContextMenuItem>
          )}
        </ContextMenu>
      )}
    </div>
  );
}
