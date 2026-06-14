---
name: project-clozr
description: "CRM de escritorio Tauri+React para emprendedores latinoamericanos, activamente co-desarrollado con Claude Code"
metadata: 
  node_type: memory
  type: project
  originSessionId: b4202f7f-7beb-4cbe-8091-be370cfe8e62
---

Clozr es un CRM de escritorio local-first para emprendedores y pequeñas empresas (mercado latinoamericano, ARS/USD, interfaz en español). Repo: https://github.com/manw3b/clozr. Clonado en /home/pyter/clozr.

**Why:** Producto real en producción, no demo. 65+ releases, shipping diario con Claude Code como pair.

**Stack:** Tauri 2 (Rust wrapper mínimo) + React 18 + TypeScript 5 + Vite 6 + Zustand + TanStack Query + SQLite local + Cloudflare Workers + Turso (cloud opcional) + magic-link auth (Resend + JWT HS256).

**Versión actual:** v1.3.68 (29 mayo 2026)

**Patrones clave:**
- Local-first, cloud opcional por workspace (`isCloudModeFor(feature)`)
- Dos capas de tipos: domain (UI) ↔ DB raw, bridge en `src/lib/mappers.ts`
- Schema idempotente: `ensureSchema.ts` corre cada boot con `CREATE TABLE IF NOT EXISTS`
- Query keys centralizadas en `src/lib/queryKeys.ts` (`qk.*` + `invalidate.*`)
- Permisos en un solo lugar: `src/lib/permissions.ts` (compartido front+worker), función `can(role, perm)`
- Estilos via CSS tokens, nunca hex/px hardcodeados

**Últimas features activas:**
- Feature I: R2 cloud storage para logos/banners
- Feature J: Selector de rubro + modal "¿Sabías que…?"
- Feature K: Assigned tasks cloud + timezone ART + dispatch fixes

**Dev:** `npm run tauri dev` (Rust ~3min primera vez). Worker en `cf-worker/`, deploy con wrangler.

**How to apply:** Al sugerir cambios, respetar los golden rules del proyecto (mappers, qk.*, can(), tokens). No agregar manejo de errores redundante — QueryCache/MutationCache ya lo manejan. Schema solo crece, nunca se modifica retroactivamente.
