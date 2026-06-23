/**
 * Catálogo de bloques del home "Mi Día" (Fase ⑧ — home por rol configurable).
 *
 * Cada rol del workspace ve un home distinto, armado a partir de estos bloques.
 * El dueño puede configurar qué bloques ve cada rol (se guarda en el Worker, key
 * `home_layouts`); si un rol no tiene config, se usa su default de acá.
 *
 * `scope: "global"` = el bloque muestra datos de TODO el negocio (ranking, caja,
 * stock, cobros…). Como el vendedor está scopeado server-side a lo suyo, esos
 * bloques se le ocultan aunque alguien los active para su rol.
 */

import type { Role } from "./permissions";

export type HomeBlockKey =
  | "hero-personal"
  | "hero-team"
  | "hero-business"
  | "foco"
  | "ranking"
  | "my-tasks"
  | "team-tasks"
  | "my-appointments"
  | "team-appointments"
  | "agenda-summary"
  | "followups"
  | "new-customers"
  | "customers-risk"
  | "collections"
  | "cash-today"
  | "low-stock";

export type HomeSection = "Personal" | "Equipo" | "Negocio";

export interface HomeBlockMeta {
  key: HomeBlockKey;
  label: string;
  description: string;
  /** Los bloques "hero" se renderizan a ancho completo arriba de todo. */
  hero?: boolean;
  /** "global" requiere ver datos de todo el negocio (se oculta al vendedor). */
  scope: "personal" | "global";
  section: HomeSection;
  /** Roles built-in que incluyen el bloque por defecto. */
  defaultRoles: Role[];
}

/** Orden de render (heroes primero, luego foco, luego tarjetas). */
export const HOME_BLOCKS: HomeBlockMeta[] = [
  { key: "hero-personal", label: "Mi objetivo y score", description: "Saludo, objetivo del día, score y racha (gamificado).", hero: true, scope: "personal", section: "Personal", defaultRoles: ["vendedor"] },
  { key: "hero-team", label: "Objetivo del equipo", description: "Progreso del día del negocio y cumplimiento del equipo.", hero: true, scope: "global", section: "Equipo", defaultRoles: ["admin"] },
  { key: "hero-business", label: "Métricas del negocio", description: "Ventas hoy/mes, ticket promedio y proyección.", hero: true, scope: "global", section: "Negocio", defaultRoles: ["owner", "viewer"] },

  { key: "foco", label: "Foco del día", description: "La acción más importante de hoy.", scope: "personal", section: "Personal", defaultRoles: ["vendedor", "admin"] },

  { key: "my-appointments", label: "Mis turnos de hoy", description: "Tus turnos del día.", scope: "personal", section: "Personal", defaultRoles: ["vendedor"] },
  { key: "team-appointments", label: "Turnos del equipo", description: "Agenda del día de todo el equipo.", scope: "global", section: "Equipo", defaultRoles: ["admin"] },
  { key: "agenda-summary", label: "Resumen de agenda", description: "Turnos del día del negocio, resumido.", scope: "global", section: "Negocio", defaultRoles: ["owner", "viewer"] },

  { key: "my-tasks", label: "Mis tareas", description: "Tareas asignadas a mí (o sin asignar).", scope: "personal", section: "Personal", defaultRoles: ["vendedor"] },
  { key: "team-tasks", label: "Tareas del equipo", description: "Tareas de todos, con su responsable.", scope: "global", section: "Equipo", defaultRoles: ["admin"] },

  { key: "followups", label: "Seguimientos", description: "Leads que requieren acción.", scope: "personal", section: "Personal", defaultRoles: ["vendedor"] },
  { key: "ranking", label: "Ranking de vendedores", description: "Quién vendió cuánto hoy.", scope: "global", section: "Equipo", defaultRoles: ["admin"] },
  { key: "collections", label: "Por cobrar", description: "Cobros pendientes del negocio.", scope: "global", section: "Negocio", defaultRoles: ["admin", "owner", "viewer"] },

  { key: "new-customers", label: "Clientes nuevos", description: "Clientes cargados en los últimos días.", scope: "personal", section: "Personal", defaultRoles: ["vendedor"] },
  { key: "customers-risk", label: "Clientes en riesgo", description: "Clientes sin contacto reciente.", scope: "personal", section: "Personal", defaultRoles: ["vendedor", "admin"] },
  { key: "cash-today", label: "Caja del día", description: "Movimientos y saldo de caja de hoy.", scope: "global", section: "Negocio", defaultRoles: ["owner", "viewer"] },
  { key: "low-stock", label: "Stock bajo", description: "Productos por debajo del mínimo.", scope: "global", section: "Negocio", defaultRoles: ["owner", "viewer"] },
];

export const HOME_BLOCK_BY_KEY: Record<HomeBlockKey, HomeBlockMeta> = Object.fromEntries(
  HOME_BLOCKS.map((b) => [b.key, b]),
) as Record<HomeBlockKey, HomeBlockMeta>;

export const ALL_HOME_BLOCK_KEYS: HomeBlockKey[] = HOME_BLOCKS.map((b) => b.key);

export const HOME_SECTIONS: HomeSection[] = ["Personal", "Equipo", "Negocio"];

const BUILTIN_ROLES = new Set(["owner", "admin", "vendedor", "viewer"]);

/** Bloques por defecto de un rol (rol custom → baseline "encargado", ve el negocio). */
export function defaultBlocksFor(role: string): HomeBlockKey[] {
  const key = (BUILTIN_ROLES.has(role) ? role : "admin") as Role;
  return HOME_BLOCKS.filter((b) => b.defaultRoles.includes(key)).map((b) => b.key);
}

/**
 * Bloques efectivos a renderizar para un rol: la config guardada si existe (y no
 * está vacía), si no el default. Siempre en el orden del catálogo, y ocultando
 * los bloques globales cuando el rol es vendedor (solo ve lo suyo).
 */
export function resolveHomeBlocks(
  role: string,
  layouts: Record<string, string[]> | null | undefined,
): HomeBlockKey[] {
  const stored = layouts?.[role];
  const chosen = stored && stored.length ? stored : defaultBlocksFor(role);
  const set = new Set(chosen);
  const isVendedor = role === "vendedor";
  return HOME_BLOCKS
    .filter((b) => set.has(b.key))
    .filter((b) => !(b.scope === "global" && isVendedor))
    .map((b) => b.key);
}
