/**
 * Modelo de permisos por rol — fuente única de verdad de "quién puede hacer
 * qué". Reemplaza los chequeos ad-hoc (`canManage = owner || admin`) que
 * estaban copiados sueltos en Equipo y Ajustes, y que NO existían en las
 * vistas operativas (por eso "Solo lectura" podía editar todo).
 *
 * Alcance: esto define permisos de ACCIÓN. El alcance de DATOS del vendedor
 * ("ve solo lo suyo") es ortogonal y se filtra server-side en el Worker por
 * `owner_id` — no se resuelve acá.
 */

export type Role = "owner" | "admin" | "vendedor" | "viewer";

export type Permission =
  | "customers.write"
  | "sales.write"
  | "pipeline.write"
  | "cash.write"
  | "inventory.write"
  | "tasks.write"
  | "reports.view"
  | "settings.manage"
  | "team.manage"
  | "billing.manage"
  | "workspace.delete";

const OPERATE: Permission[] = [
  "customers.write",
  "sales.write",
  "pipeline.write",
  "cash.write",
  "tasks.write",
];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
    ...OPERATE,
    "inventory.write",
    "reports.view",
    "settings.manage",
    "team.manage",
    "billing.manage",
    "workspace.delete",
  ],
  admin: [
    ...OPERATE,
    "inventory.write",
    "reports.view",
    "settings.manage",
    "team.manage",
  ],
  // El vendedor opera el día a día pero no configura el espacio ni ve los
  // números globales del negocio (sus propios números viven en Mi Día).
  vendedor: [...OPERATE],
  // Solo lectura: ve todo, no escribe nada.
  viewer: [],
};

/** Normaliza un rol crudo del Worker; lo desconocido cae a `viewer` (seguro). */
export function normalizeRole(role: string | null | undefined): Role {
  return role === "owner" || role === "admin" || role === "vendedor" || role === "viewer"
    ? role
    : "viewer";
}

/** ¿El rol tiene el permiso? Acepta el `role` crudo del workspace activo. */
export function can(role: string | null | undefined, perm: Permission): boolean {
  return ROLE_PERMISSIONS[normalizeRole(role)].includes(perm);
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Dueño",
  admin: "Encargado",
  vendedor: "Vendedor",
  viewer: "Solo lectura",
};

/** Etiqueta legible de un rol crudo del Worker (lo desconocido cae a viewer). */
export function roleLabel(role: string | null | undefined): string {
  return ROLE_LABELS[normalizeRole(role)];
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Control total, incluye facturación y eliminar el espacio.",
  admin: "Opera y configura todo, menos la facturación.",
  vendedor: "Vende y gestiona sus clientes; no configura el espacio.",
  viewer: "Ve la información pero no puede editar.",
};
