# API CONTRACT — PWA ⇄ Backend

Versión 0.1. El backend se construye por separado. Este documento es la frontera: el frontend se desarrolla contra un `MockTransport` que implementa exactamente esto, y el backend real debe cumplirlo.

Los payloads usan los tipos de `docs/SPEC.md` §5 sin cambios. En el sprint S9 el frontend genera `docs/openapi.yaml` (OpenAPI 3.1) a partir de los esquemas Zod de `src/sync/contract.ts`, y ese archivo pasa a ser la fuente de verdad.

---

## 1. Convenciones
- REST + JSON sobre HTTPS. Prefijo `/v1`. Fechas ISO 8601 UTC. IDs UUIDv7.
- Dinero en enteros de unidad menor; cantidades en milésimas (igual que SPEC).
- Auth: `Authorization: Bearer <accessToken>`.
- Cabeceras del cliente: `X-Device-Id`, `X-App-Version`, `X-Schema-Version`.
- Errores: `application/problem+json` (RFC 9457/7807) con `code` estable.
- Límite de tasa: `429` con `Retry-After`.

**Códigos de error (`code`)**
| code | HTTP | Significado | Reacción del cliente |
|---|---|---|---|
| `validation_error` | 422 | Payload inválido | Marcar evento `dead`, mostrar en Diagnóstico |
| `unauthorized` | 401 | Token vencido/ inválido | Refrescar token; si falla, pedir login (la venta sigue offline) |
| `forbidden` | 403 | Sin permiso | Mostrar error |
| `device_revoked` | 403 | Dispositivo dado de baja | Bloquear sincronización y avisar; no borrar datos |
| `version_unsupported` | 426 | Cliente demasiado viejo | Pedir actualizar la app; seguir vendiendo |
| `rate_limited` | 429 | Demasiadas solicitudes | Respetar `Retry-After` |
| `server_error` | 5xx | Falla del servidor | Reintentar con backoff |

---

## 2. Autenticación y dispositivos

### `POST /v1/auth/login`
Solicitud: `{ "email": "...", "password": "..." }`
Respuesta 200:
```json
{
  "accessToken": "...", "refreshToken": "...", "expiresIn": 900,
  "tenant": { "id": "…", "name": "Mi Negocio" },
  "stores": [{ "id": "…", "name": "Sucursal Centro" }]
}
```

### `POST /v1/auth/refresh`
`{ "refreshToken": "..." }` → misma forma que login (rotación de refresh token).

### `POST /v1/devices/register`
Solicitud: `{ "storeId": "…", "name": "Caja 1", "appVersion": "0.1.0" }`
Respuesta 201: `{ "deviceId": "…", "series": "A01" }`
La `series` es única por dispositivo y se usa para numerar ventas (`A01-000123`).

---

## 3. Sincronización

### `GET /v1/sync/pull?cursor=<opaco>&limit=500`
Devuelve cambios de **datos de referencia** ordenados por un `seq` monótono del servidor.
```json
{
  "changes": [
    { "entity": "product", "op": "upsert", "id": "…", "version": 7, "data": { "...Product..." } },
    { "entity": "taxRate", "op": "delete", "id": "…", "version": 3 }
  ],
  "nextCursor": "abc123", "hasMore": false, "serverTime": "2026-01-01T12:00:00Z"
}
```
- `entity` ∈ `product | category | taxRate | customer | user | settings | customFieldDef`.
- Primera llamada sin `cursor` = descarga completa.
- Los borrados llegan como tombstones (`op: "delete"`).
- El cliente aplica en una transacción y guarda `nextCursor` **solo si la transacción tuvo éxito**.
- Regla de merge en el cliente: gana la `version` más alta (LWW por versión).
- `user` incluye `pin.hash/salt/iterations` para permitir login offline. Nunca contraseñas.

### `POST /v1/sync/push`
Máximo 100 eventos por lote, ordenados por `deviceSeq`.
```json
{
  "deviceId": "…", "batchId": "…",
  "events": [
    {
      "eventId": "…UUIDv7…",
      "entity": "sale",
      "op": "create",
      "entityId": "…",
      "schemaVersion": 1,
      "deviceSeq": 1042,
      "occurredAt": "2026-01-01T11:59:31Z",
      "payload": { "...Sale..." }
    }
  ]
}
```
`entity` ∈ `sale | sale_void | sale_return | shift | cash_movement | inventory_adjustment | customer | audit`.

Respuesta 200 (siempre por evento):
```json
{
  "results": [
    { "eventId": "…", "status": "accepted", "serverId": "…" },
    { "eventId": "…", "status": "duplicate" },
    { "eventId": "…", "status": "rejected", "retryable": false,
      "error": { "code": "validation_error", "message": "…" } }
  ],
  "serverTime": "2026-01-01T12:00:03Z"
}
```

**Reglas obligatorias para el servidor**
1. **Idempotencia por `eventId`.** Reenviar el mismo evento devuelve `duplicate`, nunca crea otro registro.
2. **Nunca rechazar una venta ya cobrada por discrepancias de precio o total.** Si al recalcular no coinciden, se **acepta y se marca** (`discrepancy: true` + detalle) para revisión. Solo se rechaza por esquema inválido o falta de autorización.
3. Procesar los eventos del lote **en orden** de `deviceSeq`; tolerar dependencias fuera de orden entre lotes (p. ej. venta que llega antes que su turno) guardando y resolviendo después.
4. Validar que el `deviceId` pertenezca al tenant del token y no esté revocado.
5. Aislamiento por tenant (recomendado: Row Level Security en PostgreSQL).
6. El servidor guarda `receivedAt` propio; el `occurredAt` del cliente es informativo.

**Comportamiento del cliente**
- `accepted` o `duplicate` → evento `synced`.
- `rejected` con `retryable: false` → `dead` (visible en Diagnóstico, con reintentar y exportar). **Jamás se descarta en silencio.**
- Error de red, 5xx o 429 → reintento con backoff exponencial y jitter (1 s → tope 60 s).
- Si el lote completo falla, se reintenta el mismo lote (idempotente).

### Hora
`serverTime` en respuestas y el encabezado `Date` sirven al cliente para calcular `serverOffsetMs` (para diagnóstico y reportes; **no** para ordenar eventos).

---

## 4. Reserva de numeración fiscal (futuro, no implementar aún)
`POST /v1/fiscal/reserve-range` → `{ "series": "A01", "from": 1001, "to": 1100 }`.
Permite numerar offline con bloques asignados por el servidor. El campo `Sale.fiscal` queda reservado.

---

## 5. `MockTransport` (lo que debe construir el frontend)
Implementa la interfaz `SyncTransport` con las mismas semánticas:
- Estado del "servidor falso" persistido en una base Dexie aparte.
- Idempotencia por `eventId`, respuestas por evento, cursores, tombstones y versiones.
- Inyección configurable de **latencia**, **fallos aleatorios**, **timeouts** y **respuestas parciales**.
- Comparte los esquemas Zod del contrato para validar cada solicitud y respuesta.
- Se usa en desarrollo, pruebas unitarias y e2e.

```ts
interface SyncTransport {
  login(req: LoginReq): Promise<LoginRes>;
  refresh(req: RefreshReq): Promise<LoginRes>;
  registerDevice(req: RegisterDeviceReq): Promise<RegisterDeviceRes>;
  pull(req: { cursor?: string; limit?: number }): Promise<PullRes>;
  push(req: PushReq): Promise<PushRes>;
}
```

## 6. Requisitos para quien construya el backend
- Implementar exactamente este contrato y publicar el mismo `openapi.yaml`.
- Pruebas de contrato: el `MockTransport` y el backend real deben pasar la misma suite.
- PostgreSQL como fuente de verdad; tablas transaccionales de solo agregado; `eventId` con índice único.
- Recalcular totales con las mismas reglas de `docs/SPEC.md` §6 (idéntico redondeo) para detectar discrepancias.
- Migraciones "expandir/contraer": las cajas offline pueden enviar payloads de versiones anteriores durante días.
