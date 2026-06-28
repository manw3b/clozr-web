import { describe, expect, it } from "vitest";
import { appointmentCode, saleCode } from "@/lib/types";

describe("saleCode", () => {
  it("arma {iniciales}-{seq}{dia}{mes} desde order_day", () => {
    // Gonzalo Pérez → GP, 27 de junio, seq 5 → "GP-5276"
    expect(
      saleCode({ sellerName: "Gonzalo Pérez", orderSeq: 5, orderDay: "2026-06-27" }),
    ).toBe("GP-5276");
  });

  it("con un solo nombre usa una sola inicial", () => {
    expect(saleCode({ sellerName: "Gonzalo", orderSeq: 5, orderDay: "2026-06-27" })).toBe(
      "G-5276",
    );
  });

  it("sin número de orden devuelve null (venta vieja)", () => {
    expect(saleCode({ sellerName: "Gonzalo Pérez", orderSeq: null, orderDay: "2026-06-27" })).toBeNull();
  });

  it("sin vendedor devuelve null", () => {
    expect(saleCode({ sellerName: "", orderSeq: 5, orderDay: "2026-06-27" })).toBeNull();
  });
});

describe("appointmentCode", () => {
  it("arma {inicial}{dia}{letraMes}{seqDia} (ejemplo del doc)", () => {
    // Pyter, 27 de junio (mes 06 → F), 1er turno del día → "P27F1"
    expect(
      appointmentCode({ ownerName: "Pyter", appointmentAt: "2026-06-27T15:00", daySeq: 1 }),
    ).toBe("P27F1");
  });

  it("enero es A y diciembre es L", () => {
    expect(
      appointmentCode({ ownerName: "Ana", appointmentAt: "2026-01-09T10:00", daySeq: 2 }),
    ).toBe("A09A2");
    expect(
      appointmentCode({ ownerName: "Beto", appointmentAt: "2026-12-05T10:00", daySeq: 3 }),
    ).toBe("B05L3");
  });

  it("sin número de orden del día devuelve null", () => {
    expect(
      appointmentCode({ ownerName: "Pyter", appointmentAt: "2026-06-27T15:00", daySeq: null }),
    ).toBeNull();
  });

  it("sin responsable devuelve null", () => {
    expect(
      appointmentCode({ ownerName: "", appointmentAt: "2026-06-27T15:00", daySeq: 1 }),
    ).toBeNull();
  });

  it("sin fecha válida devuelve null", () => {
    expect(appointmentCode({ ownerName: "Pyter", appointmentAt: "", daySeq: 1 })).toBeNull();
  });
});
