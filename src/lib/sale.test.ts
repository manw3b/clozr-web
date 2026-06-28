import { describe, expect, it } from "vitest";
import { computeSaleTotals, type SaleLine, type SalePaymentLine } from "@/lib/sale";

const blue = 1200;

describe("computeSaleTotals — US$ es la fuente de verdad", () => {
  it("ítems y pago en US$, con blue: US$ exacto + ARS de referencia", () => {
    const items: SaleLine[] = [{ subtotal: 150, currency: "USD" }];
    const payments: SalePaymentLine[] = [{ amount: 50, currency: "USD" }];
    const t = computeSaleTotals(items, payments, blue);
    expect(t.totalUsd).toBe(150);
    expect(t.totalPaidUsd).toBe(50);
    expect(t.balanceUsd).toBe(100);
    // ARS de referencia (× blue)
    expect(t.total).toBe(180_000);
    expect(t.totalPaid).toBe(60_000);
    expect(t.balance).toBe(120_000);
    expect(t.isPaid).toBe(false);
  });

  it("ítems y pago en ARS, con blue: ARS tal cual + US$ ÷ blue", () => {
    const items: SaleLine[] = [{ subtotal: 180_000, currency: "ARS" }];
    const payments: SalePaymentLine[] = [{ amount: 60_000, currency: "ARS" }];
    const t = computeSaleTotals(items, payments, blue);
    expect(t.total).toBe(180_000);
    expect(t.balance).toBe(120_000);
    expect(t.totalUsd).toBe(150);
    expect(t.totalPaidUsd).toBe(50);
    expect(t.balanceUsd).toBe(100);
  });

  it("ítems mixtos US$ + ARS: suma cada uno en su moneda", () => {
    const items: SaleLine[] = [
      { subtotal: 100, currency: "USD" }, // 100 US$
      { subtotal: 60_000, currency: "ARS" }, // 50 US$
    ];
    const t = computeSaleTotals(items, [], blue);
    expect(t.totalUsd).toBe(150);
    expect(t.total).toBe(180_000); // 100×1200 + 60_000
  });
});

describe("computeSaleTotals — saldada (isPaid)", () => {
  it("pago completo en US$ → saldada", () => {
    const t = computeSaleTotals(
      [{ subtotal: 150, currency: "USD" }],
      [{ amount: 150, currency: "USD" }],
      blue,
    );
    expect(t.balanceUsd).toBe(0);
    expect(t.isPaid).toBe(true);
  });

  it("umbral de 0.01 US$: ≤ 0.01 saldada, > 0.01 no", () => {
    const casiPaga = computeSaleTotals(
      [{ subtotal: 150.01, currency: "USD" }],
      [{ amount: 150, currency: "USD" }],
      blue,
    );
    expect(casiPaga.isPaid).toBe(true); // saldo 0.01

    const debe = computeSaleTotals(
      [{ subtotal: 150.02, currency: "USD" }],
      [{ amount: 150, currency: "USD" }],
      blue,
    );
    expect(debe.isPaid).toBe(false); // saldo 0.02
  });

  it("sin pagos (cuenta corriente): no saldada", () => {
    const t = computeSaleTotals([{ subtotal: 150, currency: "USD" }], [], blue);
    expect(t.totalPaidUsd).toBe(0);
    expect(t.balanceUsd).toBe(150);
    expect(t.isPaid).toBe(false);
  });
});

describe("computeSaleTotals — venta legacy (sin blue)", () => {
  it("rate 0: US$ → null y el saldo se evalúa en pesos", () => {
    const t = computeSaleTotals(
      [{ subtotal: 180_000, currency: "ARS" }],
      [{ amount: 60_000, currency: "ARS" }],
      0,
    );
    expect(t.totalUsd).toBeNull();
    expect(t.totalPaidUsd).toBeNull();
    expect(t.balanceUsd).toBeNull();
    expect(t.total).toBe(180_000);
    expect(t.balance).toBe(120_000);
    expect(t.isPaid).toBe(false);
  });

  it("rate 0 y saldo en pesos en cero → saldada por ARS", () => {
    const t = computeSaleTotals(
      [{ subtotal: 50_000, currency: "ARS" }],
      [{ amount: 50_000, currency: "ARS" }],
      0,
    );
    expect(t.balanceUsd).toBeNull();
    expect(t.isPaid).toBe(true);
  });
});
