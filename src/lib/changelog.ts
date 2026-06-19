/**
 * Changelog de la webapp para el modal "¿Qué hay de nuevo?".
 * El desktop lo trae de los releases de GitHub; en la web lo mantenemos
 * estático acá (se actualiza al shippear features). El modal muestra la
 * entrada más reciente una vez por `version` (localStorage).
 */

export type ChangeTone = "feat" | "ux" | "fix" | "perf";

export interface ChangelogEntry {
  /** Id estable de la entrega (no es semver; un id por release). */
  version: string;
  /** Fecha legible (ISO o texto). */
  date: string;
  bullets: { tone: ChangeTone; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2026-06-19-roles",
    date: "19 de junio de 2026",
    bullets: [
      { tone: "feat", text: "Roles que ahora sí mandan: cada persona del equipo ve y puede hacer según su rol. El Encargado opera y configura, el Vendedor vende y gestiona su día, y Solo lectura ve todo sin tocar nada." },
      { tone: "fix", text: "Solo lectura ya no puede crear, editar ni borrar (antes podía sin querer). Los botones de acción aparecen únicamente para quien tiene permiso." },
      { tone: "ux", text: "El menú lateral se adapta al rol: Reportes y Equipo solo le aparecen a quien corresponde." },
    ],
  },
  {
    version: "2026-06-18-ajustes",
    date: "18 de junio de 2026",
    bullets: [
      { tone: "feat", text: "Ajustes más completo: subí el logo de tu negocio (aparece arriba), fijá tu objetivo de ventas del día, y configurá tipos de cliente, etiquetas y las etapas de tu pipeline." },
      { tone: "feat", text: "Equipos: creá y cambiá de espacio de trabajo desde el menú de arriba, e invitá a tu equipo con roles desde la sección Equipo." },
      { tone: "fix", text: "Métodos de pago: se limpiaron los duplicados que aparecían repetidos." },
    ],
  },
  {
    version: "2026-06-18",
    date: "18 de junio de 2026",
    bullets: [
      { tone: "feat", text: "Precios por tipo de cliente: cargá en cada producto un precio para final, revendedor, mayorista y empresa. Al vender, el precio se sugiere solo según el tipo del cliente elegido." },
      { tone: "feat", text: "IMEI / N° de serie por ítem en la venta — queda guardado y se ve en el detalle de la venta." },
      { tone: "ux", text: "El margen de Reportes ahora congela el costo al momento de cada venta: editar el costo de un producto ya no cambia el margen de las ventas pasadas." },
    ],
  },
  {
    version: "2026-06-17",
    date: "17 de junio de 2026",
    bullets: [
      { tone: "feat", text: "Al cargar una venta ahora elegís el producto del catálogo desde un buscador con foto, precio y costo — el ítem queda linkeado y el precio se autocompleta." },
      { tone: "feat", text: "Cada ítem muestra si está linkeado (con su margen %) o si quedó como texto libre, y el total te avisa cuánto facturás sin costo asignado antes de guardar." },
      { tone: "ux", text: "Al convertir una oportunidad en venta, los productos se linkean solos si coinciden con el catálogo. Así el margen de Reportes sale exacto." },
    ],
  },
  {
    version: "2026-06-16",
    date: "16 de junio de 2026",
    bullets: [
      { tone: "feat", text: "Caja con sesión: abrí y cerrá la caja del día con arqueo — contás la plata física y ves la diferencia con el sistema, por moneda." },
      { tone: "feat", text: "Reportes v2: margen (ganancia) y productos más vendidos. Linkeá la venta a un producto del catálogo y el margen sale exacto." },
      { tone: "feat", text: "Mi Día más completo: objetivo del día con barra de progreso, score, seguimientos pendientes y clientes en riesgo." },
      { tone: "feat", text: "Inventario con picker visual: cargá productos eligiendo modelo, color y almacenamiento — con las fotos reales." },
      { tone: "feat", text: "Importá clientes desde CSV/Excel o desde los contactos del celular (vCard)." },
      { tone: "ux", text: "Pipeline a fondo: convertí una oportunidad en venta, acciones rápidas (WhatsApp/llamar) y menú con click derecho." },
      { tone: "ux", text: "Atajos de teclado (apretá ?), deshacer en los borrados, y este mismo aviso de novedades." },
    ],
  },
];

export const LATEST_VERSION = CHANGELOG[0]?.version ?? "";
