---
name: clozr-ui
description: Construí o portá una vista/pantalla de la webapp Clozr (clozr-web) con paridad EXACTA a la app desktop, usando el design system (tokens), la librería de componentes ya portada y las golden rules de UI. Usar cuando se vaya a "portar una vista", "construir una pantalla", "hacer la UI de X", "que se vea como la desktop", o al tocar look & feel / componentes / estilos de clozr-web.
---

# clozr-ui — construir/portar UI de Clozr con paridad exacta

La webapp `clozr-web` (Next.js 16) es una **reescritura de la app desktop** (`../clozr`, Tauri + React + Vite).
La UI del desktop es **React vanilla + CSS puro** (tokens + clases utilitarias, SIN Tailwind ni shadcn en los
componentes), así que se porta casi verbatim. **Solo se reescribe la capa de datos** (SQLite → fetch al Worker).
Objetivo permanente: que la web quede **idéntica a la desktop**.

## 0. Dónde está cada cosa
- Webapp: este repo (`clozr-web`). La app vive en `src/app/app/` (`AppClient.tsx` → `Crm.tsx`).
- Desktop (fuente de verdad del look): repo hermano `../clozr`, pantallas en `src/pages/<vista>/` o `src/features/<vista>/`.
- Shell ya portado: `src/layout/{AppShell,Sidebar,Topbar}.tsx`. Tokens: `src/tokens/index.ts` + `src/app/globals.css`.

## 1. Cómo estilar (design system, dark-only)
- **NUNCA Tailwind para la app.** Tailwind es solo para la landing (`src/app/page.tsx`). En la app se usa:
  - **Tokens** importados como valores: `import { color, space, text, weight, radius } from '@/tokens';`
    y aplicados con `style={{ ... }}` (ej: `color: color.textMuted`, `padding: space[4]`, `fontSize: text.sm`).
  - **Clases utilitarias** de `globals.css` para estados hover/active sin useState:
    `.btn`/`.btn.primary`, `.btn-icon`(+`.muted`/`.danger`/`.wa`/`.primary`), `.btn-bordered`, `.row-hover`,
    `.dt-row`, `.dt-checkbox`, `.sidebar-nav`, `.tab-underline`/`.tab-pill`, `.card-hoverable`, `.modal-close`, etc.
- **Nada hardcodeado:** ni hex ni px sueltos para color/espaciado → siempre token (`var(--*)` o `color.*`/`space[*]`).
- Modo oscuro obligatorio, paleta única. Marca = rojo `--primary` (#E11D48). Verde/amarillo/rojo solo semánticos.
- **Fechas/horas:** usar el componente `DateTimePicker` (calendario propio estilado con tokens Clozr), NO `<input type="date">` nativo — el navegador no deja pintar su calendario.

## 2. Librería de componentes ya portada (reusá SIEMPRE, no reinventes)
En `src/components/` (todos presentacionales, mismos props que la desktop):

| Componente | Para qué |
|---|---|
| `Button` | botones (variant primary/secondary/ghost/danger/success, size sm/md/lg, iconLeft/Right, loading) |
| `Card`, `MetricCard` | contenedor de superficie / **KPIs** (label, value, unit, delta, tone, icon) |
| `Badge` | etiquetas de estado (tone + variant soft/solid/outline) |
| `Avatar` | iniciales con color determinista por nombre, o `src` |
| `EmptyState` | estados vacíos accionables (icon + title + description + action CTA) |
| `Input`, `Textarea`, `Select`, `Field` | inputs de formulario con label/hint/error (de `Input.tsx`) |
| `Modal` + `ModalField` | diálogo centrado (overlay, Escape, `isDirty`, footer) |
| `Drawer` | panel lateral derecho (detalle de fila) |
| `Tabs` | pestañas (underline / pills) |
| `data-table/DataTable` (+ `RowActions`) | **tablas** (sort, selección múltiple, densidad, context-menu, sticky) |
| `ContextMenu` + `useContextMenu` | menú contextual (click derecho) |
| `Popover` | overlay posicionado (portal) |
| `Stepper` | input numérico [−][N][+] |
| `DateTimePicker` | fecha + hora |
| `PageHeader` | encabezado de pantalla (título + acciones) |
| `ConfirmDeleteModal` | confirmación destructiva que exige tipear un texto |
| `confirmAsync` + `ConfirmHost` | confirmación imperativa: `if (await confirmAsync({message, tone:'danger'})) {...}` |
| `icons/WhatsAppIcon`, `icons/SocialIcons`, `ui/Select`, `wa-picker/parts` | iconos / dropdown / piezas WhatsApp |

Stores listos: `@/store/uiStore` (`activeScreen`, `toasts`, `showToast`), `@/store/workspaceStore` (workspaces, activo).

**Aún NO portados** (necesitan capa de datos/stores; portar cuando la vista los precise, o con `clozr-endpoint`):
`TagChip` (colorPalette + types/domain), `CommandPalette`, `Toaster`, `UndoToastHost`, `ExchangeRateChip`,
`TipsModal`, `WhatsNewModal`, `ErrorBoundary`, `CollectPaymentModal`, `CustomerWaQuickPicker`, `WaQuickPicker`,
`ui/WorkspaceAssetUpload`. Si una vista los usa, portá su util puro (ej. `lib/format`, `lib/colorPalette`,
`types/domain`) primero.

## 3. Receta para portar una vista (paridad exacta)
1. **Mirá la pantalla real** en `../clozr/src/pages/<vista>/` (y sus `components/`). Reusá su markup/lógica de UI **tal cual**.
2. **Datos:** el desktop usa `lib/db/*` (SQLite local) — en la web NO hay SQLite. Reescribí esa data como **fetch al Worker**:
   reusá/extendé `src/lib/api.ts` (o creá `src/lib/db/<x>.ts` con la **misma firma** que el desktop, implementada con fetch).
   Si falta la ruta en el Worker → usá el skill **clozr-endpoint**. Mapeo snake_case (Worker) ↔ camelCase (UI) en `api.ts`.
3. **Estilá** con tokens + los componentes de la sección 2 (no recrees botones/tablas/modales a mano).
4. **Cableá al shell:** la vista se renderiza dentro de `<AppShell>` en `src/app/app/Crm.tsx`. Agregá su `id` al
   `VIEW_META` y al switch de `Crm.tsx`; el ítem del sidebar ya existe en `src/layout/Sidebar.tsx`
   (ids: home, pipeline, customers, sales, cash, deudas, inventory, tasks, reportes, team, settings).
5. **Verificá** (sección 5).

## 4. Golden rules (no negociables)
- **Multi-tenant:** toda lectura/escritura va por el Worker filtrando `workspace_id` (ya lo hace `api.ts` con `ws()`).
- **Mappers** snake↔camel en `api.ts`. Tipos de dominio en `src/lib/types.ts`.
- **No** agregar manejo de errores redundante (el fetch ya lo centraliza).
- Componentes presentacionales **no** llevan `"use client"` (viven bajo el boundary client de `/app`).
- **Next 16** tiene breaking changes: antes de tocar server components / `params` (Promise) / `proxy`, leé
  `node_modules/next/dist/docs/` (lo exige `AGENTS.md`).
- No commitear/pushear ni `wrangler deploy` sin que el usuario lo pida.

## 5. Verificar (paridad real)
- `npx tsc --noEmit` (type-check; NO choca con el dev server).
- `npm run dev` → `http://localhost:3000/app` y comparar **lado a lado con la desktop**.
- Para paridad pixel a pixel: correr la desktop (`cd ../clozr && npm run tauri dev`) o pedir capturas al usuario,
  y ajustar tokens/espaciados hasta que coincida.
