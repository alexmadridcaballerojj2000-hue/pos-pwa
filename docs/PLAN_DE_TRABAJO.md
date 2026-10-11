# PLAN DE TRABAJO — POS PWA

## Supuestos
- **Viernes por la noche:** 7:30 pm – 11:30 pm (4 h).
- **Sábado por la tarde y noche:** 2:00 pm – 10:00 pm (8 h).
- **Total:** ~12 h por fin de semana. Si tus horas reales cambian, se reajusta el calendario, no el orden de los sprints.
- El código lo genera principalmente Antigravity; tu trabajo es **dirigir, revisar, probar en dispositivos reales y decidir**.
- Solo frontend. El backend se hace aparte, en paralelo o después, siguiendo `docs/API_CONTRACT.md`.
- Las estimaciones son una guía: la velocidad del agente varía. Si un sprint se desborda, **se recorta alcance, nunca la calidad del núcleo** (dinero, impuestos, datos, sincronización).

---

## Semana 0 — Preparación (puede hacerse antes del viernes 25)
- [ ] Instalar Node LTS, pnpm, Git, Chrome y Edge.
- [ ] Instalar Antigravity y probar que abre una carpeta.
- [ ] Crear el repositorio en GitHub (privado) y clonarlo.
- [ ] Copiar al repo: `AGENTS.md` (raíz) y la carpeta `docs/` con `SPEC.md`, `API_CONTRACT.md` y `BACKLOG.md`.
- [ ] Cuenta en Cloudflare Pages, Netlify o Vercel para vistas previas con HTTPS.
- [ ] Un celular Android para pruebas (y un iPhone si tienes acceso).
- [ ] Idealmente, una impresora térmica USB de 80 mm con cajón (se necesita desde el sprint S6).
- [ ] Decidir nombre provisional del proyecto.

---

## Ritmo de cada fin de semana

**Viernes (4 h): planear y lanzar**
| Hora | Actividad |
|---|---|
| 7:30 – 8:00 | Leer el sprint en `docs/BACKLOG.md`; ajustar criterios si hace falta |
| 8:00 – 8:30 | Abrir conversación nueva en Antigravity, pegar la plantilla de prompt, pedir el Implementation Plan |
| 8:30 – 9:00 | Revisar y aprobar (o corregir) el plan |
| 9:00 – 11:00 | El agente ejecuta las primeras tareas; tú revisas diffs y pruebas a medida que terminan |
| 11:00 – 11:30 | Commit, push y nota de lo que quedó pendiente |

**Sábado (8 h): construir, revisar, probar**
| Hora | Actividad |
|---|---|
| 2:00 – 2:30 | Retomar: leer el estado, correr `pnpm lint && pnpm typecheck && pnpm test` |
| 2:30 – 6:00 | El agente completa las tareas restantes; revisión de cada commit |
| 6:00 – 7:00 | Descanso y cena |
| 7:00 – 9:00 | Pruebas manuales en dispositivos reales, incluido **modo avión** |
| 9:00 – 9:45 | Corregir hallazgos con el agente |
| 9:45 – 10:00 | Cierre: despliegue de vista previa, notas, **retrospectiva de 10 minutos** |

---

## Calendario

| # | Fin de semana | Sprint | Resultado al terminar |
|---|---|---|---|
| 1 | Vie 25 – Sáb 26 sep | **S0** Fundamentos | App instalable y abre offline; pipeline verde |
| 2 | Vie 2 – Sáb 3 oct | **S1** Dominio | Motor de dinero, impuestos y descuentos probado |
| 3 | Vie 9 – Sáb 10 oct | **S2** Datos y acceso | Base local, transacciones atómicas, login por PIN |
| 4 | Vie 16 – Sáb 17 oct | **S3** Catálogo y ajustes | Productos, clientes, CSV, búsqueda rápida |
| 5 | Vie 23 – Sáb 24 oct | **S4** Pantalla de venta | Carrito completo con escáner y carritos retenidos |
| 6 | Vie 30 oct – Sáb 31 oct | **S5** Cobro y comprobante | Se puede vender y ver el comprobante |
| 7 | Vie 6 – Sáb 7 nov | **S6** Impresión y hardware | Recibo impreso y cajón abierto en impresora real |
| 8 | Vie 13 – Sáb 14 nov | **S7** Turnos y caja | Apertura, cierre con arqueo y reporte Z |
| 9 | Vie 20 – Sáb 21 nov | **S8** Inventario y devoluciones | Stock correcto, anulaciones y devoluciones |
| 10 | Vie 27 – Sáb 28 nov | **S9** Sincronización | Sync exactamente-una-vez contra el mock; OpenAPI generado |
| 11 | Vie 4 – Sáb 5 dic | **S10** Reportes y PWA | Reportes, actualización segura, persistencia, iOS |
| 12 | Vie 11 – Sáb 12 dic | **S11** Módulos, QA y piloto | Registro de módulos, e2e crítico, checklist de piloto |
| 13 | Vie 18 – Sáb 19 dic | Colchón | Piloto real en un negocio y correcciones |

**Horas totales:** ~156 h (13 fines de semana × 12 h).

## Hitos
- **M1 · 10 oct:** dominio y datos sólidos (S1–S2). Sin esto no se avanza.
- **M2 · 7 nov:** se vende, cobra e imprime sin internet (S3–S6). Primera demo real.
- **M3 · 28 nov:** listo para conectarse al backend (S7–S9).
- **M4 · 12 dic:** listo para piloto (S10–S11).

## Backend en paralelo
El contrato ya está definido. Cuando quieras empezar el backend puedes hacerlo con `docs/API_CONTRACT.md`; el archivo `openapi.yaml` que genera el sprint S9 será la versión final. El frontend no depende del backend hasta la integración, porque trabaja contra el `MockTransport`.

---

## Cómo trabajar con Antigravity
1. Abrir la carpeta raíz del repositorio (no una carpeta superior). Antigravity carga `AGENTS.md` y las reglas del workspace automáticamente.
2. Una conversación nueva por sprint. Pegar la plantilla de prompt de `docs/BACKLOG.md`.
3. **Exigir el plan antes del código** y aprobarlo tú.
4. Revisar cada commit antes de seguir con la siguiente tarea.
5. Si el agente propone cambiar el stack o el spec, detenerlo y decidir tú.
6. Cerrar cada fin de semana con un push y una nota corta de "qué falta".

## Qué debes revisar siempre tú (no delegar)
- Todo lo de `src/domain` (dinero, impuestos, descuentos, pagos).
- Todo `withTx` y cualquier cosa que escriba en Dexie.
- Migraciones de esquema.
- Cualquier código de sincronización.
- Cualquier lugar donde aparezcan `float`, `Date.now()`, `localStorage` o `fetch` dentro del flujo de venta.
- Pruebas: que prueben comportamiento y no solo "que compile".

## Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| El agente inventa reglas de negocio | El spec manda; preguntar ante ambigüedad (regla 5 de `AGENTS.md`) |
| Errores de redondeo | Casos dorados y pruebas property-based desde S1 |
| Pérdida de datos en iOS/Safari | Persistencia solicitada, aviso de pendientes antiguos, exportar pendientes, instalación en pantalla de inicio |
| Impresora incompatible | Comprar/probar hardware antes de S6; respaldo por navegador; parámetros configurables |
| Sprint desbordado | Recortar alcance de lo no crítico y pasarlo al colchón |
| Cambio de alcance a mitad | Todo cambio entra al backlog del siguiente sprint, no al actual |
| Actualización de la PWA interrumpe una venta | Regla de aplicar solo sin carrito ni cobro en curso (S10) |

## Si te atrasas
Prioridad de recorte, de lo primero a lo último: reportes avanzados → módulo demostrativo → importación CSV → alertas de stock → conteo de inventario. **Nunca se recorta:** dominio, transacciones atómicas, inmutabilidad, outbox y pruebas.
