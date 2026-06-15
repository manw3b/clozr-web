import { useCallback, useEffect, useMemo, useState } from "react";
import { DollarSign, ShoppingCart, TrendingDown, HandCoins, Award, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, MetricCard } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { useUIStore } from "@/store/uiStore";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney } from "@/lib/format";
import * as api from "@/lib/api";
import type { Sale } from "@/lib/types";

/**
 * Vista Reportes — port web (v1) de clozr/src/pages/reportes/Reportes.tsx.
 * Calcula client-side desde las ventas (api.listSales): facturado/cobrado/
 * por-cobrar/ticket, tendencia mensual, top clientes y por vendedor — todo
 * en ARS. PENDIENTE (necesita ítems de venta + costos del catálogo): margen,
 * top productos y por categoría. Esos llegan cuando portemos Inventario/ítems.
 */
export function Reportes() {
  const { showToast } = useUIStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listSales()
      .then(setSales)
      .catch(() => showToast("No se pudieron cargar los reportes", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = useMemo(() => {
    const facturado = sales.reduce((s, v) => s + v.total, 0);
    const cobrado = sales.reduce((s, v) => s + v.totalPaid, 0);
    const porCobrar = sales.reduce((s, v) => s + (v.balance > 0 ? v.balance : 0), 0);
    const ticket = sales.length > 0 ? facturado / sales.length : 0;
    return { facturado, cobrado, porCobrar, ticket, count: sales.length };
  }, [sales]);

  const monthly = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: d.toLocaleDateString("es-AR", { month: "short" }), revenue: 0 };
    });
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const s of sales) {
      const dt = s.createdAt ?? s.saleDate;
      if (!dt) continue;
      const d = new Date(dt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const b = byKey.get(key);
      if (b) b.revenue += s.total;
    }
    return buckets;
  }, [sales]);
  const maxMonthly = Math.max(1, ...monthly.map((m) => m.revenue));

  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const s of sales) {
      const id = s.customerId ?? "no-client";
      const name = s.customerName ?? "Sin cliente";
      const c = map.get(id) ?? { name, total: 0, count: 0 };
      c.total += s.total;
      c.count += 1;
      map.set(id, c);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [sales]);

  const bySeller = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const s of sales) {
      const name = s.sellerName?.trim() || "Sin asignar";
      const c = map.get(name) ?? { name, total: 0, count: 0 };
      c.total += s.total;
      c.count += 1;
      map.set(name, c);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [sales]);

  const hasData = !loading && sales.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[6] }}>
      <PageHeader
        title="Reportes"
        subtitle={loading ? "Cargando…" : `${kpis.count} venta${kpis.count === 1 ? "" : "s"} · montos en ARS`}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: space[3] }}>
        <MetricCard label="Facturado" value={formatMoney(kpis.facturado)} icon={<DollarSign size={16} />} />
        <MetricCard label="Cobrado" value={formatMoney(kpis.cobrado)} tone="success" icon={<HandCoins size={16} />} />
        <MetricCard
          label="Por cobrar"
          value={formatMoney(kpis.porCobrar)}
          tone={kpis.porCobrar > 0 ? "warning" : "neutral"}
          icon={<TrendingDown size={16} />}
        />
        <MetricCard label="Ticket promedio" value={formatMoney(kpis.ticket)} icon={<ShoppingCart size={16} />} />
      </div>

      {/* Tendencia 6 meses (facturado) */}
      <Card padding={5}>
        <h2 style={sectionTitle}>Tendencia últimos 6 meses</h2>
        {!hasData ? (
          <EmptyState size="compact" title="Sin datos suficientes" description="Registrá ventas para ver el gráfico." />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${monthly.length}, 1fr)`,
              gap: space[3],
              alignItems: "end",
              height: 200,
              marginTop: space[4],
            }}
          >
            {monthly.map((b, idx) => {
              const isLast = idx === monthly.length - 1;
              const pct = (b.revenue / maxMonthly) * 100;
              return (
                <div
                  key={b.key}
                  title={`${b.label} — ${formatMoney(b.revenue)}`}
                  style={{ display: "flex", flexDirection: "column", height: "100%", gap: space[2] }}
                >
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div
                      style={{
                        height: `${pct}%`,
                        minHeight: 4,
                        background: isLast ? color.primary : color.surface2,
                        border: `1px solid ${isLast ? color.primary : color.border}`,
                        borderRadius: 4,
                        transition: "height 400ms",
                      }}
                    />
                  </div>
                  <div style={{ textAlign: "center", fontSize: text.xs, color: color.textMuted, textTransform: "capitalize" }}>
                    {b.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Top clientes + Por vendedor */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[4] }}>
        <Card padding={5}>
          <h2 style={sectionTitle}>
            <Award size={16} color={color.primary} /> Top clientes
          </h2>
          {!hasData || topCustomers.length === 0 ? (
            <EmptyState size="compact" title="Sin ventas todavía" description="Agregá una venta para ver el ranking." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: space[2], marginTop: space[3] }}>
              {topCustomers.map((c, i) => (
                <div
                  key={c.name + i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: space[3],
                    padding: `${space[2]} ${space[3]}`,
                    borderRadius: radius.md,
                    background: i === 0 ? color.primaryBg : "transparent",
                  }}
                >
                  <span style={{ fontSize: text.xs, fontWeight: weight.semibold, color: i === 0 ? color.primary : color.textMuted, width: 18 }}>
                    #{i + 1}
                  </span>
                  <Avatar name={c.name} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: text.sm, fontWeight: weight.medium, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: text.xs, color: color.textMuted }}>
                      {c.count} compra{c.count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div style={{ fontSize: text.sm, fontWeight: weight.bold, color: color.text }}>
                    {formatMoney(c.total)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding={5}>
          <h2 style={sectionTitle}>
            <Users size={16} color={color.primary} /> Por vendedor
          </h2>
          {!hasData || bySeller.length === 0 ? (
            <EmptyState size="compact" title="Sin datos" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: space[2], marginTop: space[3] }}>
              {bySeller.map((v) => (
                <div key={v.name} style={{ display: "flex", alignItems: "center", gap: space[3], padding: `${space[2]} ${space[3]}` }}>
                  <Avatar name={v.name} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: text.sm, fontWeight: weight.medium, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.name}
                    </div>
                    <div style={{ fontSize: text.xs, color: color.textMuted }}>{v.count} ventas</div>
                  </div>
                  <div style={{ fontSize: text.sm, fontWeight: weight.bold, color: color.text }}>
                    {formatMoney(v.total)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {kpis.porCobrar > 0 && (
        <div style={{ fontSize: text.xs, color: color.textMuted, display: "inline-flex", alignItems: "center", gap: space[2] }}>
          <TrendingDown size={12} />
          Saldo pendiente total: {formatMoney(kpis.porCobrar)} · ver Deudas para el detalle.
        </div>
      )}
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--text-lg)",
  fontWeight: 700,
  color: "var(--text)",
  letterSpacing: "-0.2px",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
};
