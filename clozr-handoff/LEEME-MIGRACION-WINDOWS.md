# Migración de Clozr a Windows — Handoff para Claude Code

Generado el 2026-06-14 desde el entorno Linux. Esta carpeta contiene la **memoria persistente**
que Claude Code venía usando, para que en Windows arranques con todo el contexto.

---

## 1. Qué hay en esta carpeta

```
clozr-handoff/
├── LEEME-MIGRACION-WINDOWS.md   ← este archivo
└── memory/
    ├── MEMORY.md                ← índice de memoria (se carga cada sesión)
    ├── clozr-web-pivot.md       ← estado COMPLETO del pivote a webapp (lo importante)
    └── project_clozr.md         ← ficha del proyecto Clozr (CRM)
```

El archivo clave es **`memory/clozr-web-pivot.md`**: tiene el estado exacto de la webapp,
las decisiones acordadas y el punto donde retomar (el "⏯️ RETOMAR ACÁ").

---

## 2. Cómo cargar la memoria en Claude Code (Windows)

Claude Code guarda la memoria por proyecto en:

```
C:\Users\<TU_USUARIO>\.claude\projects\<carpeta-del-proyecto>\memory\
```

El nombre `<carpeta-del-proyecto>` lo deriva Claude Code del directorio de trabajo
(por ejemplo, si trabajás en `C:\Users\tu\clozr-web`, será algo como `C--Users-tu-clozr-web`).

**Pasos:**
1. Abrí Claude Code una vez en la carpeta donde vayas a trabajar (ej. el repo `clozr-web`)
   para que cree la estructura `.claude\projects\<...>\memory\`.
2. Copiá los 3 archivos de `memory\` de esta carpeta dentro de esa ruta `memory\`.
3. Reiniciá la sesión de Claude Code. Al arrancar leerá `MEMORY.md` (el índice) y tendrá el contexto.

> Si no querés pelear con la ruta exacta: simplemente abrí esta carpeta `clozr-handoff`
> en Claude Code en Windows y deciles "leé `memory/clozr-web-pivot.md` y retomemos".
> Funciona igual aunque no esté en la ruta oficial de memoria.

---

## 3. Los repos (se clonan, no hace falta copiarlos a mano)

Ambos están en GitHub (cuenta `manw3b`), ya commiteados y pusheados:

- **Webapp (nuevo, lo activo):** https://github.com/manw3b/clozr-web  → `git clone` en Windows
- **App desktop + worker backend:** https://github.com/manw3b/clozr  (el backend vive en `cf-worker/`)

En Windows:
```
git clone https://github.com/manw3b/clozr-web.git
git clone https://github.com/manw3b/clozr.git
```
Después `cd clozr-web && npm install`. Dev server: `npm run dev` (puerto por defecto 3000).

> OJO (de `AGENTS.md` del repo): es Next.js 16 con breaking changes (`params` es Promise,
> hay `proxy` en vez de middleware). Antes de codear, leer las guías en `node_modules/next/dist/docs/`.

---

## 4. ⏯️ DÓNDE RETOMAR — Login con Google (verificado hoy 2026-06-14)

El **código** del login con Google está listo y commiteado (front y worker). Faltan **3 pasos manuales**.
Estado verificado hoy:

| Componente | Estado |
|---|---|
| Código front (botón "Continuar con Google" + manejo de `#token`) | ✅ commiteado y auto-deployado en Vercel |
| Código worker (`/auth/google/start` + `/callback`) | ✅ commiteado (commit `4319dcd`) |
| **Worker deployado con ese código** | ❌ NO — `/auth/google/start` da 404 en prod |
| Webapp en prod | ✅ LIVE en https://www.clozr.online |

**Pasos pendientes (hacelos en Windows con wrangler autenticado):**

1. **Google Cloud Console** → crear OAuth client:
   - Redirect URI: `https://clozr-auth.pyter-import.workers.dev/auth/google/callback`
   - Publicar la consent screen (scopes básicos email/profile/openid no requieren verificación de Google).
2. **Secrets del worker** (desde `clozr/cf-worker`):
   ```
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```
3. **Deploy del worker:**
   ```
   npx wrangler deploy
   ```
4. Verificar el flujo end-to-end: entrar a https://www.clozr.online → "Continuar con Google" → loguear.

---

## 5. Temas en cola (después de Google)

- **Abrir el login por email a todos:** hoy el magic-code solo llega a `pyter.import@gmail.com`
  (sandbox de Resend). Para abrirlo: verificar el dominio `clozr.online` en Resend + actualizar `RESEND_FROM` del worker.
- **Billing:** Mercado Pago (cobro en moneda local LATAM) o Lemon Squeezy (USD, merchant of record).
  Mantener capa desacoplada: webhook → flag de plan en Turso. Stripe NO sirve para vender desde Argentina.
- **PWA / móvil:** post-lanzamiento.

---

## 6. Infraestructura (referencia rápida)

- **Frontend:** Next.js 16 + TypeScript + Tailwind v4 (config CSS-first en `globals.css`) + App Router.
- **Hosting front:** Vercel (scope `clozr-s`, proyecto `clozr-web`, deploy auto por push a `main`).
- **Dominio:** `clozr.online` comprado en Hostinger; DNS apunta a Vercel. Usar `www.clozr.online` (el apex puede tardar en propagar).
- **Backend:** Cloudflare Worker en `https://clozr-auth.pyter-import.workers.dev` (API REST CRUD multi-tenant) + Turso (DB) + R2 (archivos).
- **Auth:** email passwordless (código de 6 dígitos) + (pronto) Google OAuth. JWT HS256 en `localStorage` (`clozr_jwt`, `clozr_ws`), header `Authorization: Bearer`.
- **Seguridad multi-tenant:** confirmada — cada handler valida membership y filtra por `workspace_id`.

> Para probar login real hoy: `pyter.import@gmail.com` (único email habilitado en Resend hasta verificar dominio).

---

## 7. Decisiones acordadas (no re-discutir)

- Backend: **REUSAR** el `cf-worker` + Turso. Solo se reescribe el frontend.
- Stack front nuevo: Next.js + TS + Tailwind + shadcn/ui (landing + app en un proyecto).
- Monetización: SaaS suscripción mensual (Free → Pro por usuario → Team por workspace).
- Mercado: PyMEs / equipos de venta LATAM, en español, precio local. Wedge = reemplazar Excel/WhatsApp.
- SMS/celular pospuesto (caro + fraude SMS-pumping); si se quiere "celular", usar WhatsApp más adelante.
