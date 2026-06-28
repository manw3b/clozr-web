/**
 * Ensamblado de la venta (checkout) — la parte pura, sin red.
 *
 * El Worker NO calcula los totales en el POST de venta: los manda `createSale`
 * (en `api.ts`) ya calculados. Acá vive ese cálculo, aislado y testeado: a
 * partir de los ítems y pagos (cada uno en su moneda) y el blue del momento,
 * arma el total/saldo en US$ (fuente de verdad) y en ARS (referencia congelada).
 *
 * `rate` ya viene normalizado (ver `normalizeRate` en `money.ts`): blue > 0, o 0.
 */
import type { Currency } from "./types";
import { toArs, toUsd } from "./money";

/** Una línea de venta, en la moneda del ítem. */
export interface SaleLine {
  subtotal: number;
  currency: Currency;
}

/** Un pago de la venta, en la moneda elegida. */
export interface SalePaymentLine {
  amount: number;
  currency: Currency;
}

/** Totales derivados de una venta: US$ es la fuente de verdad, ARS la referencia. */
export interface SaleTotals {
  /** ARS de referencia (= total, las ventas no manejan descuento de subtotal). */
  subtotal: number;
  /** Total en ARS de referencia (congelado al blue del momento). */
  total: number;
  /** Cobrado en ARS de referencia. */
  totalPaid: number;
  /** Saldo en ARS de referencia. */
  balance: number;
  /** Total en US$ (fuente de verdad), o null si la venta es legacy (sin blue). */
  totalUsd: number | null;
  /** Cobrado en US$, o null si legacy. */
  totalPaidUsd: number | null;
  /** Saldo en US$, o null si legacy. */
  balanceUsd: number | null;
  /** ¿Saldada? Por el saldo en US$ si hay; si es legacy, por el saldo en ARS. */
  isPaid: boolean;
}

/**
 * Calcula los totales de una venta. US$-nativo: con blue, el total/saldo en US$
 * es la fuente de verdad (ítems US$ tal cual + ítems ARS ÷ blue) y las columnas
 * ARS quedan de referencia (× blue). Sin blue, la venta es legacy: US$ → null y
 * el saldo se evalúa en pesos. El umbral de "saldada" es 0.01 (centavos de US$).
 */
export function computeSaleTotals(
  items: SaleLine[],
  payments: SalePaymentLine[],
  rate: number,
): SaleTotals {
  const hasRate = rate > 0;
  const total = items.reduce((a, i) => a + toArs(i.subtotal, i.currency, rate), 0);
  const totalPaid = payments.reduce((a, p) => a + toArs(p.amount, p.currency, rate), 0);
  const balance = total - totalPaid;
  const totalUsd = hasRate
    ? items.reduce((a, i) => a + (toUsd(i.subtotal, i.currency, rate) ?? 0), 0)
    : null;
  const totalPaidUsd = hasRate
    ? payments.reduce((a, p) => a + (toUsd(p.amount, p.currency, rate) ?? 0), 0)
    : null;
  const balanceUsd =
    hasRate && totalUsd != null && totalPaidUsd != null ? totalUsd - totalPaidUsd : null;
  const isPaid = balanceUsd != null ? balanceUsd <= 0.01 : balance <= 0.01;
  return { subtotal: total, total, totalPaid, balance, totalUsd, totalPaidUsd, balanceUsd, isPaid };
}
