# Clozr Web — Roadmap

Norte del proyecto: que la webapp (`clozr.online`) sea **funcionalmente igual a la app desktop**, y de ahí en más sumar lo que aporte valor real al vendedor PyME.

> Este archivo es la fuente de verdad del plan. Se actualiza a medida que avanzamos.
> **Última actualización:** 2026-06-18 (post IMEIs + precios por tipo + snapshot de costo)

---

## ✅ Hecho y LIVE (www.clozr.online)

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

---

## 🔜 Próximo (a definir)

- **Roadmap de paridad cumplido + value-adds entregados.** No hay un próximo grande comprometido. Candidatos cuando haga falta: tipos de cliente configurables (hoy 4 fijos), tracking por IMEI con stock (`stock_items`), exportar Reportes, billing (Mercado Pago / Lemon Squeezy). Ver "Diferido por vista" más abajo.

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
