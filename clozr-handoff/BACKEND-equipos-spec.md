# Backend (cf-worker) — plan de equipos: spec listo para aplicar

> **Contexto:** el Worker vive en `manw3b/clozr` → carpeta `cf-worker/` (NO en
> `clozr-desktop` ni `clozr-web`). En esta sesión no estaba autorizado, así que
> el frontend ya quedó hecho y acá está el backend **diseñado para copiar/pegar**.
> Aplicar en orden. Cada tarea bumpea el SCHEMA y deploya con `wrangler deploy`.
>
> Estado del frontend (ya en `clozr-web`, branch `claude/status-update-074mjx`):
> - Permisos de acción por rol: `src/lib/permissions.ts` (`can(role, perm)`),
>   aplicados en todas las vistas + modales en modo lectura.
> - Decisiones de producto: cobro **Mercado Pago (ARS)**; plan **Free = 1 usuario**;
>   **Vendedor ve solo lo suyo**.

---

## Tarea 1 — Enforcement server-side de permisos (defensa real)

Hoy los handlers validan **membresía** (`getMembershipRole`) pero no el **permiso
por acción**. Un cliente malicioso (o un bug de UI) puede mandar un PATCH/POST/DELETE
igual. Hay que rechazar por rol en el server.

**1.1** Portar la matriz de permisos del front. Crear `cf-worker/src/permissions.ts`
espejo EXACTO de `clozr-web/src/lib/permissions.ts`:

```ts
export type Role = "owner" | "admin" | "vendedor" | "viewer";
export type Permission =
  | "customers.write" | "sales.write" | "pipeline.write" | "cash.write"
  | "inventory.write" | "tasks.write" | "reports.view"
  | "settings.manage" | "team.manage" | "billing.manage" | "workspace.delete";

const OPERATE: Permission[] = ["customers.write","sales.write","pipeline.write","cash.write","tasks.write"];
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [...OPERATE,"inventory.write","reports.view","settings.manage","team.manage","billing.manage","workspace.delete"],
  admin: [...OPERATE,"inventory.write","reports.view","settings.manage","team.manage"],
  vendedor: [...OPERATE],
  viewer: [],
};
function normalizeRole(r?: string|null): Role { return r==="owner"||r==="admin"||r==="vendedor"||r==="viewer" ? r : "viewer"; }
export function can(role: string|null|undefined, p: Permission){ return ROLE_PERMISSIONS[normalizeRole(role)].includes(p); }
```

**1.2** Helper de guardia tras resolver la membresía:

```ts
function requirePerm(role: string, perm: Permission): Response | null {
  return can(role, perm) ? null : json({ error: "forbidden" }, 403);
}
```

**1.3** Aplicar en cada ruta de escritura (el GET de cada recurso queda libre salvo
Reportes y Tarea 2). Mapa ruta → permiso:

| Método + ruta (bajo `/workspaces/:wid`) | Permiso |
|---|---|
| `POST/PATCH/DELETE /customers*` | `customers.write` |
| `POST/PATCH/DELETE /sales*`, `/sales/:id/payments` | `sales.write` |
| `POST/PATCH/DELETE /pipeline/items*` | `pipeline.write` |
| `POST/PATCH/DELETE /pipeline/stages*` | `settings.manage` |
| `POST/PATCH/DELETE /cash*` | `cash.write` |
| `POST/PATCH/DELETE /catalog*`, `/catalog-prices` | `inventory.write` |
| `POST/PATCH/DELETE /tasks*` | `tasks.write` |
| `GET /sale-items`, `GET /reports*` (si existe) | `reports.view` |
| `PATCH /workspaces/:wid` (ajustes/objetivo/logo) | `settings.manage` |
| `POST /invite`, `PATCH/DELETE /members/:id`, `/members/:id/access-code` | `team.manage` |

> Nota: `team.manage` ya tiene reglas finas (no auto-modificarse, ≥1 owner, solo
> owner promueve a owner) — mantenerlas; esto solo agrega la guardia base.

**Aceptación:** con JWT de `viewer`, todo POST/PATCH/DELETE devuelve 403
`{error:"forbidden"}`; con `vendedor`, las de settings/team/inventory/reports dan 403.
El front ya muestra el mensaje (`errMsg` mapea `forbidden`).

---

## Tarea 2 — Vendedor "ve solo lo suyo" (alcance de datos)  · SCHEMA +1

Un vendedor solo ve los registros que creó; owner/admin ven todo el workspace.

**2.1** Migración: agregar `owner_id TEXT` a las tablas de datos operativos y backfill:

```sql
ALTER TABLE customers       ADD COLUMN owner_id TEXT;
ALTER TABLE sales           ADD COLUMN owner_id TEXT;
ALTER TABLE pipeline_items  ADD COLUMN owner_id TEXT;
-- backfill: asignar al owner del workspace los registros viejos (sin dueño)
UPDATE customers      SET owner_id = (SELECT user_id FROM workspace_members WHERE workspace_id = customers.workspace_id      AND role='owner' LIMIT 1) WHERE owner_id IS NULL;
UPDATE sales          SET owner_id = (SELECT user_id FROM workspace_members WHERE workspace_id = sales.workspace_id          AND role='owner' LIMIT 1) WHERE owner_id IS NULL;
UPDATE pipeline_items SET owner_id = (SELECT user_id FROM workspace_members WHERE workspace_id = pipeline_items.workspace_id AND role='owner' LIMIT 1) WHERE owner_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_owner      ON customers(workspace_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_sales_owner          ON sales(workspace_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_items_owner ON pipeline_items(workspace_id, owner_id);
```

**2.2** En cada `INSERT` de esos recursos, setear `owner_id = <sub del JWT>`.

**2.3** En cada `GET` (list/detail) y en `PATCH/DELETE` de esos recursos, si el rol
es `vendedor`, filtrar por dueño:

```ts
const scope = role === "vendedor" ? " AND owner_id = ?" : "";
const params = role === "vendedor" ? [workspaceId, userId] : [workspaceId];
// SELECT ... WHERE workspace_id = ?${scope}
```

Para PATCH/DELETE del vendedor: si el registro no es suyo → 403/404 (no filtrar a
ciegas; chequear `owner_id === userId` antes de mutar).

**Decisiones a confirmar antes de codear:**
- **Reportes y Caja**: ¿el vendedor ve los totales del negocio? Hoy el front le
  oculta Reportes (`reports.view` solo managers). Caja es compartida (la sesión de
  caja es del local, no por-vendedor) → dejar Caja global. Confirmar.
- **Pipeline stages, catálogo, tareas**: son compartidos del workspace, NO se scopean
  por dueño. Solo customers/sales/pipeline_items llevan owner_id.
- **Mi Día / Deudas**: usan customers+sales → heredan el scope automáticamente.

**Aceptación:** dos vendedores en el mismo workspace ven listas de clientes/ventas
disjuntas; el owner ve la unión.

---

## Tarea 3 — Billing: Mercado Pago (ARS) + límite de asientos  · SCHEMA +1

Plan **Free = 1 usuario**; pago = N asientos. Cobro recurrente con Mercado Pago
(suscripciones / preapproval). Capa desacoplada: el webhook solo escribe un flag.

**3.1** Migración:

```sql
ALTER TABLE workspaces ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';   -- 'free' | 'pro' | 'team'
ALTER TABLE workspaces ADD COLUMN seats INTEGER NOT NULL DEFAULT 1;     -- asientos permitidos
ALTER TABLE workspaces ADD COLUMN mp_preapproval_id TEXT;               -- id de la suscripción MP
ALTER TABLE workspaces ADD COLUMN plan_status TEXT DEFAULT 'active';    -- active | past_due | cancelled
```

> El `/me` ya devuelve `user.plan`; ahora además exponer `plan`/`seats`/`plan_status`
> del **workspace** en el GET de workspaces (el front los usará para la sección
> "Plan" de Ajustes y el gate de invitar).

**3.2** Seat-gate en invitar — en `POST /workspaces/:wid/invite`, antes de crear la
membresía:

```ts
const used = await count("SELECT COUNT(*) FROM workspace_members WHERE workspace_id=? AND status IN ('active','invited')", [wid]);
const { seats } = await getWorkspace(wid);
if (used >= seats) return json({ error: "seat_limit" }, 402);
```

> Front: el componente Equipo ya mapea códigos de error → agregar `seat_limit:
> "Llegaste al tope de tu plan. Mejorá el plan para sumar más gente."` y mostrar CTA
> de upgrade. Mismo gate en el paso "invitar equipo" del onboarding.

**3.3** Rutas de billing (secret `MP_ACCESS_TOKEN` vía `wrangler secret put`):
- `POST /workspaces/:wid/billing/checkout` (perm `billing.manage`) → crea un
  *preapproval* (suscripción) en MP con `back_url` a `clozr.online/app` y
  `external_reference = wid`. Devuelve `init_point` (URL de pago). El front redirige.
- `POST /billing/webhook` (público, sin auth de sesión; validar firma de MP) → en
  evento `preapproval` / `subscription_authorized_payment`: buscar `external_reference`
  (wid), y según estado setear `plan`/`seats`/`plan_status`/`mp_preapproval_id`.
  Mapear plan→seats (ej: pro=3, team=10 o ilimitado=9999). **Idempotente** (MP
  reintenta).

**3.4** Degradación: si `plan_status='cancelled'` o `past_due` por X días → volver a
`plan='free', seats=1`. Decidir gracia (ej. 7 días). No borrar miembros; si
`used > seats` tras bajar, bloquear nuevas invitaciones y marcar el exceso como
"sin asiento" (read-only) — definir con el usuario.

**Precios / planes (faltan definir con el usuario):** montos ARS de Pro y Team,
asientos por plan, y si hay trial (el landing dice "Probar 14 días").

---

## Orden sugerido de aplicación
1. Tarea 1 (permisos server-side) — sin migración, es la base de seguridad.
2. Tarea 2 (owner_id) — 1 migración + filtros.
3. Tarea 3 (billing) — 1 migración + MP + webhook (la más grande; necesita precios).

Tras cada tarea: `wrangler deploy` + verificar la migración + smoke test con un JWT
de cada rol. El front ya está listo para consumir los tres.
