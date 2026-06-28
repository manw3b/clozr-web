/**
 * Mappers snake_case (DB/Worker) → camelCase (UI), puros y testeables.
 *
 * Extraídos de `api.ts` (que se queda con el cliente HTTP). Acá viven los de
 * venta — los más sensibles porque cargan la plata (`total_usd`, `fx_rate`,
 * `balance_usd`, la moneda de cada ítem/pago). Un campo mal mapeado se traduce
 * en plata mostrada mal, así que están cubiertos por tests.
 */
import type { Currency, Sale, SaleItem, SalePayment } from "./types";

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
