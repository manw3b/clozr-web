# Adoptar "Superpowers" en clozr-web — análisis y plan

> Análisis de **[obra/superpowers](https://github.com/obra/superpowers)** y cómo
> implementarlo en este repo. Escrito como handoff: el chat nuevo (web-only)
> puede ejecutar este plan.

## Qué es Superpowers (en criollo)

Es **una metodología de desarrollo para agentes de IA**, empaquetada como un set
de *skills* componibles + instrucciones de arranque. La creó Jesse Vincent
(`obra`). No es una librería de código que importás: es un **plugin de Claude
Code** (también soporta Cursor, Gemini CLI, Codex, etc.) que, vía un hook de
session-start, hace que el agente **chequee si hay una skill relevante antes de
cada tarea** y siga un flujo ordenado en vez de improvisar.

Filosofía: *procesos sistemáticos > soluciones ad-hoc*, test-first, simplicidad,
y "verificación como prueba de éxito". Trata los flujos como **obligatorios, no
sugerencias** (con "HARD-GATES": p. ej. no implementar hasta que el diseño esté
aprobado).

### Las skills que trae

**Testing y calidad**
- `test-driven-development` — ciclo RED-GREEN-REFACTOR.
- `systematic-debugging` — análisis de causa raíz en 4 fases.
- `verification-before-completion` — probar antes de declarar "listo".

**Colaboración y planificación**
- `brainstorming` — refinar el diseño antes de tocar código (con HARD-GATE de
  aprobación).
- `writing-plans` / `executing-plans` — descomponer en tareas y ejecutarlas.
- `subagent-driven-development` — delegar en subagentes con revisión en dos
  etapas (spec, después calidad).
- `requesting-code-review` / `receiving-code-review`.
- `using-git-worktrees` — ramas en paralelo.
- `finishing-a-development-branch`.
- `dispatching-parallel-agents` — fan-out de subagentes.

**Meta**
- `writing-skills` — crear skills nuevas con buenas prácticas.
- `using-superpowers` — introducción al sistema.

### Cómo se instala (Claude Code)

```
# Marketplace oficial
/plugin install superpowers@claude-plugins-official

# o el marketplace propio de Superpowers
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

> Ojo: instalar el plugin afecta el **entorno de Claude Code del dueño** (es
> global), no el repo. Para que viaje con el proyecto hay que **vendorizar**
> skills adaptadas en `.claude/skills/` (ver abajo).

## Cómo encaja con clozr

Clozr **ya usa el sistema de skills**: en `.claude/skills/` están `clozr-ui`
(portar/construir vistas con el design system) y `clozr-endpoint` (consumir un
recurso nuevo de la API). El repo `clozr` (escritorio/worker) tiene más
(`clozr-feature`, `clozr-release`, `clozr-multitenant-audit`, etc.).

Esas son skills **de dominio** (cómo hacer una cosa de Clozr). Superpowers aporta
skills **de proceso** (cómo trabajar: planificar, verificar, revisar). Son
complementarias: no se pisan.

El flujo actual de clozr-web ya es, informalmente, medio "superpowers":
fase concreta → `tsc --noEmit` + `next build` (verificación) → PR → merge a
`main` → Vercel. Y ya se usaron subagentes para auditorías (ej. el barrido de
US$ en el escritorio). Adoptar Superpowers es **formalizar y subir el piso** de
eso, sin romper el estilo "fase por fase".

## Plan de adopción (web-only)

### Recomendación: híbrido

1. **Instalar el plugin** (un comando) para tener la metodología y los updates.
2. **Vendorizar y adaptar 2–3 skills de mayor leverage** a `.claude/skills/`,
   tuneadas al flujo ship-to-prod y al estilo del dueño (español, fase por
   fase, decisiones rápidas). Así viajan con el repo y quedan "a la clozr".

### Mapeo skill por skill (qué hacer con cada una)

| Skill | Veredicto | Nota para clozr-web |
|---|---|---|
| `verification-before-completion` | **Adoptar** | Ya se hace. Tunear el gate a `npx tsc --noEmit` **+** `npm run build` antes de todo merge. Candidata #1 a vendorizar. |
| `writing-plans` / `executing-plans` | **Adoptar** | Calza perfecto con "fase por fase". Un plan corto por fase, ejecutado y shippeado. |
| `brainstorming` | **Adaptar** | Úsala para fases **grandes/ambiguas** (rediseños, decisiones de modelo). **Suavizar el HARD-GATE**: el dueño decide rápido y quiere avanzar; no frenar cada micro-cambio esperando "aprobación de diseño". |
| `subagent-driven-development` / `dispatching-parallel-agents` | **Adoptar** | Para **auditorías y búsquedas amplias** (como el barrido de US$). No para "un subagente por feature": acá es 1 dev shippeando a prod. |
| `systematic-debugging` | **Adoptar** | Encaja siempre; barata de adoptar. |
| `requesting/receiving-code-review` | **Adaptar** | El harness ya trae `/code-review`. Correr review sobre el diff **antes** del PR para fases sensibles (plata, multi-tenant). |
| `finishing-a-development-branch` | **Adaptar** | Mapear "cerrar branch" a **PR + merge a `main`** (Vercel deploya). No hay paso de release manual en web. |
| `writing-skills` | **Adoptar** | Para crear skills clozr nuevas (ideas abajo). |
| `using-superpowers` / meta | **Adoptar** | Gratis. |
| `test-driven-development` | **Postergar** | **La web no tiene harness de tests** (el escritorio usa vitest; la web solo tiene el build como gate). TDD real requiere montar **vitest + React Testing Library** primero. Hasta entonces, `verification-before-completion` (typecheck + build) hace de red de seguridad. |
| `using-git-worktrees` | **Opcional** | El flujo es una branch asignada por el harness + PR/merge. Los worktrees sirven para trabajo **paralelo**; no es el caso típico acá. Dejar como opt-in. |

### Caveats / fricciones a tener en cuenta

- Superpowers asume un flujo **completo y obligatorio**
  (`brainstorm → worktree → plan → subagentes → TDD → review → finish branch`).
  El de clozr es más liviano ("mejora concreta → ship"). **No imponer el peso
  completo**: tomar las piezas de alto valor (plan, verificación, brainstorming
  para lo grande, subagentes para auditorías) y dejar TDD/worktrees como opt-in.
- **TDD bloqueado por falta de harness en web.** Si se quiere de verdad, la
  primera "fase" es: agregar `vitest` + `@testing-library/react`, un script
  `test`, y un par de tests de humo (ej. `lib/format.ts`, `lib/api.ts` mappers).
- El plugin es **global** (entorno del dueño). Para que el proyecto sea
  self-contained, vendorizar las skills adaptadas en `.claude/skills/`.

### Formato de una skill (para adaptar)

Las skills de este repo y las de Superpowers son archivos `SKILL.md` con
frontmatter YAML. Mirá `.claude/skills/clozr-ui/SKILL.md` como referencia local.
Superpowers usa, además, un `description` imperativo ("You MUST use this
before…") y "HARD-GATES". Al adaptar: mantené el formato local, escribí el
contenido **en español/al estilo clozr**, y suavizá los gates a "recomendado,
salvo que el dueño diga avanzar".

### Ideas de skills clozr nuevas (con `writing-skills`)

- `clozr-deploy` — el ritual web: `tsc --noEmit` + `next build` → commit (español)
  → PR → merge `merge` → avisar hard-refresh. (Esto es `verification-before-
  completion` + `finishing-a-branch` fusionados y "a la clozr".)
- `clozr-money` — la regla de oro US$-nativo: `total_usd` fuente de verdad, ARS
  de referencia congelada, `dualUsd` en pantalla, fallback legacy. Para no
  re-explicar el modelo cada vez que se toca plata.

## Primer paso sugerido para el chat nuevo

1. `/plugin install superpowers@claude-plugins-official` (o el marketplace propio).
2. Vendorizar **`verification-before-completion`** adaptada como
   `.claude/skills/clozr-deploy/SKILL.md` (el gate típico de la web).
3. Probar el ciclo en la próxima fase real (p. ej. taller/reparaciones a US$):
   plan corto → ejecutar → verificar → PR → merge.

> El resto se adopta incremental: cada vez que una skill demuestre valor en una
> fase, se vendoriza tuneada. No hace falta traer las 13 de una.
