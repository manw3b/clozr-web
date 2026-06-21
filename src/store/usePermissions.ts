import { useWorkspaceStore } from "./workspaceStore";
import { can as canFor, normalizeRole, type Permission } from "../lib/permissions";

/**
 * Hook de permisos del workspace activo. Lee el rol del store y devuelve
 * `can(perm)` listo para usar en las vistas (ocultar/deshabilitar acciones).
 *
 *   const { can } = usePermissions();
 *   {can("customers.write") && <Button …/>}
 */
export function usePermissions() {
  const rawRole = useWorkspaceStore((s) => s.activeWorkspace?.role);
  const role = normalizeRole(rawRole);
  return {
    role,
    can: (perm: Permission) => canFor(rawRole, perm),
  };
}
