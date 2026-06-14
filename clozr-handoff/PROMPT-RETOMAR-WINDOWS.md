# Prompt para RETOMAR Clozr en Windows

Abrí Claude Code en la carpeta del repo `clozr-web` (después de clonarlo) y pegá el bloque de abajo.

## Antes de pegar
```
git clone https://github.com/manw3b/clozr-web.git
git clone https://github.com/manw3b/clozr.git
cd clozr-web && npm install
npx wrangler login            # la auth de wrangler es por máquina
```

## ✂️ PROMPT (copiá desde acá)

```
Retomo el proyecto Clozr en una máquina Windows nueva. Sos mi pareja de desarrollo.

PRIMERO leé estos archivos para tener todo el contexto (no asumas, verificá):
- clozr-handoff/LEEME-MIGRACION-WINDOWS.md  (estado completo + roadmap + infra)
- clozr-handoff/memory/clozr-web-pivot.md   (decisiones acordadas — respetalas)
Y guardá esos .md en tu memoria persistente de este proyecto.

QUÉ ES: Clozr, CRM SaaS para PyMEs/equipos de venta LATAM (español, precio local).
Webapp LIVE en https://www.clozr.online. Frontend Next.js 16 (este repo, en Vercel).
Backend = Cloudflare Worker reusado del repo manw3b/clozr (carpeta cf-worker) + Turso + R2.

YA HECHO (no rehacer):
- Login con Google: LIVE y probado end-to-end.
- AI Triage matutino: cron del Worker + 1 llamada a Claude Haiku que redacta follow-ups de
  leads estancados (clozr/cf-worker/src/cron/aiTriage.ts). Secret ANTHROPIC_API_KEY cargado.
- Logo real de Clozr en landing + sidebar + favicon.
- Vista VENTAS portada de la desktop a la webapp (KPIs, tabla, alta con ítems y cobro
  total/parcial/fiado, detalle con registro de pago y borrado). Solo ARS por ahora.
- Skills de proyecto (.claude/skills/, viajan por git): clozr-endpoint, clozr-multitenant-audit,
  clozr-release, clozr-feature, clozr-ai-triage. Invocables con /nombre.

PRIMERA TAREA — seguridad (URGENTE): rotar las credenciales que se pegaron en el chat de la
sesión anterior. La ANTHROPIC_API_KEY es la prioridad (gasto directo). Pasos:
  1. console.anthropic.com → API Keys → borrar la vieja → crear nueva.
  2. cd ../clozr/cf-worker && printf '%s' "NUEVA_KEY" | npx wrangler secret put ANTHROPIC_API_KEY
  3. (menos urgente) rotar también GOOGLE_CLIENT_SECRET en Google Cloud Console + wrangler secret put.

DESPUÉS — seguir la paridad con la desktop (roadmap en el handoff, sección 8). La webapp tiene
4 de 11 vistas. Próxima sugerida: TAREAS (uso diario + ahí se ven las tasks del AI Triage,
template_id='ai-triage'). Luego: Mi Día, Caja, Inventario, Equipo, Ajustes, Reportes, Deudas.

CÓMO TRABAJAR:
- Para portar una vista: mirá la pantalla en clozr/src/pages|features/, reusá la UI, cambiá la
  data a clozr-web/src/lib/api.ts (fetch al Worker). Si falta backend, usá el skill clozr-endpoint.
- Golden rules: filtrar SIEMPRE por workspace_id; tokens/estilos (nada hardcodeado); mappers
  snake↔camel en api.ts; no manejo de errores redundante.
- Next 16 tiene breaking changes: leé node_modules/next/dist/docs/ antes de codear (lo pide AGENTS.md).
- No commitees ni pushees sin que te lo pida. Secretos nunca en el repo (van como wrangler secret).
- Build de prod: cd clozr-web && npm run build. Worker: cd clozr/cf-worker && npx wrangler deploy.

Arrancá leyendo el handoff y confirmame el estado real (git log de ambos repos + que el login con
Google y la vista Ventas siguen funcionando), y después vamos con la rotación de credenciales.
```

## Versión corta (si solo querés arrancar rápido)
```
Retomo Clozr en Windows. Leé clozr-handoff/LEEME-MIGRACION-WINDOWS.md y
clozr-handoff/memory/clozr-web-pivot.md, guardalos en tu memoria, y decime el estado real.
Primera tarea: rotar la ANTHROPIC_API_KEY (se expuso en el chat anterior). Después seguimos
portando vistas de la desktop (próxima: Tareas).
```
