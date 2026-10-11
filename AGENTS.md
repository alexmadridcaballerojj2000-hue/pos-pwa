# pos-pwa — Instrucciones para agentes

## Qué es este proyecto
PWA de punto de venta (POS) **offline-first**, adaptable a distintos nichos. Este repositorio es **solo frontend**. El backend se construye por separado y se integra mediante el contrato de `docs/API_CONTRACT.md`.

## Documentos (léelos antes de planear)
- `docs/SPEC.md` — producto, arquitectura, modelo de datos y reglas de negocio.
- `docs/API_CONTRACT.md` — contrato con el backend (sync, auth).
- `docs/BACKLOG.md` — sprints, tareas y criterios de aceptación.

**Trabaja UN sprint por conversación.** Si algo del spec es ambiguo, pregunta; no inventes reglas de negocio.

## Stack fijo (no cambiar sin aprobación explícita)
TypeScript (strict) · React 19 · Vite · vite-plugin-pwa (`injectManifest`) · Dexie 4 · Zustand · React Router · React Hook Form + Zod · Tailwind CSS + shadcn/ui · date-fns · MiniSearch · Vitest + fast-check + Testing Library · Playwright · pnpm.
Usa siempre la última versión estable y deja versiones fijadas en el lockfile.

## Reglas innegociables
1. **Dinero = enteros en unidad menor** (centavos). Prohibido `float` para dinero. **Cantidades = enteros en milésimas** (1 unidad = 1000).
2. `src/domain` es TypeScript puro: sin React, sin Dexie, sin `fetch`, sin `Date.now()` directo (usar `Clock` inyectado).
3. Ningún componente toca Dexie directamente: solo repositorios de `src/data`.
4. Ventas, pagos, movimientos de inventario/caja y auditoría son **inmutables**: nunca UPDATE/DELETE; se corrigen con un documento inverso.
5. Toda escritura de negocio crea su evento en `outbox` dentro de **la misma transacción** Dexie.
6. IDs: **UUIDv7 generados en el cliente**. La venta genera su `id` al iniciar el cobro (idempotencia).
7. El flujo de venta funciona **100 % sin red**. Nada del flujo de venta puede depender de `fetch`.
8. Nunca almacenar ni registrar datos de tarjeta (PAN, CVV, pista). Tarjeta = solo método + referencia.
9. Textos de UI en español vía i18n (sin strings hardcodeados en componentes). Código, identificadores y commits en inglés.
10. No agregar librerías nuevas sin justificarlas en el plan de implementación.
11. No usar `localStorage` para datos de negocio (solo preferencias de UI triviales). Los datos van en Dexie.

## Flujo de trabajo
1. Antes de escribir código, genera el **Implementation Plan** y espera aprobación.
2. Tareas pequeñas; **un commit por tarea** (Conventional Commits, en inglés).
3. Una tarea no está terminada sin: `pnpm lint && pnpm typecheck && pnpm test` en verde **y** criterios de aceptación cumplidos.
4. Lógica de dominio: pruebas unitarias **y** property-based (fast-check) obligatorias.
5. Cambios en `docs/`: proponerlos, no aplicarlos en silencio.
6. Al cerrar cada tarea, resume qué hiciste, qué probaste y qué queda pendiente.

## Comandos
`pnpm dev` · `pnpm build` · `pnpm preview` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm e2e`

## UX
Táctil primero (targets ≥ 48 px), atajos de teclado en escritorio, accesibilidad nivel AA, tema claro/oscuro, español por defecto.
