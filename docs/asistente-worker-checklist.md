# Asistente Clozr — checklist del Worker (cf-worker)

> Guía accionable para implementar el cerebro del Asistente en el **Worker**
> (`clozr/cf-worker`, **otro repo**). La web (`clozr-web`) ya está lista: renderiza
> y ejecuta las acciones que el Worker emita. Este doc resume `docs/asistente.md`
> en pasos concretos + **el contrato exacto que la web ya espera**, para que el
> Worker encaje sin tocar la web.
>
> Pensado para ejecutarse desde una sesión en el repo `clozr` (no web-only).

## Lo que la web YA hace (no hay que tocarla)

- Chat (`/ai/chat`), wallet/paywall (`/ai`, `/ai/checkout`), gating por plan pago.
- **Renderiza `actions`** debajo de cada respuesta del asistente (PR #95):
  - `open_form` → abre el form prellenado (venta/cliente/turno/caja).
  - `navigate` → cambia de pantalla.
  - `whatsapp` → abre WhatsApp con texto.
  - `confirm_execute` → card de confirmación → al OK llama `POST /ai/execute`.
- Prompts sugeridos por pantalla (PR #96).

**Conclusión:** el Worker solo tiene que (1) **emitir** `actions` y (2) exponer
`POST /ai/execute`. Cero cambios en la web.

---

## Contrato EXACTO (lo que la web ya parsea)

La respuesta de `POST /workspaces/:wid/ai/chat` se extiende con `actions?`:

```jsonc
{
  "reply": "string",                 // texto que se muestra como burbuja
  "wallet": { "credits": 0, "freeUsed": 0, "freeLimit": 1 },
  "actions": [ /* 0..n de los de abajo; omitir o [] = sin acciones */ ]
}
```

Formas de `action` que la web sabe renderizar (campos **exactos**):

```jsonc
// Nivel 2 — la web abre algo / navega / WhatsApp (cero escritura sin click):
{ "type": "open_form", "form": "sale|turno|cash|customer", "label": "Cargar la venta", "prefill": { /* ver abajo */ } }
{ "type": "navigate",  "view": "sales", "label": "Ver ventas" }
{ "type": "whatsapp",  "label": "Avisar al cliente", "phone": "549...", "text": "Hola!" }

// Nivel 3 — la web muestra un card y, al confirmar, llama /ai/execute:
{ "type": "confirm_execute", "tool": "crear_venta", "label": "Crear la venta", "summary": "Venta a Juan · US$ 100", "payload": { /* lo que necesite la tool */ } }
```

### `view` válidos (para `navigate`)
`home`, `pipeline`, `customers`, `sales`, `agenda`, `cash`, `deudas`,
`inventory`, `repairs`, `tasks`, `reportes`, `team`, `settings`, `console`.

### `prefill` por `form` (lo que la web usa hoy)
- **`sale`** (el más útil) — la web lo pasa al modal de venta:
  ```jsonc
  { "customerId": "uuid?", "customerName": "Juan?",
    "lines": [ { "description": "iPhone 13", "quantity": "1", "unitPrice": "100", "currency": "USD" } ] }
  ```
  (`quantity`/`unitPrice` son **strings**; `currency` = `"ARS" | "USD"`.)
- **`customer`** — hoy abre el alta de cliente (sin prefill fino todavía).
- **`turno`** — navega a Agenda y abre el alta de turno.
- **`cash`** — navega a Caja.

> Para `open_form sale`, mandá el `prefill` con esa forma y la web prellena la
> venta sola. Para escrituras "fuertes", preferí `confirm_execute`.

### `POST /workspaces/:wid/ai/execute` (Nivel 3)
La web llama así al confirmar; **mientras no exista, responde 404 y la web
degrada elegante** (no rompe):
```jsonc
// request
{ "tool": "crear_venta", "payload": { /* el del confirm_execute */ } }
// response esperada
{ "ok": true, "result": { /* lo que devuelva la tool */ }, "summary": "Venta creada ✓" }
```
Tras el `ok`, la web refresca las pantallas (eventos `clozr:*-changed`).

---

## Checklist por fases

### ☐ Fase 3 — Nivel 1: tools de LECTURA (el asistente conoce el negocio)
- [ ] En la llamada a Anthropic (Messages API) sumar `tools` (function calling).
- [ ] Implementar `runTool(name, input, ctx)` con el **loop de tool-use**
      (`stop_reason: "tool_use"` → ejecutar → `tool_result` → repetir).
- [ ] Tools de lectura mínimas: `ventas_resumen(periodo)`, `deudas_listar()`,
      `producto_buscar(q)`, `stock_bajo()`, `cliente_buscar(q)`, `caja_estado()`.
- [ ] **Guard multi-tenant:** el `workspace_id` sale del **JWT**, nunca del input
      de Claude. Toda query `WHERE workspace_id = ?`.
- [ ] System prompt: persona (asistente de un revendedor argentino), reglas
      (US$-nativo, **no inventar montos**, proponer no ejecutar), contexto base
      (negocio, fecha, blue).
- **Listo cuando:** preguntás "¿cuánto vendí este mes?" y responde con datos
  reales del workspace (sin acciones todavía).

### ☐ Fase 4 — Nivel 2: emitir `actions` (open_form / navigate / whatsapp)
- [ ] Tools de escritura que **NO tocan la DB**: devuelven una propuesta que el
      Worker manda como `action`.
- [ ] Mapear: pedido de venta → `{ type: "open_form", form: "sale", prefill }`;
      "mandale un WhatsApp" → `{ type: "whatsapp", phone, text }`; "mostrame X" →
      `{ type: "navigate", view }`.
- [ ] Respetar el catálogo/datos reales para armar el `prefill` (no inventar
      precios: usar el catálogo del workspace).
- **Listo cuando:** "cargá una venta de un iPhone a Juan" devuelve un botón que,
  al tocarlo, **abre la venta prellenada** en la web. (La web ya lo hace solo.)

### ☐ Fase 5 — Nivel 3: `confirm_execute` + `/ai/execute` + barandas
- [ ] Para escrituras fuertes, emitir `confirm_execute` (con `summary` legible).
- [ ] Implementar `POST /workspaces/:wid/ai/execute`:
  - [ ] `requireAuth` → 401 si no hay sesión.
  - [ ] **Permiso por rol** según la tool (`sales.write`, `cash.write`, …) → 403.
  - [ ] Filtrar por `workspace_id`; ejecutar **reusando la lógica real** de
        venta/turno/caja (US$-nativo: `fx_rate`, `total_usd` congelados).
  - [ ] **Auditoría:** loguear quién confirmó, qué tool, payload, resultado.
  - [ ] Responder `{ ok, result, summary }`.
- **Listo cuando:** "creá la venta" muestra el card, confirmás, y la venta
  aparece (con la pantalla refrescada) + queda registrada en la auditoría.

---

## Barandas no negociables (de `docs/asistente.md` §4)
1. **Confirmación explícita** para toda escritura. El asistente nunca ejecuta solo.
2. **Permisos**: `/ai/execute` respeta el rol; si no puede, la acción no se ofrece.
3. **Multi-tenant** (riesgo #1): toda tool filtra por `workspace_id` (del JWT).
4. **Auditoría**: log de cada acción ejecutada por IA.
5. **Plata = US$-nativo**: las escrituras usan la lógica congelada; no inventar montos.
6. **Reversible**: el usuario edita el draft antes de confirmar.

## Modelo
El Claude más nuevo con tool-use para razonar; uno más chico/rápido para tareas
simples (reescribir un WhatsApp). El Worker elige por tipo de acción. IDs de
modelo vigentes: ver la doc de la API de Anthropic al implementarlo.

---

> **Resumen:** la web está lista de punta a punta. El trabajo es 100% Worker:
> tools (lectura → escritura-propuesta) + `/ai/execute` con barandas. Emití las
> `actions` con las formas exactas de arriba y la web las renderiza sin cambios.
