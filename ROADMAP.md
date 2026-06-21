# Clozr Web — Roadmap

Norte del proyecto: que la webapp (`clozr.online`) sea **funcionalmente igual a la app desktop**, y de ahí en más sumar lo que aporte valor real al vendedor PyME.

> Este archivo es la fuente de verdad del plan. Se actualiza a medida que avanzamos.
> **Última actualización:** 2026-06-21 (Consola + pricing USD F1–F5 LIVE; MP validado; crecimiento: anual + referidos + espacios + dunning/win-back hechos; landing actualizada)

---

## ✅ Hecho y LIVE (www.clozr.online)

- **Responsive / mobile-first** — la app entera se usa bien en celular (verificado a 390px en build de prod). Foundation: `useIsMobile()` (`src/lib/useIsMobile.ts`, breakpoint 767px) + helpers CSS en `globals.css` (`.cz-metric-grid`, `.cz-two-col`, `.cz-hero`, `.cz-noscrollbar`). Shell: sidebar → **drawer off-canvas** con hamburguesa + backdrop (`AppShell`/`Sidebar`), topbar condensado (búsqueda ícono-only, oculta el chip del dólar). Vistas: grids de métricas 4/3-col → 2-col en móvil, Mi Día apila el hero, la **DataTable** renderiza cada fila como **tarjeta** en móvil (genérico → Clientes/Ventas/Tareas/Deudas), filtros con scroll horizontal, y el **Pipeline kanban** en móvil es un carrusel: columnas ~85vw con scroll-snap (se desliza una etapa a la vez, con peek de la siguiente). **Fix incluido**: el reset `button {}` de `globals.css` estaba fuera de `@layer` y pisaba las utilidades de Tailwind → los botones de login/onboarding salían sin estilo; ahora va en `@layer base`. 100% frontend; `npm run build` verde. *Diferido: PWA (instalable + offline).*

- **Onboarding guiado** — wizard multi-paso (`src/app/app/OnboardingWizard.tsx`) que reemplaza el alta de un solo campo: bienvenida → tu nombre (si falta) → tu negocio (nombre + rubro + objetivo diario) → invitar al equipo (opcional, skippable) → listo. 100% frontend sobre endpoints existentes. Saltar onboarding a mitad y volver te deja igual adentro (si el espacio ya se creó, `fetchMe` lo encuentra).
- **Permisos reales por rol** — modelo central `can(role, perm)` en `src/lib/permissions.ts` (+ hook `usePermissions`) que reemplaza los `canManage` ad-hoc que solo existían en Equipo/Ajustes. Define permisos de **acción** para los 4 roles: **Dueño** (todo, incl. facturación y borrar espacio), **Encargado** (todo menos facturación/borrar espacio), **Vendedor** (opera clientes/ventas/caja/pipeline/tareas; no configura ni ve Reportes del negocio), **Solo lectura** (ve todo, no escribe nada). Aplicado en TODAS las vistas operativas (crear/editar/borrar gateados), el menú "Nuevo" del topbar, los atajos de teclado, el sidebar (Reportes/Equipo se ocultan por permiso) y el render de vistas en Crm. **Cierra el bug**: "Solo lectura" ya no podía editar todo. Frontend; `npm run build` verde. *Diferido (siguiente paso): enforcement server-side en el Worker y modo lectura dentro de los modales de edición.*
- **Paridad base** — 11 vistas (Mi Día, Pipeline, Clientes, Ventas, Caja, Deudas, Inventario, Tareas, Reportes, Equipo, Ajustes) + shell completo (sidebar 3 secciones + topbar: switcher de workspace, chip de dólar, búsqueda ⌘K, notificaciones reales, menú "Nuevo").
- **Pipeline a fondo** — kanban drag&drop, convertir oportunidad → venta, acciones en la card (WhatsApp/llamar), menú contextual (mover/ganar/perder/eliminar), filtro por prioridad.
- **Import de clientes** — CSV / TSV / vCard (.vcf, contactos del celular), mapeo de columnas, dedupe por teléfono, alta en lote.
- **Caja con sesión** — abrir/cerrar caja diaria + arqueo (esperado vs contado, por moneda). *Incluyó el primer cambio de backend (Worker + tabla `cash_sessions`).*
- **Reportes v2** — margen (facturación/costo/ganancia/% + facturación sin costo asignado) + productos más vendidos. Las ventas ahora se pueden **linkear a un producto del catálogo** desde el modal de venta (selector), así el ítem hereda el costo y el margen sale del costo real. Endpoint read-only nuevo `GET /sale-items` (bulk). *También arregló un bug del flujo de ventas: la cantidad vacía/0 ya no diverge el total mostrado del persistido.*
- **Mi Día v2** — objetivo del día con barra de progreso editable + anillo de score (4 criterios), bloque de **seguimientos** (followups, con completar) y **clientes en riesgo** (sin contacto hace 60+ días, con WhatsApp/llamar que registra el contacto). 100% frontend sobre endpoints que ya existían.
- **Inventario — picker visual** — wizard con **fotos** (categoría→familia→modelo→color→storage→precio) sobre el catálogo Apple completo (5 categorías · 39 iPhone · 39 iPad · 19 Watch · 12 Mac · 6 AirPods). El catálogo se portó con un parser determinístico desde el seed del desktop; 445 fotos en `public/products`. Las cards de Inventario muestran la foto. Diferido (necesita backend): IMEIs y precios por tipo de cliente.
- **Seguridad** — credenciales rotadas (Anthropic + Google); el secret filtrado quedó invalidado.
- **Pulido global** — *undo toasts* (deshacer borrados en Pipeline/Caja/Inventario, estilo Gmail, 6s), *atajos de teclado* globales (1-9 navegación + V/C/M/T/L para acciones, con ayuda `?`), *tips* "¿Sabías que…?" (máx 1/semana + 1ª llegada del día) y modal **"¿Qué hay de nuevo?"** (changelog por versión). Accesibilidad: modales/drawers marcan `aria-modal` para que los atajos no se disparen detrás. 100% frontend.
- **Linkeo ventas↔catálogo** — el modal de venta ahora tiene un **selector de catálogo** por ítem (combobox buscable con foto, precio y costo/margen) en vez del `datalist` plano: elegir un producto linkea su `catalogItemId` (determinístico por id) y autocompleta el precio. Cada línea muestra un **chip de estado** (linkeado +margen% / sin costo / texto libre) y el total muestra **margen estimado + cuánto factura sin costo asignado** antes de guardar. Las líneas del preset (convertir oportunidad → venta) se auto-linkean. El link es "pegajoso" (anotar "… (sello)" no lo rompe). Dropdown portalizado (no se recorta dentro del modal).
- **IMEIs en ventas** — campo **IMEI / N° de serie por ítem** en el modal de venta; se persiste (la columna `sale_items.imei` ya existía en el worker) y se muestra en el detalle. *Diferido: tracking unidad-por-unidad con decremento de stock (necesita tabla `stock_items` que el worker aún no tiene).*
- **Snapshot de costo (margen histórico exacto)** — `sale_items.unit_cost` (worker SCHEMA v6): cada venta congela el costo del catálogo al momento de venderse. Reportes prefiere el snapshot y cae al costo actual sólo en ventas viejas (sin backfill). Editar el costo de un producto ya **no** reescribe el margen de ventas pasadas → cierra la salvedad del linkeo.
- **Precios por tipo de cliente** — cada producto puede tener precio por **final / revendedor / mayorista / empresa** (en ARS). Tabla nueva `catalog_prices` (worker SCHEMA v7) con ruta dedicada (`GET/PUT /catalog-prices`, upsert ON CONFLICT). Se cargan en el ProductModal de Inventario (grilla opcional, vacío = precio base). El modal de venta **sugiere el precio según el tipo del cliente elegido** y re-precia al cambiar de cliente (respetando ediciones manuales y precios del preset). Decisión: 4 tipos fijos (no configurables) por simplicidad/robustez.
- **Marca oficial** — logo Clozr (CZ) en favicon (`app/icon.svg`), login y sidebar (horizontal expandido / isotipo colapsado).
- **Ajustes a fondo** (de 3 a 8 secciones, paridad con desktop): **logo del negocio** (subir/quitar, R2; se ve en el switcher del topbar), **objetivo diario** (monto+moneda, alimenta Mi Día), **tipos de cliente** (CRUD), **etiquetas** (CRUD), **etapas del pipeline** (CRUD con invariante ≥1 ganada/≥1 perdida), **editar nombre** de perfil (PATCH /me). Worker SCHEMA v8 = **dedupe de métodos de pago** (bug visible: venían x2/x3 del seed desktop) + índice único parcial.
- **Gestión de equipos / workspaces** — crear y cambiar de espacio desde el switcher del topbar; invitar/roles/expulsar/código manual desde **Equipo**. (Ya existía; verificado end-to-end. El alta de workspace nuevo está en el onboarding y en el switcher.)
- **Consola Clozr (super-admin)** — gate por email (`SUPERADMIN_EMAILS`), enforced server-side. Pestaña **Cuentas** (todos los workspaces: dueño/contacto, plan, pago MP vs licencia, miembros, creación) y **Códigos** (generar/gestionar: **licencia** activa plan gratis, **descuento** %/USD apuntado, **desbloqueo** de catálogo). Canje desde Ajustes.
- **Pricing en USD cobrado en ARS al blue (F1)** — Free (1 empleado) / **Pro USD 20** (2) / **Team USD 45** (5), + **empleado extra USD 5/mes**. La conversión la hace el Worker server-side con dolarapi (no manipulable). Tarjetas de planes con el actual destacado + "Recomendado".
- **Re-pricing automático al dólar + empleados sobre plan activo (F2)** — cron que actualiza el monto ARS de cada suscripción al blue (re-aplica descuento); endpoint para cambiar empleados sin re-checkout (update del preapproval MP, fallback `needs_recheckout`).
- **Rubros + miniatura (F3)** — templates de pipeline por rubro (Tecnología, Indumentaria, Kiosco, Gastronomía, Servicios, Salud + Genérico) sembrados al crear el workspace; selector de emoji como miniatura (fallback sin logo).
- **Catálogo premium add-on (F4)** — catálogo Apple = desbloqueo único **USD 100** (pago MP one-time) **o por código**; entitlement por workspace; gatea el VisualProductPicker.
- **Descuentos apuntados (F5)** — el descuento se guarda en el workspace al canjear y se aplica en cada checkout cuyo target matchee (plan/empleados/catálogo) + en el re-pricing.
- **MP validado** — token de producción válido, conversión USD→ARS OK, y **webhook de producción 200 OK** (firma sincronizada, eventos Pagos + Suscripciones). *Pendiente operativo: rotar la clave secreta del webhook (quedó visible en una captura durante la validación) + hacer una suscripción real end-to-end.*

---

## 🔜 Próximo (rumbo al lanzamiento oficial)

### Plan de equipos + billing (decidido 2026-06-19)

Decisiones tomadas (no re-discutir): **cobro con Mercado Pago en ARS**; **plan Free = 1 solo usuario** (invitar equipo = pago); **el Vendedor ve solo SUS datos** (clientes/ventas propias); arranque del trabajo por **permisos reales** (✅ hecho). Secuencia:

1. **Permisos reales** — frontend ✅ **completo**: gating en vistas/sidebar/atajos + **modo lectura en los modales** de edición (verificado: un viewer abre una oportunidad del Pipeline y la ve con los campos deshabilitados y sin "Guardar"). Falta solo (a) enforcement **server-side** en el Worker (que rechace escrituras según rol, no solo ocultar UI) → **diseñado en `clozr-handoff/BACKEND-equipos-spec.md` (Tarea 1)**.
2. **Vendedor "ve solo lo suyo"** (alcance de datos) — necesita **Worker** (`owner_id` + filtrado por dueño) → **diseñado en `BACKEND-equipos-spec.md` (Tarea 2)**.

> **Nota de acceso:** el Worker vive en `manw3b/clozr` (`cf-worker/`), que NO está autorizado en esta sesión (confirmado: el proxy git lo rechaza). Para hacer el backend hay que agregar ese repo al entorno. Mientras tanto, las 3 tareas de backend quedaron escritas listas-para-aplicar en `clozr-handoff/BACKEND-equipos-spec.md`.
3. **Onboarding mejorado** — ✅ hecho (`src/app/app/OnboardingWizard.tsx`). Wizard multi-paso que reemplaza el alta de un solo campo: bienvenida → tu nombre (si falta, p.ej. login por email) → tu negocio (nombre + rubro/`industry` + objetivo diario) → invitar al equipo (opcional) → listo. 100% frontend sobre endpoints existentes (`updateMyName`, `createWorkspace`, `updateWorkspace`, `inviteMember`). *Falta cuando llegue billing: el paso "elegir plan" y gatear el invitar-equipo detrás de plan pago (Free = 1).*
4. **Billing (Mercado Pago, ARS)** — backend diseñado en `BACKEND-equipos-spec.md` (Tarea 3): suscripción recurrente + webhook que escribe flag de plan en Turso + **límite de asientos** (Free = 1; pago = N). Acá se suma el paso "elegir plan" al onboarding. *Frontend ya adelantado:* sección **Plan y suscripción** en Ajustes (`PlanCard` en `Ajustes.tsx`) que lee `user.plan` del `/me`, muestra los 3 tiers con el actual destacado y CTA de upgrade (hoy avisa "Mercado Pago llega pronto"; se cablea al checkout cuando exista el backend). Solo el dueño (`billing.manage`) ve los CTAs.

### Otros

- **Pre-lanzamiento:** probar onboarding end-to-end con un usuario nuevo real (registro por email → crear workspace → invitar a alguien), y avisar a los primeros usuarios de Hotmail/Outlook que miren spam (dominio recién verificado, reputación en warm-up).
- **Candidatos post-lanzamiento:** comisión/recargo por método de pago (`modifier_pct`+`kind`, necesita 2 columnas en el worker); plantillas de WhatsApp (schema nuevo); tipos de cliente configurables en el linkeo de precios (hoy 4 fijos); tracking por IMEI con stock (`stock_items`); export de Reportes. Ver "Diferido por vista".

---

## 🚀 Crecimiento / monetización ("vamos con todo" — 2026-06-21)

Lógica de los planes (el "por qué"): monetizamos por **3 ejes** — asientos (recurrente, escala con el equipo), tiers de features (Free→Pro→Team), y add-ons one-time (catálogo). Free es **gancho, no demo**: el disparador de pago es el **2º empleado**, no una función capada. Pro = "casi todo". Team = cosas que solo importan al crecer (IA, multi-sucursal, soporte). USD como ancla anti-inflación.

Orden de construcción acordado:

1. ✅ **Cobro anual (2 meses gratis)** — toggle mensual/anual en las tarjetas; anual = mensual×10; preapproval MP con `frequency` 12 meses; el re-pricing y el cambio de empleados respetan el intervalo (columna `billing_interval`). Mayor cash flow + en AR le ahorra al cliente 12 meses de inflación de una.
2. ✅ **Referidos** — código self-serve por workspace; al canjearlo, **descuento %** (20%) para el referido y el referidor; atribución sobre `console_code_redemptions`. ~80% reusa F1/F5 (códigos + licencia).
3. ✅ **Espacios / sucursales adicionales** — **decisión:** workspaces separados (reusa infra) + **USD 10/mes por espacio extra**. Un workspace con plan pago (el "principal") **cubre** otros espacios del mismo dueño: cada uno copia el plan del principal y se suma a **esa única suscripción** de MP (no paga aparte). Backend: columna `covered_by_workspace_id`; `POST /workspaces/:wid/cover|uncover` (actualizan el monto del preapproval, `needs_recheckout` si MP rechaza); `/me` expone `covered_by`; el re-pricing incluye los espacios; el cron de degradación **libera en cascada** los cubiertos cuando el principal cae a Free. UI: sección "Sucursales y espacios" en Ajustes (sumar/quitar). Bajo riesgo: el cubierto copia el plan, no toca rutas calientes nuevas.
4. **Descuento por volumen de empleados** — del 6º extra en adelante, precio menor (ej. USD 4).
5. ✅ **Dunning + win-back** — cron `cron/dunning.ts` (encadenado tras la degradación) que manda, idempotente vía `dunning_stage`: aviso inicial al fallar el pago → último aviso al vencer la gracia → win-back con **código de descuento 25%** (un uso, 30 días) cuando baja a Free. Reusa Resend + `console_codes`. Trigger manual `POST /admin/dunning`.
6. **Repensar el techo de Free** — límite suave (sin Reportes, o tope ~100 clientes) para que el unipersonal eventualmente convierta sin espantarlo.

---

## 🧹 Deuda técnica

- Sacar el estado `sales` huérfano de `app/app/Crm.tsx` (se fetchea pero ya no se renderiza).

---

## 📋 Diferido por vista (se hace cuando haga falta)

- **Clientes:** etiquetas/tags, historial/timeline de interacciones, último-contacto/estado, deuda manual, acciones masivas.
- **Ventas:** spark chart lateral, export CSV, mensaje/comprobante por WhatsApp, banner de regularización.
- **Pipeline:** reorder/resize de columnas, sort dentro de columna, filtros avanzados, acciones masivas, agendar visita, snooze, notas inline, plantillas de WhatsApp.
- **Inventario:** tracking por IMEI, precios por tipo de cliente, venta rápida.
- **Caja:** categorías de gasto sugeridas, top categorías.

---

## 🛠️ Notas de trabajo

- **Repos:** `clozr-web` (frontend, deploy a Vercel en push a `main`) · `clozr/cf-worker` (backend Cloudflare Worker, deploy con `wrangler deploy`).
- **Gate de calidad:** `npm run build` (web) / `npm run typecheck` (worker) + revisión adversarial antes de cada deploy a producción.
- **Deploy de backend:** Worker primero (`wrangler deploy` + verificar migración), después el frontend.
