---
name: clozr-endpoint
description: Agrega un endpoint REST nuevo a Clozr end-to-end — handler en el Cloudflare Worker (con guard multi-tenant ya puesto), dispatch en index.ts, y el método cliente en clozr-web/src/lib/api.ts con su mapper snake↔camelCase. Usar cuando el usuario quiera "agregar un endpoint", "una ruta nueva al worker", "exponer X en la API" o consumir un recurso nuevo desde la webapp.
---

# clozr-endpoint — agregar un endpoint REST de punta a punta

Clozr tiene el backend en el repo `clozr` (carpeta `cf-worker`) y el frontend en `clozr-web`.
Este skill crea las DOS mitades de un endpoint nuevo siguiendo los patrones reales del proyecto.

## 0. Localizar los repos

- Frontend: el repo actual (`clozr-web`).
- Worker: repo hermano `clozr` → buscá `cf-worker/` en `../clozr/cf-worker` (Windows: la carpeta donde clonaste `clozr`).
- Si no encontrás el worker, **preguntá al usuario la ruta**. No inventes.

## 1. Mitad WORKER (`cf-worker/`)

Patrón de handler (ver `cf-worker/src/routes/customers.ts` como referencia canónica). TODO handler de dominio DEBE tener:

```typescript
export async function handleListNuevo(workspaceId: string, req: Request, env: Env): Promise<Response> {
  await ensureSchema(env);                                   // lazy schema
  const auth = await requireAuth(req, env);                  // JWT → claims
  if (!auth) return json({ error: "unauthorized" }, 401);

  const role = await getMembershipRole(env, workspaceId, auth.userId);  // membership activa
  if (!role || !ROLES_READ.has(role)) return json({ error: "forbidden" }, 403);  // role check

  const [rows] = await tursoQuery(env, {
    sql: `SELECT ... FROM nuevo WHERE workspace_id = ? AND deleted_at IS NULL ...`,
    args: [workspaceId],                                     // SIEMPRE filtrar por workspace_id
  });
  return json({ nuevo: rows ?? [] });
}
```

Reglas no negociables (son el riesgo #1 del proyecto):
- **Toda** query filtra por `workspace_id = ?`.
- Lectura → `ROLES_READ`; escritura → el set de roles correcto (mirá `permissions.ts` y los `ROLES_*` del worker). Si el permiso no existe, usá el skill `clozr-permission` o pedíselo al usuario.
- Soft-delete: filtrar `deleted_at IS NULL` en lecturas; en DELETE setear `deleted_at`, no borrar fila.
- Whitelist de campos editables en PATCH (ver cómo `customers.ts` limita columnas).

Dispatch en `cf-worker/src/index.ts` (patrón regex match → método):
```typescript
const wsNuevoMatch = url.pathname.match(/^\/workspaces\/([^/]+)\/nuevo(?:\/([^/]+))?\/?$/);
if (wsNuevoMatch) {
  const wsId = wsNuevoMatch[1]!;
  const nId = wsNuevoMatch[2];
  if (!nId && req.method === "GET")    return cors(req, env, await handleListNuevo(wsId, req, env));
  if (!nId && req.method === "POST")   return cors(req, env, await handleCreateNuevo(wsId, req, env));
  if (nId && req.method === "PATCH")   return cors(req, env, await handleUpdateNuevo(wsId, nId, req, env));
  if (nId && req.method === "DELETE")  return cors(req, env, await handleDeleteNuevo(wsId, nId, req, env));
}
```
- Agregá el `import` del handler al head de `index.ts`.
- Si la tabla es simple, evaluá usar el dispatcher `cf-worker/src/routes/_generic.ts` en vez de un archivo nuevo.
- Si la tabla no existe en `src/lib/db/ensureSchema.ts`, agregala ahí (CREATE TABLE IF NOT EXISTS, idempotente — el schema solo crece).

## 2. Mitad FRONTEND (`clozr-web/src/lib/api.ts`)

- Definí el tipo de dominio (camelCase) en `src/lib/types.ts`.
- Agregá un `RawX` interface (shape snake_case del worker) + función `mapX(r: RawX): X` en `api.ts`.
- Agregá el método cliente usando el helper de fetch existente y `ws()` para el workspace id:
```typescript
export async function listNuevo(): Promise<Nuevo[]> {
  const data = await apiGet(`/workspaces/${ws()}/nuevo`);
  return (data.nuevo ?? []).map(mapNuevo);
}
```
- Respetá el shape real de respuestas: GET suele devolver `{ recurso: [...] }`, POST `{ ok, id }`.

## 3. Cerrar

- Recordá: Next 16 tiene breaking changes — si tocás server components/params, leé `node_modules/next/dist/docs/` (lo pide `AGENTS.md`).
- Antes de deployar el worker, corré el skill **clozr-multitenant-audit** sobre el handler nuevo.
- El front auto-deploya por push a Vercel; el worker NO — hay que `wrangler deploy` (skill **clozr-release**).
- No agregues manejo de errores redundante: el front ya maneja errores de fetch de forma centralizada.
