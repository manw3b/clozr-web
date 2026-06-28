/**
 * Conversión de plata US$ ↔ ARS — la "regla de oro" en un solo lugar.
 *
 * El dólar es la moneda madre: una venta congela `total_usd` / `amount_usd`
 * contra el blue del momento (`fx_rate`) para que el saldo no se licúe. Estas
 * funciones puras encapsulan ese congelamiento. Las usa `api.ts` (createSale /
 * addPayment) y están testeadas de forma aislada — no metas la regla inline.
 *
 * `rate` siempre es el blue: ARS por 1 US$.
 */
import type { Currency } from "./types";

/** Normaliza un blue/cotización a un número usable: el valor si es > 0, o 0. */
export function normalizeRate(rate: number | null | undefined): number {
  return rate && rate > 0 ? rate : 0;
}

/**
 * Congela un monto a US$ (fuente de verdad):
 *  - US$ → tal cual.
 *  - ARS con blue (> 0) → ÷ blue.
 *  - ARS sin blue → `null` (no hay con qué congelar; queda legacy en pesos).
 */
export function toUsd(amount: number, currency: Currency, rate: number): number | null {
  if (currency === "USD") return amount;
  return rate > 0 ? amount / rate : null;
}

/**
 * Convierte un monto a ARS de referencia (columna congelada, NO se vuelve a tocar):
 *  - US$ con blue (> 0) → × blue.
 *  - US$ sin blue → el número tal cual (no hay con qué convertir).
 *  - ARS → tal cual (ya está en pesos).
 */
export function toArs(amount: number, currency: Currency, rate: number): number {
  return currency === "USD" && rate > 0 ? amount * rate : amount;
}
