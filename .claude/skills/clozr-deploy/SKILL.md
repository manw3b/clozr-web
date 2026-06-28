---
name: clozr-deploy
description: El ritual de cierre de fase de clozr-web — verificar (tsc + build + tests en verde), commit en español, PR a main y merge (Vercel publica). Usar al "shippear", "deployar", "cerrar la fase", "mandar a prod", "hacer el PR", "mergear", o cada vez que una mejora esté lista para producción.
---

# clozr-deploy — cerrar una fase y mandarla a prod

Clozr se trabaja **fase por fase**: una mejora concreta → se shippea a producción → seguimos.
Esta skill es ese ritual, hecho siempre igual para que nada se escape. **Vercel publica `main` solo**:
el deploy ES el merge a `main`. No hay paso de release manual en la web.

> Regla de oro del flujo: **cada fase termina en producción**. No dejes ramas a medias.

## 0. Precondición — ¿está lista la fase?

El cambio tiene que estar terminado y tener sentido como unidad ("una mejora concreta"). Si la fase
fue grande o tocó plata/multi-tenant, considerá correr `/code-review` sobre el diff **antes** del PR.

## 1. Gate de verificación (NO negociable)

Los tres en verde, en este orden. Es el único "HARD-GATE" real de clozr-web:

```bash
npx tsc --noEmit     # tipos
npm run build        # gate real: Next corre TS ahí también
npm test             # vitest: funciones puras de plata/identidad (lib/format, lib/money, lib/types)
```

- Si algo falla, **se arregla antes de seguir**. No se commitea rojo.
- Si tocaste lógica de plata, que `npm test` cubra el caso nuevo (mirá `src/lib/money.ts` + sus tests).
  Si agregaste comportamiento sin test y es testeable en una función pura, **escribí el test** (TDD liviano).

## 2. Branch y commit

- Desarrollá SIEMPRE en la **branch que asigna el harness** (`claude/...`). **Nunca** pushees directo a `main`.
- Mensaje de commit **en español**, claro y descriptivo. Mirá `git log` para el estilo (título en minúscula,
  cuerpo explicando el porqué; si es una fase numerada, "(Fase X, web)"). Ejemplos reales del repo:
  - `caja en US$ y pesos por separado (Fase 5, web)`
  - `extraer la conversión a US$ a src/lib/money.ts (puro y testeado)`
- El harness ya agrega el footer `Co-Authored-By` / `Claude-Session`. Respetá ese footer si ya viene en el estilo.
- **NUNCA** incluyas el identificador del modelo en el commit, el PR ni el código. Va solo en el chat.

```bash
git add -A
git commit -F - <<'EOF'
<título en español, minúscula>

<por qué del cambio, qué resuelve, notas de comportamiento>
EOF
git push -u origin <branch-del-harness>
```

Si `git push` falla **por red**, reintentá con backoff: 2s → 4s → 8s → 16s (hasta 4 veces). Otros errores, no.

## 3. PR a `main`

Con la tool de GitHub (no `gh` CLI):

```
mcp__github__create_pull_request
  owner: manw3b   repo: clozr-web
  base: main      head: <branch-del-harness>
  title: <en español, descriptivo>
  body:  <Qué / Cambios / Verificación (tsc+build+test en verde)>
```

- No crees PR salvo que la fase esté lista (acá sí se pide: es el flujo de deploy).
- Si hay template de PR en `.github/`, espejá sus secciones. Hoy no hay → escribí el body normal.

## 4. Merge (esto ES el deploy)

```
mcp__github__merge_pull_request
  owner: manw3b   repo: clozr-web
  pullNumber: <n>   merge_method: "merge"
```

Siempre `merge` (no squash, no rebase) — es el método del repo.

## 5. Avisar al dueño

- Confirmá: **merged a `main`, Vercel publicando**.
- Pedile **hard-refresh** del navegador (si "algo sigue saliendo mal" después de un merge, casi siempre es
  cache del browser — recordá esto antes de ponerte a debuggear).
- Cerrá con una **recomendación del próximo paso** (una opción arriba). Si la decisión es del dueño
  (alcance/plata/algo irreversible), preguntá, pero con la opción recomendada primero.

## Checklist rápido

- [ ] `npx tsc --noEmit` verde
- [ ] `npm run build` verde
- [ ] `npm test` verde (con test del comportamiento nuevo si es plata)
- [ ] commit en español, sin identificador de modelo
- [ ] push a la branch del harness (no a `main`)
- [ ] PR a `main` (base `main`, head la branch)
- [ ] merge con `merge_method: "merge"`
- [ ] avisé merged + hard-refresh + próximo paso recomendado
