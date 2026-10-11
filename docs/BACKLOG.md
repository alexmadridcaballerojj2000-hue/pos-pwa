# BACKLOG — POS PWA

Un sprint = un fin de semana de trabajo. **Una conversación de agente por sprint.** Cada tarea termina con commit propio y con `pnpm lint && pnpm typecheck && pnpm test` en verde.

## Definición de terminado (aplica a TODA tarea)
- Cumple los criterios de aceptación listados.
- Pruebas escritas (unitarias; property-based si es dominio; e2e si es flujo crítico).
- Sin `any` implícito, sin `// @ts-ignore`, sin strings de UI hardcodeados.
- No rompe el modo offline.
- Commit en Conventional Commits, en inglés.
- Resumen final del agente: qué hizo, qué probó, qué falta.

## Plantilla de prompt para cada sprint
```
Lee AGENTS.md, docs/SPEC.md y la sección del sprint <SX> de docs/BACKLOG.md.
Objetivo: completar el sprint <SX>.
1) Genera un Implementation Plan con las tareas en orden, archivos que tocarás y pruebas que escribirás. Espera mi aprobación.
2) Ejecuta una tarea a la vez, con un commit por tarea.
3) Al terminar cada tarea corre lint, typecheck y tests, y dime el resultado.
4) Si algo del spec es ambiguo, pregunta antes de decidir.
No agregues librerías fuera del stack sin justificarlo en el plan.
```

## Matriz de pruebas manuales por hito
Chrome (Windows) · Edge (Windows) · Chrome (Android, app instalada) · Safari (iOS, agregada a pantalla de inicio) · Firefox (básico). Siempre probar además **modo avión**.

---

## S0 — Fundamentos
**Tareas**
- S0-T1 Proyecto Vite + React + TS `strict`, pnpm, ESLint, Prettier, Vitest, Playwright, Husky + lint-staged, Conventional Commits.
- S0-T2 Estructura de carpetas de SPEC §4, alias `@/`, y regla `no-restricted-imports` que impida importar `react`, `dexie` o `fetch` dentro de `src/domain`.
- S0-T3 Tailwind + shadcn/ui, tema claro/oscuro, layout responsive con navegación (Venta, Catálogo, Turnos, Inventario, Reportes, Ajustes).
- S0-T4 PWA: manifest, íconos placeholder, SW con `injectManifest` y precache, página offline, registro con `prompt`.
- S0-T5 i18n en español y utilidad de formato de moneda con `Intl`.
- S0-T6 GitHub Actions (lint, typecheck, test, build) y despliegue de vista previa con HTTPS.
- S0-T7 Prueba: instalar en Android y escritorio; abrir en modo avión.

**Aceptación:** pipeline verde; app instalable; abre offline tras la primera carga; ESLint bloquea imports prohibidos en `domain`.

---

## S1 — Dominio (dinero, impuestos, descuentos, carrito)
**Tareas**
- S1-T1 `ids.ts` (UUIDv7) y `clock.ts` (interfaz `Clock`, `SystemClock`, `FakeClock`).
- S1-T2 `money.ts`: tipos `Minor`, `Milli`, `Bp`; `roundHalfUp`, `mulDivRound`, `allocate` (mayor residuo).
- S1-T3 `tax.ts`: impuesto incluido y excluido según SPEC §6.2.
- S1-T4 `discount.ts`: descuento de línea y de orden con prorrateo.
- S1-T5 `cart.ts`: reductor puro (agregar, cambiar cantidad, quitar, descuentos, notas) que produce líneas y totales con la forma de `Sale`.
- S1-T6 `payments.ts`: validar pagos, calcular vuelto, pagos divididos.
- S1-T7 Casos dorados de SPEC §6.2 y pruebas property-based de las invariantes.

**Aceptación:** cobertura de `domain` ≥ 95 %; todos los casos dorados pasan; las invariantes se sostienen con ≥ 1000 casos aleatorios; el resultado no depende del orden de líneas.

---

## S2 — Capa de datos y acceso local
**Tareas**
- S2-T1 Esquema Dexie v1 (SPEC §5.4) con marco de migraciones.
- S2-T2 Interfaces de repositorio en `domain/ports` y sus implementaciones Dexie; pruebas con `fake-indexeddb`.
- S2-T3 `withTx`: una transacción que escribe entidad + movimientos derivados + `outbox` + `auditLog`. Prueba de atomicidad (si falla una parte, no se escribe nada).
- S2-T4 `meta`: `deviceId`, `series`, contador `saleSeq` atómico.
- S2-T5 Wizard de primer arranque: negocio, moneda y decimales, precios con/sin impuesto, impuestos iniciales, usuario dueño con PIN, modo `local`.
- S2-T6 Login por PIN (PBKDF2 WebCrypto), bloqueo por intentos, bloqueo automático por inactividad, guardia de permisos `can(user, permission)` y diálogo de aprobación de gerente.
- S2-T7 Pantalla de Diagnóstico (esqueleto): versión, estado de almacenamiento, pendientes del outbox.

**Aceptación:** dos ventas simultáneas nunca repiten número; login offline funciona; un fallo forzado dentro de `withTx` no deja datos parciales; permisos cubiertos por pruebas.

---

## S3 — Catálogo, clientes y ajustes
**Tareas**
- S3-T1 CRUD de productos: lista, búsqueda, filtros, múltiples códigos de barras, categoría, impuesto, unidad y cantidad fraccionaria.
- S3-T2 Categorías (árbol simple) e impuestos.
- S3-T3 Definiciones de campos personalizados y formulario dinámico que las use.
- S3-T4 Importación CSV con vista previa, validación fila a fila y reporte de errores.
- S3-T5 Índice de búsqueda en memoria (MiniSearch) reconstruido al inicio y actualizado con cada cambio.
- S3-T6 CRUD de clientes.
- S3-T7 Ajustes: negocio, moneda, métodos de pago, límite de descuento, módulos (flags), plantilla de recibo básica.
- S3-T8 Script de seed (`pnpm seed`) con 10 000 productos para pruebas de rendimiento.

**Aceptación:** búsqueda < 50 ms con 10 000 productos; importar 1 000 filas < 3 s; los campos personalizados aparecen en el formulario y se guardan en `custom`.

---

## S4 — Pantalla de venta
**Tareas**
- S4-T1 Layout de dos paneles (móvil: pestañas), cuadrícula de productos por categoría y buscador (F2).
- S4-T2 Hook `useBarcodeScanner` (ráfagas < 35 ms + Enter) con pruebas.
- S4-T3 Carrito conectado al reductor del dominio: cantidad con teclado numérico, quitar, nota por línea.
- S4-T4 Descuento de línea y de orden con verificación de permiso/límite y aprobación de gerente.
- S4-T5 Selector de cliente.
- S4-T6 Retener y retomar carritos (`heldCarts`); autoguardado con debounce; recuperación tras recargar.
- S4-T7 Atajos de teclado y foco correcto tras escanear.

**Aceptación:** agregar al carrito < 100 ms; recargar la página no pierde el carrito; escanear 10 productos en rápida sucesión los agrega todos; descuentos sobre el límite exigen aprobación.

---

## S5 — Cobro y comprobante
**Tareas**
- S5-T1 Pantalla de cobro: teclado numérico, botones de efectivo rápido (exacto, siguientes denominaciones), pagos divididos, vuelto visible.
- S5-T2 Completar venta con `withTx`: crea `Sale`, incrementa número, agrega movimientos de stock, evento en `outbox` y auditoría. El `id` de la venta se genera al abrir el cobro; el botón se bloquea mientras se procesa.
- S5-T3 Definición de `ReceiptDoc` (representación intermedia) y renderizador HTML a 58/80 mm.
- S5-T4 Vista de comprobante en pantalla.
- S5-T5 Historial de ventas con filtros y detalle.
- S5-T6 Pruebas e2e: venta en efectivo, venta dividida, venta con descuento.

**Aceptación:** cerrar la pestaña en medio del cobro no deja una venta parcial; doble clic no duplica la venta; 100 ventas seguidas < 300 ms cada una; totales del recibo coinciden con el dominio.

---

## S6 — Impresión y hardware
**Tareas**
- S6-T1 Encoder ESC/POS en TS puro (`init`, alineación, negrita, tamaño, corte, cajón, página de códigos, código de barras, QR) con **pruebas de bytes esperados**.
- S6-T2 Renderizador `ReceiptDoc → ESC/POS`.
- S6-T3 `WebUsbTransport` y `WebSerialTransport` con detección de características; selección y recuerdo del dispositivo.
- S6-T4 Ajustes de impresora: ancho de papel, corte, cajón, página de códigos; botón de prueba de impresión y apertura de cajón.
- S6-T5 `BrowserPrinter` como respaldo automático cuando no hay USB/Serial.
- S6-T6 Reimpresión desde historial (auditada).
- S6-T7 `docs/HARDWARE.md` con los modelos probados, hallazgos y configuración recomendada.

**Aceptación:** imprime en al menos una impresora térmica real (Chrome en Windows o Android) con tildes y ñ correctas; abre el cajón; en Safari cae al respaldo del navegador sin errores.

---

## S7 — Turnos, caja y auditoría
**Tareas**
- S7-T1 Apertura de turno con fondo inicial; un solo turno abierto por dispositivo.
- S7-T2 Entradas y salidas de efectivo con motivo.
- S7-T3 Cierre con arqueo (opción de conteo ciego), cálculo de esperado y diferencia según SPEC §6.5.
- S7-T4 Reporte Z imprimible por el pipeline de recibos.
- S7-T5 Exigir turno para vender según `requireShift`.
- S7-T6 Visor de auditoría para gerente/dueño con filtros.

**Aceptación:** la fórmula de `expectedCash` está cubierta por pruebas con varios escenarios (ventas mixtas, vuelto, devoluciones); no se puede abrir un segundo turno; el reporte Z coincide con el historial.

---

## S8 — Inventario, devoluciones y anulaciones
**Tareas**
- S8-T1 Vista de stock derivado de movimientos; `stockLevels` como caché reconstruible con comando de reparación.
- S8-T2 Ajustes de inventario con motivo, conteo de inventario simple y alertas de stock bajo.
- S8-T3 Anulación de venta (aprobación de gerente + motivo) según SPEC §6.7.
- S8-T4 Devoluciones parciales con límite de cantidad y método de reembolso.
- S8-T5 Efecto correcto en inventario y caja; recibos de devolución/anulación.

**Aceptación:** propiedad "venta + anulación = estado inicial" para stock y caja; no se puede devolver más de lo vendido; la venta original nunca se modifica.

---

## S9 — Sincronización
**Tareas**
- S9-T1 `src/sync/contract.ts` con esquemas Zod de todo `docs/API_CONTRACT.md` y comando `pnpm gen:openapi` → `docs/openapi.yaml`.
- S9-T2 Interfaz `SyncTransport` y `MockTransport` (servidor falso en Dexie aparte, con latencia, fallos y timeouts configurables).
- S9-T3 `SyncEngine`: disparadores, lote de 100, backoff con jitter, un solo ejecutor con Web Locks, estados.
- S9-T4 `HttpTransport` (fetch, refresh de token, cabeceras del contrato, `Idempotency-Key`).
- S9-T5 Pull con cursor y aplicación transaccional de datos de referencia (LWW por versión, tombstones).
- S9-T6 Indicador de estado (sincronizado / pendiente N / sin conexión / error) y Diagnóstico ampliado: eventos `dead` con reintentar y exportar.
- S9-T7 "Exportar pendientes" (JSON) y cálculo de `serverOffsetMs`.
- S9-T8 Pruebas: 20 ventas offline → reconectar → todas llegan una sola vez; reenvío duplicado; caos con fallos aleatorios.

**Aceptación:** exactamente-una-vez contra el `MockTransport` bajo fallos aleatorios; un evento inválido queda `dead` y visible; cursor no avanza si la transacción falla.

---

## S10 — Reportes y endurecimiento de PWA
**Tareas**
- S10-T1 Reportes: resumen diario, por producto, por categoría, por método de pago, por cajero y por turno; rango de fechas; exportación CSV.
- S10-T2 Flujo de actualización seguro (aplicar solo sin carrito/cobro en curso).
- S10-T3 `navigator.storage.persist()`, estimación de almacenamiento y avisos en Diagnóstico.
- S10-T4 Banner de instalación para iOS y para navegadores compatibles.
- S10-T5 Guardia de múltiples pestañas.
- S10-T6 `ErrorBoundary` global y registro local de errores.
- S10-T7 Auditoría de rendimiento y accesibilidad; cumplir presupuestos de SPEC §13.

**Aceptación:** una actualización nunca interrumpe una venta; reportes cuadran con ventas e inventario; Lighthouse móvil ≥ 85 en rendimiento y ≥ 95 en accesibilidad.

---

## S11 — Módulos por nicho, QA y piloto
**Tareas**
- S11-T1 Registro de módulos con puntos de extensión (`posLineExtras`, `productFormFields`, `receiptBlocks`, `reportWidgets`, `paymentExtras`) y flags en Ajustes.
- S11-T2 Módulo demostrativo "Propina y notas de línea" que ejercite al menos tres puntos de extensión sin modificar el núcleo.
- S11-T3 Suite e2e del camino crítico: primer arranque → turno → venta → impresión (mock) → cierre → sync.
- S11-T4 Plan de QA manual con la matriz de navegadores y correcciones.
- S11-T5 Lista de verificación de piloto: datos reales, respaldo, capacitación de un cajero, plan de rollback.

**Aceptación:** activar/desactivar el módulo no requiere cambios en el núcleo; el e2e crítico corre en CI; el piloto tiene lista de verificación firmada.
