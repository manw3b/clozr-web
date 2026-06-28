import { describe, expect, it } from "vitest";
import {
  mapCashMovement,
  mapCashSession,
  mapSale,
  mapSaleItem,
  mapSaleItemReport,
  mapSalePayment,
  parseBuckets,
  toIsoUtc,
} from "@/lib/mappers";

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

describe("mapSaleItemReport (líneas de venta para Reportes)", () => {
  it("moneda: USD/ARS se respetan; desconocida/ausente → null (no asume)", () => {
    expect(mapSaleItemReport({ id: "r1", sale_id: "v1", currency: "USD" }).currency).toBe("USD");
    expect(mapSaleItemReport({ id: "r2", sale_id: "v1", currency: "ARS" }).currency).toBe("ARS");
    expect(mapSaleItemReport({ id: "r3", sale_id: "v1" }).currency).toBeNull();
  });

  it("unitCost y fxRate: presentes → número; ausentes → null (snapshot legacy)", () => {
    const con = mapSaleItemReport({ id: "r4", sale_id: "v1", unit_cost: 90, fx_rate: 1200 });
    expect(con.unitCost).toBe(90);
    expect(con.fxRate).toBe(1200);
    const sin = mapSaleItemReport({ id: "r5", sale_id: "v1" });
    expect(sin.unitCost).toBeNull();
    expect(sin.fxRate).toBeNull();
  });

  it("saleDate: usa sale_date, y si falta cae a sale_created_at (normalizada a UTC)", () => {
    expect(mapSaleItemReport({ id: "r6", sale_id: "v1", sale_date: "2026-06-27 10:00:00" }).saleDate).toBe(
      "2026-06-27T10:00:00Z",
    );
    expect(
      mapSaleItemReport({ id: "r7", sale_id: "v1", sale_created_at: "2026-06-20 09:00:00" }).saleDate,
    ).toBe("2026-06-20T09:00:00Z");
  });

  it("defaults: cantidad/precio/subtotal → 0, descripción → ''", () => {
    const r = mapSaleItemReport({ id: "r8", sale_id: "v1" });
    expect(r.quantity).toBe(0);
    expect(r.unitPrice).toBe(0);
    expect(r.subtotal).toBe(0);
    expect(r.description).toBe("");
  });
});

describe("mapCashMovement (movimientos de caja)", () => {
  it("kind: 'expense' se respeta; cualquier otra cosa → 'income'", () => {
    expect(mapCashMovement({ id: "m1", kind: "expense" }).kind).toBe("expense");
    expect(mapCashMovement({ id: "m2", kind: "income" }).kind).toBe("income");
    expect(mapCashMovement({ id: "m3" }).kind).toBe("income");
  });

  it("moneda USD/ARS y monto ausente → 0", () => {
    expect(mapCashMovement({ id: "m4", currency: "USD" }).currency).toBe("USD");
    expect(mapCashMovement({ id: "m5", currency: "ARS" }).currency).toBe("ARS");
    expect(mapCashMovement({ id: "m6" }).amount).toBe(0);
  });

  it("movedAt: usa moved_at, y si falta cae a created_at (normalizada a UTC)", () => {
    expect(mapCashMovement({ id: "m7", moved_at: "2026-06-27 12:00:00" }).movedAt).toBe(
      "2026-06-27T12:00:00Z",
    );
    expect(mapCashMovement({ id: "m8", created_at: "2026-06-26 08:00:00" }).movedAt).toBe(
      "2026-06-26T08:00:00Z",
    );
  });
});

describe("mapCashSession (apertura/cierre + arqueo)", () => {
  it("sesión abierta sin cerrar: closedAt/balances en null, buckets parseados", () => {
    const s = mapCashSession({
      id: "s1",
      session_date: "2026-06-27",
      opened_at: "2026-06-27 09:00:00",
      opened_balance_ars: 50_000,
      opened_balance_usd: 40,
      opened_buckets: '{"Efectivo·ARS":50000,"Efectivo·USD":40}',
    });
    expect(s.openedAt).toBe("2026-06-27T09:00:00Z");
    expect(s.openedBalanceArs).toBe(50_000);
    expect(s.openedBuckets).toEqual({ "Efectivo·ARS": 50_000, "Efectivo·USD": 40 });
    expect(s.closedAt).toBeNull();
    expect(s.closedBalanceArs).toBeNull();
    expect(s.closedBalanceUsd).toBeNull();
    expect(s.closedBuckets).toBeNull();
  });

  it("balances de apertura ausentes → 0", () => {
    const s = mapCashSession({ id: "s2" });
    expect(s.openedBalanceArs).toBe(0);
    expect(s.openedBalanceUsd).toBe(0);
    expect(s.openedBuckets).toBeNull();
  });
});

describe("parseBuckets (JSON de arqueo del Worker, tolerante)", () => {
  it("vacío/null/undefined → null", () => {
    expect(parseBuckets(null)).toBeNull();
    expect(parseBuckets(undefined)).toBeNull();
    expect(parseBuckets("")).toBeNull();
  });

  it("objeto válido → CashBuckets con los valores numéricos", () => {
    expect(parseBuckets('{"Efectivo·ARS":1000,"Transferencia·USD":50}')).toEqual({
      "Efectivo·ARS": 1000,
      "Transferencia·USD": 50,
    });
  });

  it("descarta valores no numéricos y coerciona strings numéricos", () => {
    expect(parseBuckets('{"Efectivo·ARS":1000,"basura":"no"}')).toEqual({ "Efectivo·ARS": 1000 });
    expect(parseBuckets('{"a":"50"}')).toEqual({ a: 50 });
  });

  it("objeto vacío, array o JSON inválido → null", () => {
    expect(parseBuckets("{}")).toBeNull();
    expect(parseBuckets("[1,2,3]")).toBeNull();
    expect(parseBuckets("no soy json")).toBeNull();
    expect(parseBuckets('{"a":"x"}')).toBeNull();
  });
});
