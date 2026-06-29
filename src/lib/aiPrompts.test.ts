import { describe, expect, it } from "vitest";
import { examplesForView } from "@/lib/aiPrompts";

describe("examplesForView", () => {
  it("devuelve prompts propios para una pantalla conocida", () => {
    const deudas = examplesForView("deudas");
    expect(deudas.length).toBeGreaterThan(0);
    expect(deudas.some((p) => /cobro|debe/i.test(p))).toBe(true);
  });

  it("pantallas distintas dan sugerencias distintas", () => {
    expect(examplesForView("inventory")).not.toEqual(examplesForView("sales"));
  });

  it("cae a los genéricos para una vista desconocida o sin valor", () => {
    const generic = examplesForView("no-existe");
    expect(generic).toEqual(examplesForView(null));
    expect(generic).toEqual(examplesForView(undefined));
    expect(generic.length).toBeGreaterThan(0);
  });

  it("siempre devuelve al menos un prompt", () => {
    for (const v of ["home", "sales", "deudas", "inventory", "cash", "repairs", "agenda", "x"]) {
      expect(examplesForView(v).length).toBeGreaterThan(0);
    }
  });
});
