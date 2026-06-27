/**
 * Plantillas de turno (Fase ①) — generan dos mensajes desde una venta:
 *  - cliente:  confirmación de turno (Nombre / Equipo / Día / Horario / Viene de / dirección)
 *  - interno:  "anúnciate con el código" + pedido + USD/ARS + vuelto
 *
 * Portado de la app desktop (src/lib/visitTemplates.ts), adaptado a ventas:
 * el origen de datos es la venta (no un lead), y se suman {viene_de}, {usd}, {ars}.
 * Los textos de acá son los DEFAULTS; en la Fase ② serán editables por negocio.
 *
 * Placeholders:
 *   {nombre}     cliente            {dia}     "Miércoles 3"
 *   {equipo}     ítems c/ precio    {hora}    "14:00"
 *   {pedido}     ítems sin precio   {direccion} dirección del local
 *   {codigo}     código de la venta {viene_de}  origen ("MobileZone")
 *   {usd}        total en USD       {negocio}   nombre del negocio
 *   {ars}        total en ARS ("$ 1.002.000")
 */

import { formatMoney } from "./format";
import { saleCode, type SaleDetail, type Workspace } from "./types";

export const DEFAULT_TURNO_CLIENTE = `Nombre: {nombre}
Equipo: {equipo}

Día: {dia}
Horario: {hora}
Viene de: {viene_de}

Estamos en {direccion} (Por favor respetar el turno asignado).`;

export const DEFAULT_TURNO_INTERNO = `ANÚNCIATE CON EL CÓDIGO:
{codigo}

PEDIDO:
{equipo}

TOTAL: {usd}
PAGA:
VUELTO:

🏢 Nuestra oficina se encuentra en {direccion}.`;

/** Claves en workspace_settings (Fase ②) para las plantillas editables. */
export const TURNO_TEMPLATE_KEYS = {
  cliente: "turno_template_cliente",
  interno: "turno_template_interno",
} as const;

/** Plantilla guardada por el negocio (si hay texto) o el default. */
export function resolveTurnoTemplate(
  kind: "cliente" | "interno",
  settings: Record<string, string> | null | undefined,
): string {
  const key = kind === "cliente" ? TURNO_TEMPLATE_KEYS.cliente : TURNO_TEMPLATE_KEYS.interno;
  const saved = settings?.[key];
  if (saved && saved.trim()) return saved;
  return kind === "cliente" ? DEFAULT_TURNO_CLIENTE : DEFAULT_TURNO_INTERNO;
}

export const TURNO_PLACEHOLDER_HELP = [
  { token: "{nombre}", label: "Nombre del cliente" },
  { token: "{equipo}", label: "Ítems con precio (USD)" },
  { token: "{pedido}", label: "Ítems sin precio" },
  { token: "{dia}", label: 'Día ("Miércoles 3")' },
  { token: "{hora}", label: 'Horario ("14:00")' },
  { token: "{viene_de}", label: "Origen del cliente" },
  { token: "{direccion}", label: "Dirección del local" },
  { token: "{codigo}", label: "Código del turno (ej: P27F1)" },
  { token: "{usd}", label: "Total en USD" },
  { token: "{ars}", label: "Total en ARS" },
  { token: "{negocio}", label: "Nombre del negocio" },
];

/**
 * Explicación del código de turno {codigo} para mostrar en Ajustes.
 * Formato: inicial de quien toma el turno + día + letra del mes + orden del día.
 */
export const TURNO_CODE_HELP =
  "El {codigo} del turno se arma solo: inicial de quien lo toma · día · letra del mes (A=enero, B=febrero … L=diciembre) · número de orden del día. " +
  "Ej: P27F1 = Pyter, 27 de junio (F), 1er turno de ese día.";

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function parseLooseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  // Acepta "2026-07-03T14:00" y "2026-07-03 14:00" (wall-clock local).
  const norm = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(norm);
  return isNaN(d.getTime()) ? null : d;
}

/** ISO/wall-clock → "Miércoles 3". "" si no hay fecha. */
export function formatTurnoDay(iso: string | null | undefined): string {
  const d = parseLooseDate(iso);
  if (!d) return "";
  return `${DAYS_ES[d.getDay()] ?? ""} ${d.getDate()}`.trim();
}

/** ISO/wall-clock → "14:00". "" si no hay fecha. */
export function formatTurnoTime(iso: string | null | undefined): string {
  const d = parseLooseDate(iso);
  if (!d) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export interface TurnoData {
  nombre?: string | null;
  equipo?: string | null;
  pedido?: string | null;
  dia?: string | null;
  hora?: string | null;
  vieneDe?: string | null;
  direccion?: string | null;
  codigo?: string | null;
  usd?: string | null;
  ars?: string | null;
  negocio?: string | null;
}

export function applyTurnoTemplate(body: string, d: TurnoData): string {
  const fb = (v: string | null | undefined, fallback: string) => (v ?? "").trim() || fallback;
  return body
    .replace(/\{nombre\}/g, fb(d.nombre, "—"))
    .replace(/\{equipo\}/g, fb(d.equipo, fb(d.pedido, "—")))
    .replace(/\{pedido\}/g, fb(d.pedido, fb(d.equipo, "—")))
    .replace(/\{dia\}/g, fb(d.dia, "—"))
    .replace(/\{hora\}/g, fb(d.hora, "—"))
    .replace(/\{viene_de\}/g, fb(d.vieneDe, "—"))
    .replace(/\{direccion\}/g, fb(d.direccion, ""))
    .replace(/\{codigo\}/g, fb(d.codigo, "—"))
    .replace(/\{usd\}/g, fb(d.usd, "—"))
    .replace(/\{ars\}/g, fb(d.ars, "—"))
    .replace(/\{negocio\}/g, fb(d.negocio, ""));
}

/**
 * Variables del turno cuando NO viene de una venta (Fase ④, turno standalone).
 * El "asunto" (tipo + notas) va en {equipo}/{pedido} para dar contexto; los
 * campos de venta (código/usd/ars) quedan vacíos.
 */
export function buildTurnoDataFromAppointment(
  appt: { customerName?: string | null; appointmentAt?: string | null; origin?: string | null; type?: string | null; product?: string | null; notes?: string | null; codigo?: string | null },
  workspace: { name?: string; address?: string | null } | null,
): TurnoData {
  const asunto = [appt.type, appt.notes].map((s) => (s ?? "").trim()).filter(Boolean).join(" — ");
  const producto = (appt.product ?? "").trim();
  return {
    nombre: appt.customerName ?? "",
    // {equipo}: el producto/equipo que viene a ver; si no se cargó, caemos al asunto (tipo — notas).
    equipo: producto || asunto,
    pedido: asunto || producto,
    dia: formatTurnoDay(appt.appointmentAt),
    hora: formatTurnoTime(appt.appointmentAt),
    vieneDe: appt.origin ?? "",
    direccion: workspace?.address ?? "",
    codigo: appt.codigo ?? "",
    usd: "",
    ars: "",
    negocio: workspace?.name ?? "",
  };
}

/** Datos de muestra para previsualizar plantillas en el editor (Ajustes). */
export const TURNO_SAMPLE: TurnoData = {
  nombre: "Juan Manuel",
  equipo: "iPhone 17 Black 810 USD y cargador 35 USD",
  pedido: "iPhone 17 Black, cargador",
  dia: "Miércoles 3",
  hora: "14:00",
  vieneDe: "MobileZone",
  direccion: "calle 44 e/ 17 y 18 Nº 1136 (Timbre 101)",
  codigo: "P27F1",
  usd: "845",
  ars: "$ 1.235.000",
  negocio: "Mi Negocio",
};

/** Prefijo de cantidad solo cuando qty != 1 (ej "2x "). */
function qtyPrefix(qty: number): string {
  return qty && qty !== 1 ? `${qty}x ` : "";
}

/**
 * Arma las variables del turno desde la venta + workspace + cotización blue.
 * `appointmentAt`/`origin` se pasan aparte para poder previsualizar valores que
 * el usuario está editando en el diálogo antes de guardarlos en la venta.
 */
export function buildTurnoData(
  sale: SaleDetail,
  workspace: { name?: string; address?: string | null } | null,
  blue: number | null,
  override?: { appointmentAt?: string | null; origin?: string | null; codigo?: string | null },
): TurnoData {
  const appointmentAt = override?.appointmentAt ?? sale.appointmentAt ?? null;
  const origin = override?.origin ?? sale.origin ?? null;

  const items = sale.items ?? [];
  // {equipo}: con precio en USD por línea (si hay blue); ej "iPhone 17 810 USD y cargador 35 USD".
  const equipo = items
    .map((it) => {
      const desc = `${qtyPrefix(it.quantity ?? 1)}${it.description}`.trim();
      const usd = blue && blue > 0 ? Math.round((it.subtotal ?? 0) / blue) : null;
      return usd ? `${desc} ${usd} USD` : desc;
    })
    .join(" y ");
  // {pedido}: solo descripciones (mensaje interno).
  const pedido = items.map((it) => `${qtyPrefix(it.quantity ?? 1)}${it.description}`.trim()).join(", ");

  const usd = blue && blue > 0 ? String(Math.round((sale.total ?? 0) / blue)) : "";

  return {
    nombre: sale.customerName,
    equipo,
    pedido,
    dia: formatTurnoDay(appointmentAt),
    hora: formatTurnoTime(appointmentAt),
    vieneDe: origin,
    direccion: workspace?.address ?? "",
    // En turnos usamos el código del turno (P27F1); si no se pasa, caemos al código de venta.
    codigo: override?.codigo ?? saleCode(sale),
    usd,
    ars: formatMoney(sale.total ?? 0, "ARS"),
    negocio: workspace?.name ?? "",
  };
}
