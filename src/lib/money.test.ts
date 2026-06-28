import { describe, expect, it } from "vitest";
import { normalizeRate, toArs, toUsd } from "@/lib/money";

describe("normalizeRate", () => {
  it("devuelve la cotización si es positiva", () => {
    expect(normalizeRate(1200)).toBe(1200);
  });

  it("0, negativos, null y undefined se vuelven 0", () => {
    expect(normalizeRate(0)).toBe(0);
    expect(normalizeRate(-5)).toBe(0);
    expect(normalizeRate(null)).toBe(0);
    expect(normalizeRate(undefined)).toBe(0);
  });
});

describe("toUsd (congelar a dólares)", () => {
  it("US$ queda tal cual, sin tocar el blue", () => {
    expect(toUsd(150, "USD", 1200)).toBe(150);
    expect(toUsd(150, "USD", 0)).toBe(150); // ni siquiera necesita blue
  });

  it("ARS se divide por el blue", () => {
    expect(toUsd(180_000, "ARS", 1200)).toBe(150);
  });

  it("ARS sin blue (0/negativo) devuelve null → no se puede congelar", () => {
    expect(toUsd(180_000, "ARS", 0)).toBeNull();
    expect(toUsd(180_000, "ARS", -5)).toBeNull();
  });
});

describe("toArs (referencia en pesos, congelada)", () => {
  it("US$ con blue se multiplica", () => {
    expect(toArs(150, "USD", 1200)).toBe(180_000);
  });

  it("US$ sin blue queda como el número tal cual", () => {
    expect(toArs(150, "USD", 0)).toBe(150);
  });

  it("ARS queda tal cual (ya está en pesos)", () => {
    expect(toArs(180_000, "ARS", 1200)).toBe(180_000);
    expect(toArs(180_000, "ARS", 0)).toBe(180_000);
  });
});

describe("ida y vuelta US$↔ARS con el mismo blue", () => {
  it("toUsd(toArs(x)) recupera el monto original", () => {
    const blue = 1200;
    const ars = toArs(150, "USD", blue); // 180_000
    expect(toUsd(ars, "ARS", blue)).toBe(150);
  });
});
