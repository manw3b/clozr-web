# Asistente Clozr (Claude) — visión y contrato web↔Worker

> Spec de la integración de IA de Clozr. **Objetivo: Nivel 3** — un asistente que
> *conoce el negocio* y *ejecuta acciones con tu OK*, sin romper el modelo de
> créditos ni la seguridad multi-tenant.
>
> Este doc vive en `clozr-web` pero define el **contrato entre los dos repos**:
> la web (cliente) y el **Worker** (`clozr/cf-worker`, el cerebro). La mayoría de
> lo "inteligente" se construye en el Worker; acá queda escrito para que ambos
> lados se pongan de acuerdo.

## 1. Estado actual (lo que YA está configurado)

Arquitectura: **web (cliente delgado) ↔ Worker ↔ Claude (API de Anthropic)**.

- **clozr-web**: UI del chat (`ClozrAi`, launcher flotante + drawer), manda la
  conversación con `aiChat(messages)`, muestra la respuesta, maneja el **wallet**
  (1 gratis + packs por Mercado Pago) y el paywall. Gateado a planes pagos
  (`hasAiPlan`). También: `AiSuggestions` (generar/reescribir textos) y
  `ClozrToday` (el "day brief").
- **Worker** (`clozr/cf-worker`, **otro repo, fuera de scope web-only**): recibe
  los mensajes, le inyecta a Claude el contexto del negocio (acceso a Turso del
  workspace), llama a la API de Anthropic, devuelve la respuesta y descuenta el
  crédito. Endpoints: `/ai` (status+wallet), `/ai/chat`, `/ai/action`
  (`generate`/`rewrite`/`summary`/`daybrief`), `/ai/checkout`.

**Dato clave:** el cliente web manda **solo los mensajes**. Lo que Claude sabe y
puede hacer **lo decide el Worker**. Por eso el grueso del Nivel 2/3 es Worker.

**Tener Claude ya configurado NO impide nada**: el Nivel 3 *extiende* esto
reusando key, modelo, chat y wallet. Lo único a verificar en el Worker es que el
modelo soporte **tool-use** (todos los Claude actuales lo soportan).

## 2. Arquitectura objetivo: tool-use (function calling) en el Worker

El Worker le pasa a Claude un set de **tools**. Claude decide cuál usar; el Worker
la ejecuta contra la DB (**siempre filtrando por `workspace_id`**) y le devuelve el
resultado a Claude, que redacta la respuesta y/o **propone una acción** a la web.

```
usuario ──▶ web ──messages──▶ Worker ──▶ Claude
                                  │  ◀── tool_use (leer/escribir)
                                  ├─ ejecuta tool vs Turso (workspace_id)
                                  └─ reply + actions[] ──▶ web ──▶ UI / confirmación
```

### Catálogo de tools (propuesta)

**Lectura (Nivel 1) — sin riesgo:**
- `ventas_resumen(periodo)` → totales en US$ (fuente de verdad congelada)
- `deudas_listar()` → clientes con saldo + días de atraso
- `producto_buscar(q)` · `stock_bajo()`
- `cliente_buscar(q)` → ficha + historial de compras/deuda
- `caja_estado()` · `reportes_margen(periodo)`

**Escritura (Nivel 2/3) — SIEMPRE con confirmación del usuario:**
- `venta_borrador(items, cliente, pagos)` → arma el draft (no persiste)
- `turno_agendar(cliente, fecha, tipo)`
- `movimiento_caja(tipo, monto, moneda, metodo)`
- `recordatorio_cobro(clienteIds)` → borradores de WhatsApp por cliente

## 3. Contrato web ↔ Worker (el corazón de este doc)

La respuesta de `/ai/chat` se **extiende**: además de `reply` (texto), puede traer
`actions`. La web ya sabe renderizarlas aunque el Worker mande `[]`.

```ts
// Lo que el Worker puede devolver junto al texto:
interface AiReply {
  reply: string;
  wallet: AiWallet;
  actions?: AssistantAction[];
}

type AssistantAction =
  // Nivel 2 — la web abre algo prellenado; el usuario completa/confirma:
  | { type: "open_form"; form: "sale" | "turno" | "cash" | "customer"; label: string; prefill: Record<string, unknown> }
  | { type: "navigate"; view: string; label: string }
  | { type: "whatsapp"; label: string; phone?: string; text: string }
  // Nivel 3 — la web muestra un card de confirmación y, al OK, ejecuta:
  | { type: "confirm_execute"; tool: string; label: string; summary: string; payload: Record<string, unknown> };
```

- **Nivel 2** (`open_form` / `navigate` / `whatsapp`): la web abre el formulario
  prellenado (reusa el `prefill` de los modales que ya existen — ej. `SaleModal`,
  `TurnoFormDialog`), o el WhatsApp. **Cero escritura sin intervención.**
- **Nivel 3** (`confirm_execute`): la web muestra un **card de confirmación**
  (resumen legible + botón "Confirmar"). Al confirmar, llama a un endpoint nuevo
  del Worker:

### Endpoint nuevo (Worker): `POST /workspaces/:wid/ai/execute`

```
body: { tool: string, payload: object }
→ valida permiso del rol → filtra workspace_id → ejecuta → { ok, result, summary }
  y loguea (auditoría): quién confirmó, qué tool, payload, resultado.
```

La web, tras el `ok`, **refresca** la pantalla afectada (dispara los eventos
`clozr:*-changed` que ya existen) y muestra "Hecho ✓".

## 4. Barandas del Nivel 3 (no negociables)

1. **Confirmación explícita** para toda escritura. El asistente **nunca** ejecuta
   solo: propone, el usuario confirma.
2. **Permisos**: `/ai/execute` respeta el rol (`sales.write`, `cash.write`, …).
   Si el rol no puede, la acción ni se ofrece.
3. **Multi-tenant** (riesgo #1 del proyecto): toda tool filtra por `workspace_id`.
   Claude nunca ve ni toca datos de otro workspace.
4. **Auditoría**: log de cada acción ejecutada por IA.
5. **Plata = US$-nativo**: las escrituras de plata (venta/caja) usan la misma
   lógica congelada (`fx_rate`, `total_usd`). El asistente **no inventa montos**:
   usa catálogo/datos reales (`money.ts` / `sale.ts`).
6. **Reversible**: el usuario edita el draft antes de confirmar; "deshacer" donde
   se pueda.

## 5. Qué construye cada repo

| | clozr-web (este repo) | Worker (clozr/cf-worker) |
|---|---|---|
| Pantalla del Asistente (full-screen) | ✅ | |
| Renderizar `actions` (forms prellenados, WhatsApp, cards de confirmación) | ✅ | |
| Llamar a `/ai/execute` + refrescar la UI | ✅ | |
| Wallet / paywall / compra de créditos | ✅ (ya está) | (cobro) |
| Prompts sugeridos por pantalla | ✅ | |
| **Tools** (lectura + escritura) | | ✅ |
| Acceso a la DB + system prompt/persona | | ✅ |
| `/ai/execute` con permisos + auditoría | | ✅ |
| Elegir el modelo (tool-use) | | ✅ |

## 6. Plan por fases

1. **Web shell**: Asistente full-screen + ejemplos + estado del wallet. *(web, ya)*
2. **Contrato listo**: la web renderiza `actions` aunque el Worker mande `[]`. *(web)*
3. **Worker Nivel 1**: tools de lectura → Claude responde con datos reales del negocio.
4. **Nivel 2**: el Worker emite `open_form`/`whatsapp`; la web prellena. *(ambos)*
5. **Nivel 3**: `confirm_execute` + `/ai/execute` + barandas. *(ambos)*

## 7. Modelo

Usar el **Claude más nuevo y capaz** disponible con tool-use para razonar sobre el
negocio. Para tareas simples (reescribir un WhatsApp) puede ir un modelo más
chico/rápido y barato — el Worker elige por tipo de acción. (IDs de modelo
vigentes: ver la doc de la API de Anthropic al implementarlo en el Worker.)

---

> **Resumen para el dueño:** la web queda lista para mostrar y confirmar acciones;
> el salto a "agente que ejecuta" se hace en el Worker (tools + `/ai/execute` +
> barandas). Este doc es el contrato para que ambos lados encajen.
