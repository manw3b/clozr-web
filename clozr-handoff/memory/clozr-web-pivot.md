---
name: clozr-web-pivot
description: "Decisión de pivotar Clozr de desktop Tauri a webapp SaaS multi-tenant para LATAM, con plan de fases acordado"
metadata: 
  node_type: memory
  type: project
  originSessionId: 619817dc-2534-4fdf-b807-8345341336c2
---

El 2026-06-13 se decidió pivotar [[project-clozr]] de app desktop Tauri a **webapp SaaS** (frontend nuevo de cero), manteniendo el producto y la marca Clozr.

**⏯️ RETOMAR ACÁ (última sesión: 2026-06-14, en Ubuntu; el usuario sigue en WINDOWS):** la webapp está LIVE en https://www.clozr.online. **Login con Google: COMPLETO y probado end-to-end** (el usuario entró por Google y quedó logueado). OAuth client creado en Google Cloud (publicado a prod, scopes `openid email profile`, redirect `https://clozr-auth.pyter-import.workers.dev/auth/google/callback`); secrets `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` cargados; worker deployado. **AI Triage matutino: configurado y activo** — secret `ANTHROPIC_API_KEY` cargado y validado, cron `0 11 * * *` (8am ART) registrado (código en `clozr/cf-worker/src/cron/aiTriage.ts`); falta ver una corrida real con datos (trigger manual `POST /admin/ai-triage` con header `x-admin-secret: <JWT_SECRET>`). **AL RETOMAR EN WINDOWS: (1) 🔒 ROTAR la `ANTHROPIC_API_KEY` y el `GOOGLE_CLIENT_SECRET` — se pegaron en texto plano en el chat (la de Anthropic es urgente, gasto directo); (2) re-loguear `wrangler login` en Windows; (3) verificar el triage; (4) temas en cola: abrir login por email a todos (verificar dominio en Resend) y billing.** Detalle completo en `clozr-handoff/LEEME-MIGRACION-WINDOWS.md` (en el repo clozr-web).

**Decisiones acordadas (no re-discutir):**
- **Backend:** REUSAR el `cf-worker` (15 rutas, auth magic-link, R2, emails) + Turso. NO empezar el backend de cero. Solo se reescribe el frontend.
- **Stack frontend nuevo:** Next.js + TypeScript + Tailwind + shadcn/ui (landing + app en un proyecto). Reusar los componentes React de `src/` del repo actual. Repo nuevo previsto: `clozr-web`.
- **Monetización:** SaaS suscripción mensual (Free → Pro por usuario → Team por workspace).
- **Mercado:** PyMEs / equipos de venta LATAM, en español, precio en moneda local. Wedge = reemplazar Excel/WhatsApp, NO competir con HubSpot/Salesforce.
- **Billing:** capa desacoplada (webhook → flag de plan en Turso). Mercado Pago si cobran en moneda local LATAM; Lemon Squeezy (merchant of record) si cobran en USD. Stripe NO sirve para vender desde Argentina.
- **Móvil:** PWA primero (post-lanzamiento); stores nativas vía Capacitor solo si hay tracción.
- **Hosting:** Vercel para arrancar rápido, o Cloudflare Pages para unificar con el Worker. Dominio: Cloudflare Registrar (at-cost) o Porkbun/Namecheap; `.com.ar` vía nic.ar.

**Roadmap (~6-8 semanas a MVP cobrable):** F0 fundaciones/dominio → F1 auditar+adaptar Worker (auth web con cookie httpOnly, verificar filtro `workspace_id` server-side) → F2 cliente `lib/api/` (mismo shape que `lib/db/`) + portar UI → F3 billing → F4 landing+lanzamiento → F5 móvil/PWA.

**Riesgos clave a vigilar:** (1) seguridad multi-tenant — todo endpoint debe filtrar por `workspace_id`; (2) confirmar que las 15 rutas del Worker son CRUD completo y no solo "sync de respaldo" del desktop (define el tamaño real de F1).

**Ventaja heredada del código actual:** la capa de datos está centralizada (solo 2 archivos tocan `plugin-sql` directo; el resto usa `dbSelect`/`dbExecute`/`getDb`), y ya existe `isCloudModeFor(feature)` + permisos compartidos front/worker (`can(role, perm)`). El swap a un cliente HTTP es acotado.

**Why:** El backend cloud (Worker + Turso + R2 + multi-tenant) ya está ~70% hecho, así que la webapp es exponer lo existente, no construir de cero. El usuario lo planteó como "empezar de 0" pero se acordó limitar el de-cero al frontend.

**Estado al 2026-06-14 (arrancó la migración):**
- Repo nuevo scaffoldeado en `/home/pyter/clozr-web` — **Next.js 16.2.9 + Tailwind v4 (config CSS-first en `globals.css`, sin tailwind.config.js) + App Router + src/**. OJO: trae `AGENTS.md` que obliga a leer `node_modules/next/dist/docs/` antes de codear (Next 16 tiene breaking changes; `params` es Promise, hay `proxy` en vez de middleware).
- Tokens de Clozr portados a `globals.css` (@theme inline → utilidades `bg-surface`, `text-primary`, etc.). Fuente Inter vía next/font.
- Landing lista en `/` (hero "Dejá el Excel. Cerrá más ventas.", features, pricing Free/Pro/Team, CTA). `/app` es stub por ahora.
- Capa de datos en `src/lib/api.ts` (cliente HTTP al Worker) + `src/lib/types.ts` (dominio). JWT en localStorage `clozr_jwt`, workspace en `clozr_ws`, header `Authorization: Bearer`.
- **Auditoría del Worker:** es API REST CRUD COMPLETA multi-tenant en prod (`https://clozr-auth.pyter-import.workers.dev`), NO sync. Auth web sin deep-link ya existe: `POST /auth/request` (manda código) → `POST /auth/verify-code` {email,code} → devuelve JWT. CORS abierto. Rutas de dominio bajo `/workspaces/:wid/...` (customers, pipeline/stages, pipeline/items, sales, tasks, cash, catalog, etc.).
- Dev server: `cd /home/pyter/clozr-web && PORT=3100 npm run dev`. NO usar `pkill -f "next dev"` (se auto-mata el comando).
- **`/app` ya construido y funcional** (build de prod OK): `AppClient.tsx` (gate auth → setup workspace → CRM) + `Crm.tsx` (Dashboard, Pipeline kanban con drag&drop, Clientes, modales de cliente/oportunidad). Todo client-components, data via fetch directo (sin TanStack Query, refetch manual). Auth por email+código (`requestCode`→`verifyCode`). Al entrar a un workspace sin etapas, siembra las 7 canónicas (`seedDefaultStages`).
- **Shapes reales del Worker mapeados en `lib/api.ts`** (snake_case↔camelCase): item usa `estimated_value`/`lead_source`/`stage_id`+`stage_name`+`stage_order` (etapas = filas por-workspace con UUID propio); customers GET `{customers}`, POST devuelve `{ok,id}`; `/me` `{user,workspaces[]}`; `POST /workspaces` crea ws+membership owner. Seguridad multi-tenant CONFIRMADA: cada handler valida membership activa vía `getMembershipRole` y filtra por `workspace_id` (el riesgo que estaba marcado ya está cubierto).
- Para probar login real: usar `pyter.import@gmail.com` (único email permitido en Resend sandbox hasta verificar dominio).
- **Repo en GitHub (público):** https://github.com/manw3b/clozr-web (remote `origin`, branch `main`). Commiteado y pusheado. gh CLI autenticado como manw3b. NO hay secretos en el front (solo `NEXT_PUBLIC_WORKER_URL` con fallback); secretos viven en el Worker.
- **Deploy decidido: Vercel** (import del repo desde vercel.com → deploy automático por push; anda sin env vars por el fallback). vercel/wrangler CLI NO instalados localmente.
- Pendiente: que el usuario conecte el repo en Vercel; luego dominio. Casi todos los `clozr.*` principales (.com/.app/.io/.co/.dev) están TOMADOS (varios en parking); `clozr.com.ar` y `clozr.shop` parecían libres. Referencia visual del CRM: `/home/pyter/clozr-prototype.html`.

**EN PRODUCCIÓN (2026-06-14):** la webapp está LIVE en `https://www.clozr.online` (Vercel, scope `clozr-s`, proyecto `clozr-web`, deploy auto por push). Dominio `clozr.online` comprado en Hostinger (plan Premium — pero la app va en Vercel, no en el hosting Hostinger; Hostinger se usa solo para dominio/DNS + email). DNS ya apunta a Vercel (A `216.198.79.1`, www CNAME a vercel-dns), cert Let's Encrypt OK. `www.clozr.online` responde; el apex `clozr.online` puede tardar en propagar. Nota: las URLs internas `*.vercel.app` dan 401 por "Vercel Authentication" (Deployment Protection) pero el dominio público funciona. OJO: `clozr-web.vercel.app` (sin scope) es de OTRO proyecto ajeno ("Deal Closing OS"), no tocar.

**Google OAuth (login con Google) — código listo, falta activar:** implementado en el Worker (`cf-worker/src/routes/google.ts`: `/auth/google/start` + `/auth/google/callback`, authorization-code flow, state firmado con JWT_SECRET, emite el mismo JWT de sesión que verify-code) y en el front (`AppClient.tsx`: botón "Continuar con Google" + lee `#token`/`#error` del hash al volver). Ambos commiteados y pusheados (front auto-deploya; worker NO). PENDIENTE del usuario: (1) crear OAuth client en Google Cloud Console con redirect URI `https://clozr-auth.pyter-import.workers.dev/auth/google/callback` y publicar la consent screen (scopes básicos email/profile/openid no requieren verificación de Google); (2) `wrangler secret put GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`; (3) `wrangler deploy` del worker. Decisión de producto: SMS/celular pospuesto (caro, fraude SMS-pumping); si se quiere "celular" en LATAM, usar WhatsApp más adelante. Email passwordless (código) se mantiene, sin password tradicional.

**Email login abierto a todos (pendiente):** hoy el magic-code por email solo llega a `pyter.import@gmail.com` (sandbox Resend). Para abrirlo: verificar dominio `clozr.online` en Resend + actualizar `RESEND_FROM` del worker.

**Skills de proyecto (2026-06-14, viajan por git):** se crearon 4 skills de Claude Code. En `clozr-web/.claude/skills/`: **clozr-endpoint** (scaffold cross-repo de endpoint con guard multi-tenant). En `clozr/.claude/skills/`: **clozr-multitenant-audit** (audita filtrado `workspace_id`+auth antes de deploy), **clozr-release** (`npm run release`+CHANGELOG+`wrangler deploy`), **clozr-feature** (feature full-stack desktop con golden rules). clozr-endpoint asume `clozr` y `clozr-web` clonados lado a lado.

**Handoff a Windows (2026-06-14):** el usuario migra el trabajo a Windows (app de Claude Code). Se dejó la memoria + guía en `clozr-handoff/` (también commiteado dentro de `clozr-web`, archivo `clozr-handoff/LEEME-MIGRACION-WINDOWS.md`).

**How to apply:** Al trabajar en la webapp, respetar estas decisiones. Verificar siempre filtrado por `workspace_id` en endpoints. Mantener billing desacoplado del proveedor. No prometer offline en la landing salvo que la PWA lo soporte. Antes de codear en clozr-web, leer las guías de Next 16 en node_modules como pide su AGENTS.md.
