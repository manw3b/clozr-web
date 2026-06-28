import { describe, expect, it } from "vitest";
import { mapSale, mapSaleItem, mapSalePayment, toIsoUtc } from "@/lib/mappers";

describe("toIsoUtc", () => {
  it("vacío/null/undefined → string vacío", () => {
    expect(toIsoUtc("")).toBe("");
    expect(toIsoUtc(null)).toBe("");
    expect(toIsoUtc(undefined)).toBe("");
  });

  it("datetime del Worker (con espacio, sin zona) → ISO-UTC con Z", () => {
    expect(toIsoUtc("2026-06-27 15:30:00")).toBe("2026-06-27T15:30:00Z");
  });

  it("ya en ISO con T pero sin zona → le agrega Z", () => {
    expect(toIsoUtc("2026-06-27T15:30:00")).toBe("2026-06-27T15:30:00Z");
  });

  it("si ya trae zona (Z u offset) no la toca", () => {
    expect(toIsoUtc("2026-06-27T15:30:00Z")).toBe("2026-06-27T15:30:00Z");
    expect(toIsoUtc("2026-06-27T15:30:00-03:00")).toBe("2026-06-27T15:30:00-03:00");
  });
});

describe("mapSale (la plata US$-nativa)", () => {
  it("mapea US$ como fuente de verdad + ARS de referencia", () => {
    const s = mapSale({
      id: "v1",
      customer_name: "Juan",
      seller_name: "Pyter",
      total: 180_000,
      total_paid: 60_000,
      balance: 120_000,
      total_usd: 150,
      total_paid_usd: 50,
      balance_usd: 100,
      fx_rate: 1200,
      is_paid: 0,
    });
    expect(s.total).toBe(180_000);
    expect(s.totalUsd).toBe(150);
    expect(s.totalPaidUsd).toBe(50);
    expect(s.balanceUsd).toBe(100);
    expect(s.fxRate).toBe(1200);
    expect(s.isPaid).toBe(false);
  });

  it("venta legacy sin US$: total_usd/fx_rate → null (no inventa dólares)", () => {
    const s = mapSale({ id: "v2", total: 50_000 });
    expect(s.totalUsd).toBeNull();
    expect(s.totalPaidUsd).toBeNull();
    expect(s.balanceUsd).toBeNull();
    expect(s.fxRate).toBeNull();
  });

  it("0 explícito en US$ NO es null (es una venta de regalo/saldada)", () => {
    const s = mapSale({ id: "v3", total_usd: 0, balance_usd: 0 });
    expect(s.totalUsd).toBe(0);
    expect(s.balanceUsd).toBe(0);
  });

  it("fallbacks: cliente sin nombre → 'Consumidor final', montos ausentes → 0", () => {
    const s = mapSale({ id: "v4" });
    expect(s.customerName).toBe("Consumidor final");
    expect(s.sellerName).toBeUndefined();
    expect(s.total).toBe(0);
    expect(s.totalPaid).toBe(0);
  });

  it("is_paid se coerciona a boolean", () => {
    expect(mapSale({ id: "v5", is_paid: 1 }).isPaid).toBe(true);
    expect(mapSale({ id: "v6", is_paid: 0 }).isPaid).toBe(false);
    expect(mapSale({ id: "v7" }).isPaid).toBe(false);
  });

  it("normaliza fechas del Worker a ISO-UTC", () => {
    const s = mapSale({ id: "v8", sale_date: "2026-06-27 10:00:00" });
    expect(s.saleDate).toBe("2026-06-27T10:00:00Z");
  });
});

describe("mapSaleItem", () => {
  it("normaliza la moneda: USD se respeta, cualquier otra cae a ARS", () => {
    expect(mapSaleItem({ id: "i1", description: "iPhone", currency: "USD" }).currency).toBe("USD");
    expect(mapSaleItem({ id: "i2", description: "Funda", currency: "ARS" }).currency).toBe("ARS");
    expect(mapSaleItem({ id: "i3", description: "Cargador" }).currency).toBe("ARS");
  });

  it("defaults: cantidad 1, precio/subtotal 0, imei null", () => {
    const it0 = mapSaleItem({ id: "i4", description: "X" });
    expect(it0.quantity).toBe(1);
    expect(it0.unitPrice).toBe(0);
    expect(it0.subtotal).toBe(0);
    expect(it0.imei).toBeNull();
  });
});

describe("mapSalePayment", () => {
  it("moneda: null → ARS; USD se respeta", () => {
    expect(mapSalePayment({ id: "p1", method: "efectivo" }).currency).toBe("ARS");
    expect(mapSalePayment({ id: "p2", method: "transferencia", currency: "USD" }).currency).toBe("USD");
  });

  it("monto ausente → 0 e is_deposit se coerciona a boolean", () => {
    const p = mapSalePayment({ id: "p3", method: "efectivo", is_deposit: 1 });
    expect(p.amount).toBe(0);
    expect(p.isDeposit).toBe(true);
    expect(mapSalePayment({ id: "p4", method: "efectivo" }).isDeposit).toBe(false);
  });
});
