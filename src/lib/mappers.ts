/**
 * Mappers snake_case (DB/Worker) → camelCase (UI), puros y testeables.
 *
 * Extraídos de `api.ts` (que se queda con el cliente HTTP). Acá viven los de
 * venta — los más sensibles porque cargan la plata (`total_usd`, `fx_rate`,
 * `balance_usd`, la moneda de cada ítem/pago). Un campo mal mapeado se traduce
 * en plata mostrada mal, así que están cubiertos por tests.
 */
import type {
  CashBuckets,
  CashMovement,
  CashSession,
  Currency,
  Sale,
  SaleItem,
  SaleItemReport,
  SalePayment,
} from "./types";

/** El Worker devuelve datetime('now') = "YYYY-MM-DD HH:MM:SS" (UTC, sin zona).
 *  Lo normalizamos a ISO-UTC para que new Date()/formatRelative lo interpreten
 *  como instante UTC y lo muestren en hora local correcta (sino se corre 3h). */
export function toIsoUtc(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.includes("T") ? s : s.replace(" ", "T");
  return /[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : t + "Z";
}

export interface SaleRaw {
  id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  seller_name?: string | null;
  subtotal?: number | null;
  total?: number | null;
  total_paid?: number | null;
  balance?: number | null;
  total_usd?: number | null;
  total_paid_usd?: number | null;
  balance_usd?: number | null;
  fx_rate?: number | null;
  is_paid?: number | null;
  payment_method?: string | null;
  notes?: string | null;
  sale_date?: string | null;
  created_at?: string | null;
  order_seq?: number | null;
  order_day?: string | null;
  appointment_at?: string | null;
  origin?: string | null;
}
export function mapSale(r: SaleRaw): Sale {
  return {
    id: r.id,
    customerId: r.customer_id ?? undefined,
    customerName: r.customer_name ?? "Consumidor final",
    sellerName: r.seller_name ?? undefined,
    subtotal: Number(r.subtotal ?? 0),
    total: Number(r.total ?? 0),
    totalPaid: Number(r.total_paid ?? 0),
    balance: Number(r.balance ?? 0),
    totalUsd: r.total_usd != null ? Number(r.total_usd) : null,
    totalPaidUsd: r.total_paid_usd != null ? Number(r.total_paid_usd) : null,
    balanceUsd: r.balance_usd != null ? Number(r.balance_usd) : null,
    fxRate: r.fx_rate != null ? Number(r.fx_rate) : null,
    isPaid: !!r.is_paid,
    paymentMethod: r.payment_method ?? undefined,
    notes: r.notes ?? undefined,
    saleDate: toIsoUtc(r.sale_date) || undefined,
    createdAt: toIsoUtc(r.created_at) || undefined,
    orderSeq: r.order_seq ?? null,
    orderDay: r.order_day ?? null,
    appointmentAt: r.appointment_at ?? null,
    origin: r.origin ?? null,
  };
}

export interface SaleItemRaw {
  id: string;
  description: string;
  quantity?: number | null;
  unit_price?: number | null;
  subtotal?: number | null;
  imei?: string | null;
  currency?: string | null;
}
export function mapSaleItem(r: SaleItemRaw): SaleItem {
  return {
    id: r.id,
    description: r.description,
    quantity: Number(r.quantity ?? 1),
    unitPrice: Number(r.unit_price ?? 0),
    subtotal: Number(r.subtotal ?? 0),
    imei: r.imei ?? null,
    currency: r.currency === "USD" ? "USD" : "ARS",
  };
}

export interface SalePaymentRaw {
  id: string;
  method: string;
  currency?: string | null;
  amount?: number | null;
  is_deposit?: number | null;
}
export function mapSalePayment(r: SalePaymentRaw): SalePayment {
  return {
    id: r.id,
    method: r.method,
    currency: (r.currency as Currency) ?? "ARS",
    amount: Number(r.amount ?? 0),
    isDeposit: !!r.is_deposit,
  };
}

export interface SaleItemReportRaw {
  id: string;
  sale_id: string;
  catalog_item_id?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  subtotal?: number | null;
  unit_cost?: number | null;
  currency?: string | null;
  fx_rate?: number | null;
  sale_date?: string | null;
  sale_created_at?: string | null;
  seller_name?: string | null;
}
export function mapSaleItemReport(r: SaleItemReportRaw): SaleItemReport {
  return {
    id: r.id,
    saleId: r.sale_id,
    catalogItemId: r.catalog_item_id ?? null,
    description: r.description ?? "",
    quantity: Number(r.quantity ?? 0),
    unitPrice: Number(r.unit_price ?? 0),
    subtotal: Number(r.subtotal ?? 0),
    // Snapshot del costo al momento de la venta (0 en ventas viejas → el
    // consumidor cae al costo actual del catálogo como fallback).
    unitCost: r.unit_cost != null ? Number(r.unit_cost) : null,
    // Moneda de la línea + blue congelado de la venta → Reportes pasa cada
    // línea a US$ sin licuar (US$ tal cual; ARS ÷ fx_rate, o ÷ blue si legacy).
    currency: r.currency === "USD" ? "USD" : r.currency === "ARS" ? "ARS" : null,
    fxRate: r.fx_rate != null ? Number(r.fx_rate) : null,
    saleDate: toIsoUtc(r.sale_date ?? r.sale_created_at) || null,
    sellerName: r.seller_name ?? null,
  };
}

export interface CashMovementRaw {
  id: string;
  kind?: string | null;
  amount?: number | null;
  currency?: string | null;
  description?: string | null;
  category?: string | null;
  payment_method?: string | null;
  customer_name?: string | null;
  sale_id?: string | null;
  moved_at?: string | null;
  created_at?: string | null;
}
export function mapCashMovement(r: CashMovementRaw): CashMovement {
  return {
    id: r.id,
    kind: r.kind === "expense" ? "expense" : "income",
    amount: Number(r.amount ?? 0),
    currency: r.currency === "USD" ? "USD" : "ARS",
    description: r.description ?? undefined,
    category: r.category ?? undefined,
    paymentMethod: r.payment_method ?? undefined,
    customerName: r.customer_name ?? undefined,
    saleId: r.sale_id ?? undefined,
    movedAt: toIsoUtc(r.moved_at ?? r.created_at) || undefined,
  };
}

export interface CashSessionRaw {
  id: string;
  session_date?: string | null;
  opened_at?: string | null;
  opened_balance_ars?: number | null;
  opened_balance_usd?: number | null;
  opened_buckets?: string | null;
  closed_at?: string | null;
  closed_balance_ars?: number | null;
  closed_balance_usd?: number | null;
  closed_buckets?: string | null;
}
/** Parsea el JSON de buckets del Worker ({ "Efectivo·ARS": 1000 }) de forma
 *  tolerante: descarta valores no numéricos y cualquier cosa que no sea objeto. */
export function parseBuckets(s: string | null | undefined): CashBuckets | null {
  if (!s) return null;
  try {
    const o = JSON.parse(s) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const out: CashBuckets = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
export function mapCashSession(r: CashSessionRaw): CashSession {
  return {
    id: r.id,
    date: r.session_date ?? "",
    openedAt: toIsoUtc(r.opened_at),
    openedBalanceArs: Number(r.opened_balance_ars ?? 0),
    openedBalanceUsd: Number(r.opened_balance_usd ?? 0),
    openedBuckets: parseBuckets(r.opened_buckets),
    closedAt: r.closed_at ? toIsoUtc(r.closed_at) : null,
    closedBalanceArs: r.closed_balance_ars != null ? Number(r.closed_balance_ars) : null,
    closedBalanceUsd: r.closed_balance_usd != null ? Number(r.closed_balance_usd) : null,
    closedBuckets: parseBuckets(r.closed_buckets),
  };
}
