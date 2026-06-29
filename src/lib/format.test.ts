import { describe, expect, it } from "vitest";
import {
  displayName,
  dualArs,
  dualMoney,
  dualUsd,
  formatMoney,
  formatMoneyCompact,
  toLocalISODate,
} from "@/lib/format";

// Intl mete un espacio duro (U+00A0, o U+202F en algunos ICU) entre el simbolo
// y el numero. Normalizamos cualquier whitespace a un espacio comun para que
// los asserts no dependan de ese detalle del runtime. En JS, \s ya matchea esos
// espacios no-rompibles.
const norm = (s: string) => s.replace(/\s/g, " ");

describe("formatMoney", () => {
  it("agrupa miles con punto y sin decimales (ARS)", () => {
    const s = norm(formatMoney(1_234_567, "ARS"));
    expect(s).toContain("1.234.567");
    expect(s).not.toContain("US$");
    expect(s).toContain("$");
  });

  it("usa el símbolo US$ para dólares", () => {
    const s = norm(formatMoney(1_234_567, "USD"));
    expect(s).toContain("US$");
    expect(s).toContain("1.234.567");
  });

  it("redondea a entero (sin centavos)", () => {
    const s = norm(formatMoney(1234.99, "USD"));
    expect(s).toContain("1.235");
    expect(s).not.toContain(",");
  });

  it("ARS por defecto cuando no se pasa moneda", () => {
    expect(norm(formatMoney(1000))).not.toContain("US$");
  });
});

describe("formatMoneyCompact", () => {
  it("abrevia millones, miles y unidades", () => {
    expect(formatMoneyCompact(1_290_000)).toBe("$1.29M");
    expect(formatMoneyCompact(54_300)).toBe("$54.3k");
    expect(formatMoneyCompact(850)).toBe("$850");
  });

  it("conserva el signo en negativos", () => {
    expect(formatMoneyCompact(-1_290_000)).toBe("-$1.29M");
  });

  it("usa US$ para dólares", () => {
    expect(formatMoneyCompact(1_290_000, "USD")).toBe("US$1.29M");
  });
});

describe("dualMoney (ARS guardado → US$ en pantalla)", () => {
  it("con cotización: US$ como principal y ARS de referencia", () => {
    const r = dualMoney(150_000, 1000);
    expect(norm(r.main)).toBe("US$ 150");
    expect(norm(r.sub ?? "")).toBe("$ 150.000");
  });

  it("sin cotización: cae a ARS solo, sin secundario", () => {
    const r = dualMoney(150_000, null);
    expect(norm(r.main)).toContain("150.000");
    expect(r.sub).toBeNull();
  });

  it("cotización 0 o negativa se trata como sin cotización", () => {
    expect(dualMoney(150_000, 0).sub).toBeNull();
    expect(dualMoney(150_000, -5).sub).toBeNull();
  });
});

describe("dualUsd (US$ fuente de verdad → ≈ pesos de referencia)", () => {
  it("con cotización: US$ principal y ≈ pesos como referencia", () => {
    const r = dualUsd(150, 1000);
    expect(norm(r.main)).toBe("US$ 150");
    expect(r.sub).not.toBeNull();
    expect(r.sub!.startsWith("≈")).toBe(true);
    expect(norm(r.sub!)).toContain("150.000");
  });

  it("sin cotización: sólo US$, sin referencia en pesos", () => {
    const r = dualUsd(150, null);
    expect(norm(r.main)).toBe("US$ 150");
    expect(r.sub).toBeNull();
  });
});

describe("dualArs (ARS fuente de verdad → ≈ US$ de referencia, para el taller)", () => {
  it("con cotización: ARS principal y ≈ US$ como referencia", () => {
    const r = dualArs(150_000, 1000);
    expect(norm(r.main)).toBe("$ 150.000");
    expect(r.sub).not.toBeNull();
    expect(r.sub!.startsWith("≈")).toBe(true);
    expect(norm(r.sub!)).toContain("US$ 150");
  });

  it("sin cotización: sólo ARS, sin referencia en US$", () => {
    const r = dualArs(150_000, null);
    expect(norm(r.main)).toBe("$ 150.000");
    expect(r.sub).toBeNull();
  });

  it("cotización 0 o negativa se trata como sin cotización", () => {
    expect(dualArs(150_000, 0).sub).toBeNull();
    expect(dualArs(150_000, -5).sub).toBeNull();
  });
});

describe("displayName", () => {
  it("usa el nombre cargado si existe y no es el email", () => {
    expect(displayName({ name: "Juan", email: "juan@x.com" })).toBe("Juan");
  });

  it("arma un nombre lindo desde el prefijo del email (punto)", () => {
    expect(displayName({ email: "maria.gomez@gmail.com" })).toBe("Maria Gomez");
  });

  it("también separa por guion bajo", () => {
    expect(displayName({ email: "juan_perez@x.com" })).toBe("Juan Perez");
  });

  it("cuando el name es igual al email, cae al prefijo", () => {
    expect(displayName({ name: "x@x.com", email: "x@x.com" })).toBe("X");
  });

  it("sin datos útiles devuelve un fallback amable", () => {
    expect(displayName({})).toBe("crack");
    expect(displayName({ email: "123@x.com" })).toBe("crack");
  });
});

describe("toLocalISODate (huso local, no UTC)", () => {
  it("formatea YYYY-MM-DD desde componentes locales", () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toLocalISODate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});
