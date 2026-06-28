import { useCallback, useEffect, useMemo, useState } from "react";
import { DollarSign, ShoppingCart, TrendingDown, HandCoins, Award, Users, Package, Percent, AlertCircle, MapPin, Wrench } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, MetricCard } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { useUIStore } from "@/store/uiStore";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney, dualUsd } from "@/lib/format";
import { useBlueRate } from "@/store/dollarStore";
import { useIsMobile } from "@/lib/useIsMobile";
import * as api from "@/lib/api";
import type { Sale, SaleItemReport, Product, Repair } from "@/lib/types";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Vista Reportes — calcula client-side desde las ventas (api.listSales).
 * US$-nativo (Fase 4): todas las métricas usan el monto en US$ congelado de
 * cada venta (no se licúa con el blue); las ventas legacy sin US$ caen al ARS
 * convertido al blue de hoy. El margen / top productos cruzan los ítems con el
 * costo del catálogo y pasan cada línea a US$ por su moneda + el blue congelado
 * de la venta. El peso (× blue) queda siempre como referencia "≈".
 */
export function Reportes() {
  const { showToast } = useUIStore();
  const blue = useBlueRate();
  const isMobile = useIsMobile();
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItemReport[]>([]);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.listSales(),
      // best-effort: si el endpoint bulk no está (Worker viejo), igual mostramos
      // los reportes de ventas; margen/productos quedan vacíos.
      api.listSaleItems().catch(() => [] as SaleItemReport[]),
      api.listCatalog().catch(() => [] as Product[]),
      api.listRepairs().catch(() => [] as Repair[]),
    ])
      .then(([sl, it, ct, rp]) => {
        setSales(sl);
        setItems(it);
        setCatalog(ct);
        setRepairs(rp);
      })
      .catch(() => showToast("No se pudieron cargar los reportes", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // US$ es la fuente de verdad. Para las ventas ya migradas usamos el monto en
  // US$ congelado; las legacy (sin US$) caen al ARS convertido al blue de hoy —
  // igual que la versión vieja, así nunca mostramos algo peor que antes.
  const saleUsd = useCallback(
    (usd: number | null | undefined, ars: number) => (usd != null ? usd : blue && blue > 0 ? ars / blue : 0),
    [blue],
  );
  // Pasa un monto de una línea de venta a US$: US$ tal cual; ARS ÷ blue
  // congelado de la venta (o ÷ blue de hoy si la venta es legacy sin fx_rate).
  const itemUsd = useCallback(
    (amount: number, it: SaleItemReport) => {
      if (it.currency === "USD") return amount;
      const r = it.fxRate && it.fxRate > 0 ? it.fxRate : blue && blue > 0 ? blue : 0;
      return r > 0 ? amount / r : 0;
    },
    [blue],
  );

  const kpis = useMemo(() => {
    const facturado = sales.reduce((s, v) => s + saleUsd(v.totalUsd, v.total), 0);
    const cobrado = sales.reduce((s, v) => s + saleUsd(v.totalPaidUsd, v.totalPaid), 0);
    const porCobrar = sales.reduce((s, v) => {
      const bal = saleUsd(v.balanceUsd, v.balance);
      return s + (bal > 0 ? bal : 0);
    }, 0);
    const ticket = sales.length > 0 ? facturado / sales.length : 0;
    return { facturado, cobrado, porCobrar, ticket, count: sales.length };
  }, [sales, saleUsd]);

  // Ventas vs Service: facturación de reparaciones entregadas vs ventas de
  // productos. Sin doble conteo: cobrar una reparación crea una venta (saleId),
  // así que esas ventas se excluyen del lado "productos".
  const serviceSplit = useMemo(() => {
    // Las reparaciones no llevan US$ congelado → convertimos al blue de hoy
    // (referencia). Las ventas de productos usan su US$ congelado.
    const serviceArs = repairs
      .filter((r) => r.status === "delivered")
      .reduce((acc, r) => acc + (r.partsCost ?? 0) + (r.laborCost ?? 0), 0);
    const service = blue && blue > 0 ? serviceArs / blue : 0;
    const repairSaleIds = new Set(repairs.map((r) => r.saleId).filter(Boolean) as string[]);
    const productSales = sales
      .filter((s) => !repairSaleIds.has(s.id))
      .reduce((acc, v) => acc + saleUsd(v.totalUsd, v.total), 0);
    const total = service + productSales;
    return { service, productSales, total, servicePct: total > 0 ? (service / total) * 100 : 0 };
  }, [repairs, sales, blue, saleUsd]);

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
      if (b) b.revenue += saleUsd(s.totalUsd, s.total);
    }
    return buckets;
  }, [sales, saleUsd]);
  const maxMonthly = Math.max(1, ...monthly.map((m) => m.revenue));

  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const s of sales) {
      const id = s.customerId ?? "no-client";
      const name = s.customerName ?? "Sin cliente";
      const c = map.get(id) ?? { name, total: 0, count: 0 };
      c.total += saleUsd(s.totalUsd, s.total);
      c.count += 1;
      map.set(id, c);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [sales, saleUsd]);

  const bySeller = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const s of sales) {
      const name = s.sellerName?.trim() || "Sin asignar";
      const c = map.get(name) ?? { name, total: 0, count: 0 };
      c.total += saleUsd(s.totalUsd, s.total);
      c.count += 1;
      map.set(name, c);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [sales, saleUsd]);

  // Fase ④: facturación por origen ("viene de"). Solo ventas con origen
  // registrado (las legacy sin origen no ensucian el ranking).
  const byOrigin = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const s of sales) {
      const origin = s.origin?.trim();
      if (!origin) continue;
      const c = map.get(origin) ?? { name: origin, total: 0, count: 0 };
      c.total += saleUsd(s.totalUsd, s.total);
      c.count += 1;
      map.set(origin, c);
    }
    const rows = [...map.values()].sort((a, b) => b.total - a.total);
    const total = rows.reduce((s, x) => s + x.total, 0);
    return { rows, total };
  }, [sales, saleUsd]);

  /* ── v2: margen + productos (cruzando ítems con el costo del catálogo) ── */
  const catalogById = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const costById = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of catalog) if (p.cost != null && p.cost > 0) m.set(p.id, p.cost);
    return m;
  }, [catalog]);

  // Costo unitario de un ítem: preferimos el snapshot congelado en la venta;
  // si no hay (venta vieja, unitCost null/0), caemos al costo ACTUAL del
  // catálogo. Así el margen histórico no se reescribe al editar un costo.
  const unitCostOf = useCallback(
    (it: SaleItemReport): number | undefined => {
      if (it.unitCost != null && it.unitCost > 0) return it.unitCost;
      return it.catalogItemId ? costById.get(it.catalogItemId) : undefined;
    },
    [costById],
  );

  // Margen del mes vs mes anterior. El margen se calcula SOLO sobre ítems que
  // tienen costo asignado (linkeados al catálogo); la facturación sin costo se
  // reporta aparte para que el % no quede inflado.
  const margin = useMemo(() => {
    const now = new Date();
    const thisK = monthKey(now);
    const lastK = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    let revThis = 0, costedRevThis = 0, costThis = 0, uncostedThis = 0;
    let costedRevLast = 0, costLast = 0;
    for (const it of items) {
      if (!it.saleDate) continue;
      const k = monthKey(new Date(it.saleDate));
      if (k !== thisK && k !== lastK) continue;
      const rev = itemUsd(it.subtotal || it.unitPrice * it.quantity, it);
      const unitCost = unitCostOf(it);
      const hasCost = unitCost != null;
      const cost = hasCost ? itemUsd(unitCost * it.quantity, it) : 0;
      if (k === thisK) {
        revThis += rev;
        if (hasCost) { costedRevThis += rev; costThis += cost; } else { uncostedThis += rev; }
      } else {
        if (hasCost) { costedRevLast += rev; costLast += cost; }
      }
    }
    const marThis = costedRevThis - costThis;
    const marLast = costedRevLast - costLast;
    const pctThis = costedRevThis > 0 ? (marThis / costedRevThis) * 100 : 0;
    // Qué parte del facturado del mes tiene costo cargado: el margen % es SOLO
    // sobre esto, así que lo exponemos para que el número no engañe cuando hay
    // ítems sin costo (el resto se reporta en el aviso de abajo).
    const coveragePct = revThis > 0 ? (costedRevThis / revThis) * 100 : 0;
    return { revThis, marThis, pctThis, uncostedThis, marLast, hasCosted: costedRevThis > 0, coveragePct };
  }, [items, unitCostOf, itemUsd]);

  // Productos más vendidos (histórico). Agrupa por producto del catálogo, o por
  // descripción si el ítem es de texto libre.
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; units: number; revenue: number; cost: number; costed: boolean }>();
    for (const it of items) {
      const key = it.catalogItemId ?? `desc:${it.description.trim().toLowerCase()}`;
      const prod = it.catalogItemId ? catalogById.get(it.catalogItemId) : undefined;
      const name = prod?.name || it.description.trim() || "(sin nombre)";
      const e = map.get(key) ?? { name, units: 0, revenue: 0, cost: 0, costed: false };
      e.name = name;
      e.units += it.quantity;
      e.revenue += itemUsd(it.subtotal || it.unitPrice * it.quantity, it);
      const unitCost = unitCostOf(it);
      if (unitCost != null) { e.cost += itemUsd(unitCost * it.quantity, it); e.costed = true; }
      map.set(key, e);
    }
    return [...map.values()]
      .map((e) => ({
        ...e,
        margin: e.costed ? e.revenue - e.cost : null,
        marginPct: e.costed && e.revenue > 0 ? ((e.revenue - e.cost) / e.revenue) * 100 : null,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [items, unitCostOf, catalogById, itemUsd]);

  const hasData = !loading && sales.length > 0;
  const hasItems = !loading && items.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[6] }}>
      <PageHeader
        title="Reportes"
        subtitle={loading ? "Cargando…" : `${kpis.count} venta${kpis.count === 1 ? "" : "s"} · en US$ (≈ pesos al blue)`}
      />

      <div className="cz-metric-grid">
        <MetricCard label="Facturado" value={dualUsd(kpis.facturado, blue).main} sub={dualUsd(kpis.facturado, blue).sub} icon={<DollarSign size={16} />} />
        <MetricCard label="Cobrado" value={dualUsd(kpis.cobrado, blue).main} sub={dualUsd(kpis.cobrado, blue).sub} tone="success" icon={<HandCoins size={16} />} />
        <MetricCard
          label="Por cobrar"
          value={dualUsd(kpis.porCobrar, blue).main}
          sub={dualUsd(kpis.porCobrar, blue).sub}
          tone={kpis.porCobrar > 0 ? "warning" : "neutral"}
          icon={<TrendingDown size={16} />}
        />
        <MetricCard label="Ticket promedio" value={dualUsd(kpis.ticket, blue).main} sub={dualUsd(kpis.ticket, blue).sub} icon={<ShoppingCart size={16} />} />
      </div>

      {/* Ventas vs Service (taller) */}
      <div>
        <h2 style={{ ...sectionTitle, marginBottom: space[3] }}>
          <Wrench size={16} color={color.primary} /> Ventas vs Service
        </h2>
        <div className="cz-metric-grid" style={{ ["--cz-cols"]: 2 } as React.CSSProperties}>
          <MetricCard label="Ventas de productos" value={dualUsd(serviceSplit.productSales, blue).main} sub={dualUsd(serviceSplit.productSales, blue).sub} icon={<ShoppingCart size={16} />} />
          <MetricCard label="Service (taller)" value={dualUsd(serviceSplit.service, blue).main} sub={dualUsd(serviceSplit.service, blue).sub} tone="success" icon={<Wrench size={16} />} />
        </div>
        {serviceSplit.total > 0 && (
          <div style={{ marginTop: space[3] }}>
            <div style={{ display: "flex", height: 10, borderRadius: radius.full, overflow: "hidden", background: color.surface2 }}>
              <div style={{ width: `${100 - serviceSplit.servicePct}%`, background: color.primary }} title="Productos" />
              <div style={{ width: `${serviceSplit.servicePct}%`, background: color.success }} title="Service" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: space[1], fontSize: text.xs, color: color.textDim }}>
              <span>Productos {(100 - serviceSplit.servicePct).toFixed(0)}%</span>
              <span>Service {serviceSplit.servicePct.toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* v2 — Margen del mes */}
      <div>
        <h2 style={{ ...sectionTitle, marginBottom: space[3] }}>
          <Percent size={16} color={color.primary} /> Margen del mes
        </h2>
        <div className="cz-metric-grid" style={{ ["--cz-cols"]: 3 } as React.CSSProperties}>
          <MetricCard label="Facturado (mes)" value={dualUsd(margin.revThis, blue).main} sub={dualUsd(margin.revThis, blue).sub} icon={<DollarSign size={16} />} />
          <MetricCard
            label="Margen estimado (mes)"
            value={margin.hasCosted ? dualUsd(margin.marThis, blue).main : "—"}
            sub={margin.hasCosted ? dualUsd(margin.marThis, blue).sub : null}
            tone={margin.hasCosted ? "success" : "neutral"}
            icon={<HandCoins size={16} />}
          />
          <MetricCard
            label="Margen %"
            value={margin.hasCosted ? `${margin.pctThis.toFixed(0)}%` : "—"}
            sub={
              !margin.hasCosted
                ? "sin costos cargados"
                : margin.coveragePct < 99.5
                  ? `sobre ${margin.coveragePct.toFixed(0)}% del facturado`
                  : null
            }
            tone={margin.hasCosted && margin.coveragePct < 99.5 ? "warning" : "neutral"}
            icon={<Percent size={16} />}
          />
        </div>
        {margin.uncostedThis > 0 && (
          <div
            style={{
              marginTop: space[3],
              display: "flex",
              alignItems: "center",
              gap: space[2],
              padding: `${space[2]} ${space[3]}`,
              background: color.warningBg,
              border: `1px solid ${color.warning}`,
              borderRadius: radius.md,
              fontSize: text.xs,
              color: color.warning,
            }}
          >
            <AlertCircle size={14} />
            {formatMoney(Math.round(margin.uncostedThis), "USD")} ({(100 - margin.coveragePct).toFixed(0)}% de lo facturado
            este mes) <strong>sin costo asignado</strong> — no entra en el margen. Linkeá los productos al catálogo
            (con costo) al cargar la venta para que el margen sea exacto.
          </div>
        )}
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
                  title={`${b.label} — ${formatMoney(Math.round(b.revenue), "USD")}`}
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

      {/* v2 — Productos más vendidos */}
      <Card padding={5}>
        <h2 style={sectionTitle}>
          <Package size={16} color={color.primary} /> Productos más vendidos
        </h2>
        {!hasItems || topProducts.length === 0 ? (
          <EmptyState
            size="compact"
            title="Sin productos vendidos"
            description="Cargá ventas eligiendo productos del catálogo para ver el ranking y el margen."
          />
        ) : (
          <div className="cz-noscrollbar" style={{ overflowX: "auto", marginTop: space[3] }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 360 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr 64px 110px 80px",
                gap: space[2],
                padding: `0 ${space[3]}`,
                fontSize: 10,
                fontWeight: weight.semibold,
                color: color.textDim,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              <span>#</span>
              <span>Producto</span>
              <span style={{ textAlign: "right" }}>Unid.</span>
              <span style={{ textAlign: "right" }}>Facturado</span>
              <span style={{ textAlign: "right" }}>Margen</span>
            </div>
            {topProducts.map((p, i) => (
              <div
                key={p.name + i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr 64px 110px 80px",
                  gap: space[2],
                  alignItems: "center",
                  padding: `${space[2]} ${space[3]}`,
                  borderRadius: radius.md,
                  background: i === 0 ? color.primaryBg : "transparent",
                }}
              >
                <span style={{ fontSize: text.xs, fontWeight: weight.semibold, color: i === 0 ? color.primary : color.textMuted }}>
                  #{i + 1}
                </span>
                <span style={{ fontSize: text.sm, fontWeight: weight.medium, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </span>
                <span style={{ fontSize: text.sm, textAlign: "right", color: color.textMuted, fontVariantNumeric: "tabular-nums" }}>
                  {p.units}
                </span>
                <span style={{ fontSize: text.sm, fontWeight: weight.semibold, textAlign: "right", color: color.text, fontVariantNumeric: "tabular-nums" }}>
                  {formatMoney(Math.round(p.revenue), "USD")}
                </span>
                <span
                  style={{
                    fontSize: text.sm,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    color: p.marginPct == null ? color.textDim : p.marginPct >= 0 ? color.success : color.danger,
                  }}
                  title={p.marginPct == null ? "Sin costo asignado" : `Margen: ${formatMoney(Math.round(p.margin ?? 0), "USD")}`}
                >
                  {p.marginPct == null ? "—" : `${p.marginPct.toFixed(0)}%`}
                </span>
              </div>
            ))}
            </div>
          </div>
        )}
      </Card>

      {/* Top clientes + Por vendedor */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: space[4] }}>
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
                    {formatMoney(Math.round(c.total), "USD")}
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
                    {formatMoney(Math.round(v.total), "USD")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Por origen ("viene de") — Fase ④ */}
      <Card padding={5}>
        <h2 style={sectionTitle}>
          <MapPin size={16} color={color.primary} /> Por origen
        </h2>
        {!hasData || byOrigin.rows.length === 0 ? (
          <EmptyState
            size="compact"
            title="Sin datos de origen"
            description="Elegí el origen (“viene de”) al cargar una venta para ver de dónde vienen tus clientes."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: space[2], marginTop: space[3] }}>
            {byOrigin.rows.map((o, i) => {
              const pct = byOrigin.total > 0 ? Math.round((o.total / byOrigin.total) * 100) : 0;
              return (
                <div key={o.name} style={{ display: "flex", alignItems: "center", gap: space[3], padding: `${space[2]} ${space[3]}` }}>
                  <span style={{ fontSize: text.xs, fontWeight: weight.semibold, color: i === 0 ? color.primary : color.textMuted, width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {pct}%
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: text.sm, fontWeight: weight.medium, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {o.name}
                    </div>
                    <div style={{ fontSize: text.xs, color: color.textMuted }}>{o.count} {o.count === 1 ? "venta" : "ventas"}</div>
                  </div>
                  <div style={{ fontSize: text.sm, fontWeight: weight.bold, color: color.text }}>{formatMoney(Math.round(o.total), "USD")}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {kpis.porCobrar > 0 && (
        <div style={{ fontSize: text.xs, color: color.textMuted, display: "inline-flex", alignItems: "center", gap: space[2] }}>
          <TrendingDown size={12} />
          Saldo pendiente total: {formatMoney(Math.round(kpis.porCobrar), "USD")} · ver Deudas para el detalle.
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
