# Prompt para arrancar un proyecto nuevo con Claude Code

Pegá el bloque de abajo en una sesión NUEVA de Claude Code, **abierta en la carpeta vacía**
donde querés que viva el proyecto. Reemplazá lo que está `[ENTRE CORCHETES]`.

---

## ✂️ PLANTILLA (copiá desde acá)

```
Quiero arrancar un proyecto nuevo desde cero y que trabajemos como pareja de desarrollo.
Antes de escribir una sola línea de código, entrevistame y dejá todo encuadrado.

CONTEXTO DEL PROYECTO
- Qué es: [una frase — ej. "una webapp para gestionar turnos de peluquerías"]
- Para quién: [usuario/mercado — ej. "PyMEs LATAM, en español, precio en moneda local"]
- Problema que resuelve / wedge: [ej. "reemplazar el cuaderno y los WhatsApp sueltos"]
- Monetización (si aplica): [ej. "SaaS suscripción mensual" / "gratis por ahora"]
- Restricciones conocidas: [ej. "tengo que poder cobrar desde Argentina"]

STACK Y PREFERENCIAS
- Stack que quiero (o "recomendame vos"): [ej. "Next.js + TS + Tailwind + shadcn/ui;
  backend Cloudflare Worker + Turso; deploy en Vercel"]
- Reusar de proyectos previos: [ej. "el patrón de auth/worker de Clozr" o "nada, de cero"]
- Idioma del producto y del código/comentarios: [ej. "producto en español rioplatense,
  comentarios en español"]

CÓMO QUIERO QUE TRABAJES
1. Primero HACEME PREGUNTAS (máx. 5-6) para cerrar lo que falte. No asumas.
2. Después proponé un PLAN por fases (entrá en plan mode) y esperá mi OK antes de codear.
3. Cuando arranquemos:
   - Inicializá git y creá el repo en GitHub (público, salvo que diga lo contrario).
   - Creá un AGENTS.md (o CLAUDE.md) con las reglas y "golden rules" del proyecto.
   - Guardá en tu MEMORIA persistente: qué es el proyecto, decisiones acordadas
     (type: project) y mis preferencias de trabajo (type: feedback). Mantenela al día.
   - Si hay tareas repetitivas con reglas estrictas, proponé SKILLS de proyecto
     (.claude/skills/) que viajen por git.
4. Reglas de oro de estilo: tokens/variables, nada hardcodeado; capa de datos centralizada;
   no agregar manejo de errores redundante; el schema solo crece (migraciones idempotentes).
5. Seguridad desde el día 1: si es multi-tenant, TODO endpoint filtra por el id de tenant.
6. No commitees ni pushees sin que te lo pida. Nunca pongas secretos en el repo
   (van como variables de entorno / secrets del proveedor).

OBJETIVO DE ESTA SESIÓN
[ej. "tener el scaffold corriendo localmente + landing mínima + repo en GitHub"]

Arrancá con las preguntas.
```

---

## Cómo usarlo
- **Sesión limpia, carpeta vacía.** Abrí Claude Code en el directorio nuevo (no dentro de otro repo).
- Borrá las secciones que no apliquen (ej. si no hay monetización).
- Si querés que reuse el backend de Clozr, dejá clonado `clozr` al lado y mencionalo en
  "Reusar de proyectos previos".
- Después del primer arranque, en futuras sesiones alcanza con: *"retomemos, leé tu memoria"*.

## Por qué este prompt funciona (lo que codifica de cómo trabajamos en Clozr)
- **Descubrir antes de codear** → evita construir lo equivocado.
- **Plan mode + OK** → vos aprobás el rumbo antes de gastar tiempo.
- **Memoria desde el día 1** → cada sesión arranca con contexto, no de cero.
- **AGENTS.md + golden rules** → consistencia (mappers, tokens, multi-tenant, etc.).
- **Skills de proyecto** → empaquetan tareas repetitivas y viajan por git entre máquinas.
- **Git/GitHub temprano + sin secretos en el repo** → higiene y portabilidad (Ubuntu↔Windows).
```
