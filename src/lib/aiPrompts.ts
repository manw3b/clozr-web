/**
 * Prompts sugeridos del Asistente, según la pantalla en la que estás. Son los
 * ejemplos que aparecen en el chat cuando todavía no escribiste nada: cambian
 * con el contexto para que el primer mensaje sea más útil (en Deudas te ofrece
 * cobrar; en Inventario, ver el stock; etc.).
 *
 * Es solo presentación (texto que prellena el input); cuando el Worker tenga las
 * tools, estos prompts disparan respuestas con datos reales.
 */

/** Genéricos: para pantallas sin sugerencias propias. */
const DEFAULT_PROMPTS = [
  "¿Cuánto vendí este mes?",
  "Armame un WhatsApp para reactivar un cliente",
  "¿Qué productos tengo sin stock?",
];

/** Las claves son los `View` de Crm.tsx (home, sales, deudas, …). */
const BY_VIEW: Record<string, string[]> = {
  home: [
    "¿Cómo viene el día?",
    "¿Qué tengo que hacer hoy?",
    "¿Cuánto vendí esta semana?",
  ],
  sales: [
    "¿Cuánto vendí este mes?",
    "¿Cuál fue mi mejor día de ventas?",
    "Armame el resumen de ventas de la semana",
  ],
  deudas: [
    "¿Quién me debe plata?",
    "¿A quién le cobro hoy?",
    "Armame un WhatsApp para reclamar una deuda",
  ],
  inventory: [
    "¿Qué productos tengo sin stock?",
    "¿Qué tengo con stock bajo?",
    "¿Qué es lo que más se vende?",
  ],
  customers: [
    "¿Qué clientes no me compran hace rato?",
    "Armame un WhatsApp para reactivar un cliente",
    "¿Quién es mi mejor cliente?",
  ],
  cash: [
    "¿Cómo está la caja hoy?",
    "¿Cuánto tengo en dólares?",
    "Resumime los movimientos de hoy",
  ],
  repairs: [
    "¿Qué reparaciones están listas para entregar?",
    "¿Qué equipos tengo en el taller?",
    "Armame el aviso de que el equipo está listo",
  ],
  agenda: [
    "¿Qué turnos tengo hoy?",
    "¿Qué tengo agendado esta semana?",
    "Agendame un turno",
  ],
  pipeline: [
    "¿Qué oportunidades tengo abiertas?",
    "¿Qué leads tengo que seguir?",
    "¿Cuánto tengo por cerrar este mes?",
  ],
  reportes: [
    "¿Cuál es mi margen este mes?",
    "Comparame este mes con el anterior",
    "¿Cómo viene el negocio?",
  ],
};

/** Devuelve los ejemplos para la pantalla actual (o los genéricos). */
export function examplesForView(view?: string | null): string[] {
  return (view && BY_VIEW[view]) || DEFAULT_PROMPTS;
}
