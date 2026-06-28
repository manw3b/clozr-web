@AGENTS.md

# Clozr Web — handoff para Claude Code

> Este archivo lo lee Claude al inicio de cada sesión. Es el contexto de
> arranque para trabajar en **clozr-web** (solo la versión web). Mantenelo
> actualizado cuando cambie algo importante.

## Qué es Clozr

CRM + ventas + inventario + caja para un revendedor argentino de celulares y
electrónica (workspace de referencia: **iPhone Club**). Es un SaaS multi-tenant.
El objetivo del dueño es **escalar y vivir de Clozr**, así que cada cambio se
piensa para producción, no como demo.

## Alcance de este repo (importante)

`clozr-web` es **solo el frontend web** (Next.js 16). En sesiones web-only
trabajás únicamente acá. Hay otros dos repos que **no se tocan** desde acá:

- **`clozr`** — app de escritorio (Tauri, DB local SQLite) **y** el Cloudflare
  Worker (`cf-worker/`, API REST multi-tenant sobre Turso/libsql).
- **`clozr-desktop`** — empaquetado del escritorio.

La web le pega al Worker (`WORKER_URL`, ver `src/lib/api.ts`). Si una tarea
necesita un cambio de backend (endpoint, columna, lógica del Worker), eso vive
en el repo `clozr/cf-worker` — fuera de scope acá: avisá al dueño en vez de
intentarlo desde la web.

## Arquitectura web (lo mínimo para ubicarte)

- **Next.js 16** con breaking changes vs. lo que conocés — ver `AGENTS.md` y
  leé `node_modules/next/dist/docs/` antes de escribir código nuevo de Next.
- **`src/lib/api.ts`** — cliente HTTP al Worker. Mapea snake_case (DB/Worker) ↔
  camelCase (UI). Acá viven `listSales`, `createSale`, `addPayment`, etc. El
  JWT viaja en `Authorization: Bearer`.
- **`src/lib/types.ts`** — tipos de dominio (`Sale`, `SaleDetail`, `Product`,
  `Customer`, …) + helpers (`saleCode`, `appointmentCode`, `stagesForIndustry`).
- **`src/lib/format.ts`** — formato de plata: `formatMoney(amount, currency)`,
  `dualMoney(ars, blue)` (US$ desde un monto ARS) y `dualUsd(usd, blue)`
  (US$ desde un monto ya en dólares, con `≈ pesos` de referencia).
- **`src/store/`** — zustand. `useDollarStore` tiene el blue
  (`useDollarStore.getState().blue`, o el hook `useBlueRate()`).
- **`src/app/app/`** — las pantallas: `Crm.tsx`, `Ventas.tsx`, `Deudas.tsx`,
  `Reportes.tsx`, `Caja.tsx`, `Ajustes.tsx`, `Inventario.tsx`, etc.
- Sync entre pantallas por window events: `clozr:customer-changed`,
  `clozr:item-changed`, `clozr:stage-changed` (ver `src/lib/*Events.ts`).
- **Skills del repo**: `.claude/skills/clozr-ui` (portar/construir vistas con el
  design system y los tokens) y `.claude/skills/clozr-endpoint` (consumir un
  recurso nuevo de la API). Usalas cuando apliquen.

## Regla de oro: la plata es en dólares (US$-nativo)

El dólar es la **moneda madre**. Toda la app ya migró a US$ (migración completa
en web). Reglas:

- Una venta guarda `total_usd / total_paid_usd / balance_usd / fx_rate` como
  **fuente de verdad**, y las columnas ARS (`total/total_paid/balance`) quedan
  de **referencia** (congeladas al `fx_rate` del momento, ese blue NO se vuelve
  a tocar → el saldo "no se licúa").
- Los pagos guardan `amount_usd` + `fx_rate` congelado. `addPayment` ya calcula
  `amount_usd` según la moneda elegida (US$ tal cual; ARS ÷ blue del momento).
- En pantalla: **US$ como número principal**, `≈ pesos` de referencia (`dualUsd`).
- **Ventas legacy** (sin `total_usd`): caen al ARS / blue de hoy — nunca mostrar
  algo peor que antes. El backfill (Ajustes → "Pasar ventas a dólares") las pasa
  a US$ una sola vez.
- Excepción consciente: el **taller/reparaciones** sigue en pesos (repuestos y
  mano de obra son costos locales en ARS). Migrarlo a US$ sería una mini-fase
  aparte si el dueño lo pide.

## Cómo trabaja el dueño (estilo)

- Habla en **español** (rioplatense). Respondé en español, claro y sin vueltas.
- Trabaja **fase por fase**: una mejora concreta, se shippea a prod, y sigue.
  Suele decir "seguimos", "fase X", "continuemos en base a tu recomendación".
- Quiere **recomendaciones, no menús**: proponé el próximo paso con criterio y,
  si la decisión es suya (alcance/plata/algo irreversible), preguntá — pero con
  una opción recomendada arriba.
- **Cada fase termina en producción.** No dejes ramas a medias: typecheck →
  build → PR → merge → Vercel.
- Si algo "sigue saliendo mal" tras un merge, suele ser **cache del browser**:
  recordale hard-refresh antes de debuggear.

## Flujo de trabajo y deploy (web)

1. Desarrollá en la **branch que asigna el harness** (`claude/...`). **Nunca**
   pushees directo a `main`.
2. Antes de mergear, **siempre** verificá: `npx tsc --noEmit` y `npm run build`
   (ambos en verde). El build es el gate real (Next corre TS ahí también).
3. Commit con mensaje **en español**, claro y descriptivo (mirá el `git log`
   para el estilo). El harness ya agrega el footer `Co-Authored-By` /
   `Claude-Session`.
4. PR con `mcp__github__create_pull_request` (base `main`, head tu branch).
5. Merge con `mcp__github__merge_pull_request` (`merge_method: "merge"`).
6. **Vercel** publica `main` solo. Avisá al dueño que haga hard-refresh.
7. Reintentá `git push` con backoff si falla por red (2s/4s/8s/16s).

## Convenciones y seguridad

- **Nunca** incluyas el identificador del modelo en commits, PRs, código ni
  ningún artefacto que se pushee. Va solo en el chat.
- No pidas ni pegues secretos en archivos. El **token de Cloudflare** que se usó
  para deployar el Worker quedó expuesto en el chat anterior: **el dueño debe
  rotarlo** (no lo necesitás para trabajo web-only).
- No crees un PR salvo que se pida explícitamente (acá sí se pide: es el flujo
  de deploy). No comentes en GitHub salvo que haga falta de verdad.

## Estado actual (al hacer el handoff)

- **Migración a US$: COMPLETA en web** — ventas, deudas, reportes, caja,
  comprobantes y el cobro con toggle US$/$ ya están en dólares. El escritorio
  también quedó al día (otro repo).
- Pendiente **opcional**: migrar el **taller/reparaciones** a US$ (hoy ARS).
- Idea a evaluar: adoptar **Superpowers** (metodología de skills para Claude
  Code). Análisis y plan en **`docs/superpowers-adoption.md`**.
