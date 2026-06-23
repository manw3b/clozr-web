/**
 * Mensajes rápidos (Fase ③) — biblioteca de plantillas con nombre, editable por
 * negocio, para enviar por WhatsApp en un toque desde la ficha del cliente.
 *
 * Se guardan en workspace_settings bajo `quick_templates` (JSON array). Defaults
 * portados de la app desktop (waTemplates). Placeholders: {nombre} {negocio} {producto}.
 */

export interface QuickTemplate {
  id: string;
  name: string;
  body: string;
}

export const QUICK_TEMPLATES_KEY = "quick_templates";

export const DEFAULT_QUICK_TEMPLATES: QuickTemplate[] = [
  { id: "saludo", name: "Saludo", body: "Hola {nombre}, ¿cómo va? Te escribo de {negocio}." },
  { id: "ayuda", name: "¿En qué te ayudo?", body: "¡Hola {nombre}! ¿Cómo estás? Te escribo de {negocio}, ¿en qué te puedo ayudar?" },
  { id: "novedades", name: "Novedades", body: "¡Hola {nombre}! Te escribo de {negocio} porque entraron novedades que te pueden interesar 👀" },
  { id: "cobro", name: "Recordatorio de pago", body: "Hola {nombre}, te paso a recordar que quedó un saldo pendiente. ¡Cualquier cosa avisame!" },
  { id: "postventa", name: "Post-venta", body: "¡Hola {nombre}! Gracias por tu compra en {negocio} 🙌 ¿Cómo va todo?" },
];

export const QUICK_PLACEHOLDER_HELP = [
  { token: "{nombre}", label: "Nombre del cliente" },
  { token: "{negocio}", label: "Nombre del negocio" },
  { token: "{producto}", label: "Producto (si aplica)" },
];

/** Lee la lista guardada del negocio; si nunca se configuró, devuelve los defaults. */
export function parseQuickTemplates(settings: Record<string, string> | null | undefined): QuickTemplate[] {
  const raw = settings?.[QUICK_TEMPLATES_KEY];
  if (!raw || !raw.trim()) return DEFAULT_QUICK_TEMPLATES;
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return DEFAULT_QUICK_TEMPLATES;
    return arr
      .filter((t): t is { id?: unknown; name: unknown; body: unknown } => !!t && typeof t === "object")
      .filter((t) => typeof t.name === "string" && typeof t.body === "string")
      .map((t) => ({
        id: typeof t.id === "string" && t.id ? t.id : crypto.randomUUID(),
        name: t.name as string,
        body: t.body as string,
      }));
  } catch {
    return DEFAULT_QUICK_TEMPLATES;
  }
}

export function serializeQuickTemplates(list: QuickTemplate[]): string {
  return JSON.stringify(list.map((t) => ({ id: t.id, name: t.name, body: t.body })));
}

export function newQuickTemplate(): QuickTemplate {
  return { id: crypto.randomUUID(), name: "", body: "" };
}

export function applyQuickTemplate(
  body: string,
  d: { nombre?: string | null; negocio?: string | null; producto?: string | null },
): string {
  const fb = (v: string | null | undefined, fallback: string) => (v ?? "").trim() || fallback;
  return body
    .replace(/\{nombre\}/g, fb(d.nombre, "—"))
    .replace(/\{negocio\}/g, fb(d.negocio, ""))
    .replace(/\{producto\}/g, fb(d.producto, "el producto"));
}
