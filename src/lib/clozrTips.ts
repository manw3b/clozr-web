/**
 * Pool de tips para el modal "¿Sabías que…?". Adaptado del desktop a las
 * features que existen en la web (CTAs apuntan a las vistas de la webapp).
 * Idioma: rioplatense informal.
 */

/** Vistas a las que un tip puede navegar (ids del router de Crm). */
export type TipScreen =
  | "home" | "cash" | "customers" | "pipeline" | "sales" | "tasks" | "inventory" | "team" | "settings" | "reportes";

export interface FeatureTip {
  id: string;
  emoji: string;
  title: string;
  body: string;
  cta?: { label: string; screen: TipScreen };
}

export const FEATURE_TIPS: FeatureTip[] = [
  {
    id: "ctrl-k",
    emoji: "⌘",
    title: "Búsqueda rápida con ⌘K",
    body: "En cualquier pantalla apretá ⌘K (o Ctrl+K) y saltás directo a un cliente, venta o lead sin clickear menúes.",
  },
  {
    id: "shortcuts",
    emoji: "⌨️",
    title: "Atajos de teclado",
    body: "Apretá ? para ver todos los atajos. Los números 1-9 navegan entre pantallas y V/C/M/T abren nueva venta, cliente, movimiento o tarea.",
  },
  {
    id: "context-menu",
    emoji: "🖱️",
    title: "Click derecho = atajos",
    body: "Click derecho sobre un lead, venta, cliente o producto te abre acciones rápidas: convertir, mover de etapa, WhatsApp, eliminar y más.",
  },
  {
    id: "undo",
    emoji: "↩️",
    title: "Te equivocaste? Deshacé",
    body: "Cuando borrás algo aparece un toast con 'Deshacer' por unos segundos. Si fue sin querer, lo recuperás al instante.",
  },
  {
    id: "cash-close",
    emoji: "🧾",
    title: "Cierre de caja con conteo físico",
    body: "Abrí la caja del día y al cerrarla contá la plata billete por billete — Clozr te muestra la diferencia con el sistema, por moneda.",
    cta: { label: "Ir a caja", screen: "cash" },
  },
  {
    id: "convert-sale",
    emoji: "💰",
    title: "Convertí oportunidades en ventas",
    body: "Desde el pipeline, tocá el $ de una tarjeta (o click derecho → Convertir) y se arma la venta con el cliente y el producto ya cargados.",
    cta: { label: "Ir al pipeline", screen: "pipeline" },
  },
  {
    id: "visual-picker",
    emoji: "📲",
    title: "Cargá productos con fotos",
    body: "En Inventario → Agregar producto elegís categoría, modelo, color y almacenamiento de un catálogo Apple con fotos. Mucho más rápido que tipear.",
    cta: { label: "Ir a inventario", screen: "inventory" },
  },
  {
    id: "import-clients",
    emoji: "📇",
    title: "Importá tu cartera de clientes",
    body: "En Clientes → Importar subís un CSV/Excel o un archivo de contactos (.vcf) del celular. Mapea las columnas solo y saltea duplicados.",
    cta: { label: "Ir a clientes", screen: "customers" },
  },
  {
    id: "daily-goal",
    emoji: "🎯",
    title: "Objetivo del día",
    body: "Configurá un objetivo de facturación y se muestra como barra de progreso en Mi Día, con un score de tus hábitos del día.",
    cta: { label: "Ir a Mi Día", screen: "home" },
  },
  {
    id: "inactive-clients",
    emoji: "🔥",
    title: "Recuperá clientes dormidos",
    body: "En Mi Día aparecen los clientes sin contacto hace tiempo. Tocá WhatsApp o Llamar y queda registrado el contacto automáticamente.",
    cta: { label: "Ir a Mi Día", screen: "home" },
  },
  {
    id: "margin",
    emoji: "📊",
    title: "Mirá tu margen real",
    body: "En Reportes ves la ganancia y los productos más vendidos. Cargá el costo en el catálogo y linkeá la venta al producto para el margen exacto.",
    cta: { label: "Ir a reportes", screen: "reportes" },
  },
  {
    id: "dollar-quote",
    emoji: "🇦🇷",
    title: "El dólar al lado del buscador",
    body: "Arriba a la derecha tenés el chip del dólar (oficial, blue, MEP, CCL). Se actualiza solo desde dolarapi.",
  },
  {
    id: "team-cloud",
    emoji: "☁️",
    title: "Trabajá en equipo",
    body: "Invitá miembros desde Equipo y cada uno ve los cambios del resto. Todo sincroniza por tu cuenta en la nube.",
    cta: { label: "Ir a equipo", screen: "team" },
  },
];

/** Elige un tip al azar no visto recientemente. */
export function pickFeatureTip(seenIds: string[]): FeatureTip {
  const unseen = FEATURE_TIPS.filter((t) => !seenIds.includes(t.id));
  if (unseen.length > 0) {
    const i = Math.floor(Math.random() * unseen.length);
    return unseen[i]!;
  }
  const lastId = seenIds[seenIds.length - 1];
  const pool = FEATURE_TIPS.filter((t) => t.id !== lastId);
  const i = Math.floor(Math.random() * pool.length);
  return pool[i] ?? FEATURE_TIPS[0]!;
}
