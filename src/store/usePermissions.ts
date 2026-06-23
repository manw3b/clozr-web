import { useEffect } from "react";
import { useWorkspaceStore } from "./workspaceStore";
import { useRolePermsStore } from "./rolePermsStore";
import { can as canFor, normalizeRole, type Permission } from "../lib/permissions";

/**
 * Hook de permisos del workspace activo. Lee el rol del store y devuelve
 * `can(perm)` listo para usar en las vistas (ocultar/deshabilitar acciones).
 *
 * Fase ⑤: si el negocio personalizó los permisos por rol, `can()` respeta ese
 * override (cargado desde el Worker); si no, cae a los defaults. El Worker es
 * la autoridad real — esto solo alinea la UI.
 *
 *   const { can } = usePermissions();
 *   {can("customers.write") && <Button …/>}
 */
export function usePermissions() {
  const rawRole = useWorkspaceStore((s) => s.activeWorkspace?.role);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspace?.id);
  const role = normalizeRole(rawRole);

  const matrix = useRolePermsStore((s) => s.matrix);
  const matrixWsId = useRolePermsStore((s) => s.workspaceId);
  const load = useRolePermsStore((s) => s.load);

  useEffect(() => {
    if (workspaceId) load(workspaceId);
  }, [workspaceId, load]);

  const override = matrix && matrixWsId === workspaceId ? matrix[role] : null;

  return {
    role,
    can: (perm: Permission) => (override ? override.includes(perm) : canFor(rawRole, perm)),
  };
}
