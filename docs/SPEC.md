# SPEC — POS PWA (frontend)

Versión 0.1. Documento de referencia para desarrollo con agentes. Lo que no esté aquí se pregunta; no se inventa.

---

## 1. Objetivo y alcance

**Objetivo:** PWA de punto de venta que funcione 100 % sin internet, instalable en PC, tablet y celular, y adaptable a distintos tipos de negocio mediante módulos y campos configurables.

**Modos de operación**
- `local`: sin backend. Los datos viven solo en el dispositivo (desarrollo y pilotos).
- `synced`: con backend según `docs/API_CONTRACT.md`.
- El MVP se construye en `local` y prueba la sincronización contra un `MockTransport`. El backend real se conecta después sin tocar la lógica de negocio.

**Dentro del MVP**
- Primer arranque (wizard), usuarios con PIN y roles.
- Catálogo: productos, categorías, códigos de barras, impuestos, campos personalizados, importación CSV.
- Clientes básicos.
- Venta: carrito, descuentos, notas, retener/retomar, escáner.
- Cobro: efectivo, tarjeta (solo registro), transferencia, otros; pagos divididos; vuelto.
- Comprobante en pantalla e impresión térmica (ESC/POS) con respaldo por impresión del navegador.
- Turnos y caja: apertura, entradas/salidas, cierre con arqueo.
- Inventario: movimientos, ajustes, alertas de stock bajo.
- Anulaciones y devoluciones.
- Reportes básicos y exportación CSV.
- Sincronización (outbox, estados, reintentos) contra el contrato.
- PWA completa: instalación, actualización segura, persistencia de almacenamiento.

**Fuera del MVP (no construir todavía)**
Backend · facturación fiscal electrónica · cobro con tarjeta integrado a terminal · administración multi-sucursal · mesas/comandas · variantes · lotes y vencimientos · fidelización · e-commerce · imágenes de producto.

---

## 2. Roles y permisos

| Permiso | Cajero | Gerente | Dueño |
|---|---|---|---|
| Vender, retener, retomar | ✔ | ✔ | ✔ |
| Descuento hasta `maxDiscountBp` (def. 10 %) | ✔ | ✔ | ✔ |
| Descuento mayor / cambio de precio | aprobación | ✔ | ✔ |
| Abrir/cerrar su turno, entradas/salidas de caja | ✔ | ✔ | ✔ |
| Anular venta, devoluciones | aprobación | ✔ | ✔ |
| Ajustes de inventario | — | ✔ | ✔ |
| Editar catálogo, clientes | — | ✔ | ✔ |
| Reportes | propios del turno | ✔ | ✔ |
| Ajustes, impuestos, usuarios, impresoras, módulos | — | — | ✔ |

**Aprobación** = un gerente/dueño ingresa su PIN en un diálogo; el `approvedBy` queda en el registro y en auditoría.

---

## 3. Stack

| Necesidad | Elección |
|---|---|
| Lenguaje | TypeScript `strict` |
| UI | React 19 + Vite |
| PWA | `vite-plugin-pwa` con estrategia `injectManifest` (SW propio) y Workbox |
| Base local | Dexie 4 (IndexedDB) + `dexie-react-hooks` (`useLiveQuery`) |
| Estado de UI | Zustand |
| Rutas | React Router |
| Formularios/validación | React Hook Form + Zod |
| Estilos | Tailwind CSS + shadcn/ui (Radix), lucide-react |
| Fechas | date-fns |
| Búsqueda | MiniSearch (índice en memoria) |
| IDs | `uuid` (v7) |
| CSV | papaparse |
| Pruebas | Vitest, fast-check, Testing Library, `fake-indexeddb`, Playwright |
| Calidad | ESLint, Prettier, Husky + lint-staged, Conventional Commits |
| Hosting | Estático con HTTPS (Cloudflare Pages, Netlify o Vercel) |

**Por qué Dexie y no SQLite-WASM en el MVP:** funciona en todos los navegadores (incluido Safari), tiene consultas reactivas simples y menos complejidad. Se aísla detrás de repositorios para poder migrar más adelante.

---

## 4. Arquitectura

```
src/
  domain/        # TS puro. Dinero, impuestos, descuentos, carrito, reglas. Sin React/Dexie/fetch.
    ports/       # Interfaces de repositorios y servicios (Clock, Printer, etc.)
  data/          # Dexie: esquema, migraciones, repositorios (implementan ports), withTx
  sync/          # contract.ts (Zod), engine, transports (Mock, Http), reglas de merge
  hardware/      # receipt (IR + renderers), escpos (encoder), transports USB/Serial, scanner
  features/      # pos, catalog, customers, shifts, inventory, reports, settings, auth, modules
  ui/            # componentes de diseño (botones, keypad, diálogos)
  app/           # router, providers, registro PWA, i18n, error boundary
  sw/            # service worker
  test/          # utilidades de pruebas, seeds
docs/
```

**Reglas de dependencia**
- `domain` no importa de ninguna otra carpeta ni de librerías de UI/DB.
- `data` importa `domain`. `sync` importa `domain` y `data`. `hardware` importa `domain`.
- `features` importa todo lo anterior vía hooks/servicios; **nunca** llama a Dexie directo.
- Se hace cumplir con `no-restricted-imports` en ESLint.

**Patrón de escritura de negocio (obligatorio)**
Todo cambio transaccional pasa por `withTx(ctx, fn)`, que abre **una** transacción Dexie sobre las tablas necesarias y en ella: escribe la entidad, escribe movimientos de stock/caja derivados, agrega el evento a `outbox` y agrega la entrada a `auditLog`. Si algo falla, no se escribe nada.

---

## 5. Modelo de datos

```ts
type UUID = string;      // UUIDv7
type Minor = number;     // entero en unidad menor (centavos)
type Milli = number;     // entero en milésimas (1 unidad = 1000)
type Bp = number;        // puntos básicos: 1500 = 15 %
type ISODate = string;   // ISO 8601 UTC

interface Versioned { id: UUID; version: number; updatedAt: ISODate; deletedAt?: ISODate | null }
```

### 5.1 Datos de referencia (los manda el servidor cuando exista; LWW por `version`)

```ts
interface TaxRate extends Versioned { name: string; rateBp: Bp; active: boolean }

interface Category extends Versioned { name: string; parentId?: UUID | null; sort: number }

interface Product extends Versioned {
  sku: string; barcodes: string[]; name: string; categoryId?: UUID | null;
  priceMinor: Minor; costMinor?: Minor; taxRateId: UUID;
  trackStock: boolean; minStockMilli?: Milli; unit: 'unit' | 'kg' | 'g' | 'l' | 'ml' | 'm';
  allowFractional: boolean; active: boolean;
  custom: Record<string, unknown>;
}

interface Customer extends Versioned {
  name: string; phone?: string; email?: string; taxId?: string; address?: string;
  custom: Record<string, unknown>;
}

interface User extends Versioned {
  name: string; role: 'cashier' | 'manager' | 'owner'; active: boolean;
  pin: { hash: string; salt: string; iterations: number };  // PBKDF2-SHA256
}

interface Settings {
  id: 'singleton';
  business: { name: string; taxId?: string; address?: string; phone?: string; footerText?: string };
  currency: { code: string; decimals: number; symbol: string };
  pricesIncludeTax: boolean;
  requireShift: boolean;                 // exigir turno abierto para vender (def. true)
  allowNegativeStock: boolean;           // def. true
  maxDiscountBp: Bp;                     // def. 1000
  paymentMethods: { id: string; label: string; kind: 'cash'|'card'|'transfer'|'other'; active: boolean; requireReference: boolean }[];
  modules: Record<string, boolean>;      // feature flags por nicho
  receipt: { paperWidthMm: 58 | 80; template: ReceiptTemplate };
  mode: 'local' | 'synced';
}

interface CustomFieldDef extends Versioned {
  entity: 'product' | 'customer' | 'sale';
  key: string; label: string; type: 'text' | 'number' | 'select' | 'bool' | 'date';
  options?: string[]; required: boolean; showOn: ('form' | 'pos' | 'receipt')[];
}
```

### 5.2 Datos transaccionales (inmutables; se envían al servidor con `outbox`)

```ts
interface SaleLine {
  lineId: UUID; productId: UUID;
  sku: string; name: string;                       // copia (snapshot) al momento de la venta
  qty: Milli; unitPrice: Minor;                     // copia del precio
  discount?: { type: 'percent' | 'fixed'; value: number; reason?: string; approvedBy?: UUID };
  taxRateId: UUID; taxRateBp: Bp;                   // copia
  lineBase: Minor; lineDiscount: Minor; orderDiscountShare: Minor;
  taxableBase: Minor; tax: Minor; lineTotal: Minor;
  note?: string; custom: Record<string, unknown>;
}

interface Payment {
  id: UUID; method: string;                         // id de settings.paymentMethods
  amount: Minor;                                    // monto aplicado a la venta
  tendered?: Minor;                                 // efectivo entregado (para calcular vuelto)
  reference?: string; createdAt: ISODate;
}

interface Sale {
  id: UUID; number: string;                         // ej. "A01-000123"
  deviceId: UUID; shiftId: UUID | null; cashierId: UUID; customerId?: UUID | null;
  status: 'completed';                              // borradores viven en heldCarts
  lines: SaleLine[];
  orderDiscount?: { type: 'percent' | 'fixed'; value: number; reason?: string; approvedBy?: UUID };
  totals: {
    subtotal: Minor; lineDiscounts: Minor; orderDiscount: Minor; tax: Minor;
    roundingAdjustment: Minor; total: Minor;
    taxBreakdown: { taxRateId: UUID; rateBp: Bp; base: Minor; tax: Minor }[];
  };
  payments: Payment[]; change: Minor;
  pricesIncludeTax: boolean; currency: string;      // congelados
  notes?: string; custom: Record<string, unknown>;
  fiscal?: { number?: string; authorization?: string } | null;   // lo llenará el módulo fiscal
  createdAt: ISODate; completedAt: ISODate; schemaVersion: 1;
}

interface SaleVoid   { id: UUID; saleId: UUID; shiftId: UUID | null; reason: string; approvedBy: UUID; createdBy: UUID; createdAt: ISODate }
interface SaleReturn { id: UUID; saleId: UUID; shiftId: UUID | null; lines: { lineId: UUID; qty: Milli; refund: Minor }[]; refunds: Payment[]; reason: string; approvedBy?: UUID; createdBy: UUID; createdAt: ISODate }

interface Shift {
  id: UUID; deviceId: UUID; openedBy: UUID; openedAt: ISODate; openingFloat: Minor;
  status: 'open' | 'closed'; closedBy?: UUID; closedAt?: ISODate;
  countedCash?: Minor; expectedCash?: Minor; difference?: Minor;
}

interface CashMovement { id: UUID; shiftId: UUID; type: 'in' | 'out'; amount: Minor; reason: string; createdBy: UUID; createdAt: ISODate }

interface InventoryMovement {
  id: UUID; productId: UUID; qty: Milli;            // + entra, − sale
  type: 'sale' | 'void' | 'return' | 'adjustment' | 'initial' | 'purchase';
  refType?: 'sale' | 'sale_void' | 'sale_return'; refId?: UUID;
  reason?: string; createdBy: UUID; createdAt: ISODate;
}

interface AuditEntry { id: UUID; ts: ISODate; userId: UUID; action: string; entity: string; entityId?: UUID; details?: Record<string, unknown> }
```

### 5.3 Locales (no se sincronizan)

```ts
interface HeldCart { id: UUID; cashierId: UUID; label?: string; lines: unknown[]; customerId?: UUID; createdAt: ISODate; updatedAt: ISODate }
interface StockLevel { productId: UUID; qty: Milli }           // caché derivada; se puede reconstruir sumando movimientos
interface OutboxItem {
  seq: number;                                      // autoincremental = deviceSeq
  eventId: UUID; entity: string; entityId: UUID; op: 'create' | 'upsert';
  payload: unknown; schemaVersion: number; occurredAt: ISODate;
  status: 'pending' | 'sending' | 'synced' | 'dead';
  attempts: number; nextAttemptAt: number; lastError?: string;
}
interface MetaRow { key: string; value: unknown }  // deviceId, tenantId, storeId, series, saleSeq, pullCursor, serverOffsetMs, schemaVersion
```

### 5.4 Esquema Dexie v1 (índices)

```
meta:               'key'
users:              'id, name, role, active'
settings:           'id'
taxRates:           'id, active'
categories:         'id, parentId, sort'
products:           'id, sku, *barcodes, categoryId, name, active, updatedAt'
customers:          'id, name, phone, taxId'
customFieldDefs:    'id, entity'
sales:              'id, &number, shiftId, cashierId, customerId, completedAt, [shiftId+completedAt]'
saleVoids:          'id, saleId, shiftId'
saleReturns:        'id, saleId, shiftId'
shifts:             'id, status, openedAt'
cashMovements:      'id, shiftId, createdAt'
inventoryMovements: 'id, productId, createdAt, [productId+createdAt], [refType+refId]'
stockLevels:        'productId'
heldCarts:          'id, cashierId, createdAt'
outbox:             '++seq, &eventId, status, nextAttemptAt'
auditLog:           'id, ts, userId, action'
```

Toda migración futura se hace con `db.version(n).stores(...).upgrade(...)` y con prueba.

---

## 6. Reglas de negocio

### 6.1 Dinero y redondeo
- `Minor` siempre entero. Redondeo **half-up** (0,5 sube; para negativos, simétrico "lejos de cero").
- Tasas en `Bp` (15 % = 1500). Nunca usar `float` para dinero ni tasas.
- `Money.allocate(total, weights[])`: reparto por **mayor residuo**; la suma de las partes es exactamente el total.

### 6.2 Cálculo de venta (orden estricto)
1. `lineBase = round(unitPrice × qty / 1000)`.
2. Descuento de línea: `percent` → `round(lineBase × bp / 10000)`; `fixed` → `min(fixed, lineBase)`. Resultado: `lineDiscount`.
3. `afterLine = lineBase − lineDiscount`.
4. Descuento de orden (`percent` sobre Σ`afterLine` o `fixed` limitado a esa suma) se **prorratea** entre líneas con `allocate` ponderando por `afterLine`. Resultado: `orderDiscountShare`.
5. `taxableBase = afterLine − orderDiscountShare`.
6. Impuesto por línea:
   - `pricesIncludeTax = true`: `net = round(taxableBase × 10000 / (10000 + rateBp))`; `tax = taxableBase − net`; `lineTotal = taxableBase`.
   - `pricesIncludeTax = false`: `tax = round(taxableBase × rateBp / 10000)`; `lineTotal = taxableBase + tax`.
7. Totales: `subtotal = Σ lineBase`, `lineDiscounts`, `orderDiscount`, `tax = Σ tax`, `total = Σ lineTotal + roundingAdjustment`. `taxBreakdown` agrupa por tasa.
8. `roundingAdjustment` es 0 salvo que se active redondeo de efectivo (fuera del MVP; dejar el campo).

**Casos dorados (deben existir como pruebas)**
- Incluido, 15 %: bruto 11500 → net 10000, tax 1500. Bruto 10000 → net 8696, tax 1304.
- Excluido, 15 %: base 1099 → tax 165 (164,85 redondeado).
- Prorrateo: descuento 1000 sobre líneas [3333, 3333, 3334] → [333, 333, 334].
- Exento (`rateBp = 0`): tax siempre 0.
- Cantidad fraccionaria: precio 2500 × 1,250 kg (qty 1250) → lineBase 3125.

**Invariantes (property-based)**
- Σ `orderDiscountShare` = descuento de orden aplicado.
- `net + tax = taxableBase` con impuesto incluido.
- `total ≥ 0`; `total = Σ lineTotal + roundingAdjustment`.
- `allocate` siempre suma exactamente el total.
- El resultado no depende del orden de las líneas.

### 6.3 Pagos
- `Σ payments.amount ≥ total`. El exceso solo puede venir de **efectivo** y se devuelve como `change`.
- Los pagos no efectivo no pueden exceder lo pendiente.
- Método con `requireReference` exige `reference`.
- Pagos divididos: cualquier combinación de métodos activos.

### 6.4 Numeración
- `number = ${series}-${seq.padStart(6,'0')}`. `series` la asigna el registro del dispositivo (en modo `local`: `L01`).
- `saleSeq` se incrementa **dentro de la transacción** que crea la venta y solo al completarla (los borradores no consumen número).
- `&number` es único en Dexie.

### 6.5 Turnos y caja
- Un solo turno abierto por dispositivo.
- `expectedCash = openingFloat + ventas en efectivo (amount, sin vuelto) + entradas − salidas − devoluciones en efectivo`.
- `difference = countedCash − expectedCash`.
- Cierre genera el reporte Z (imprimible).
- Si `requireShift`, no se puede vender sin turno abierto.

### 6.6 Inventario
- Cada venta de un producto con `trackStock` crea un `InventoryMovement` negativo. Anulación/devolución crean el positivo correspondiente.
- El stock es la **suma de movimientos**; `stockLevels` es una caché actualizada en la misma transacción y reconstruible.
- Con `allowNegativeStock = true` nunca se bloquea una venta por falta de stock; se muestra alerta.

### 6.7 Anulaciones y devoluciones
- Anular: requiere aprobación de gerente + motivo; crea `SaleVoid`, revierte inventario y (si aplica) registra salida de efectivo. La venta original **no se modifica**.
- Una venta anulada no puede anularse ni devolverse otra vez.
- Devolución parcial: `qty` devuelta ≤ `qty` vendida − ya devuelta. El reembolso usa el método elegido.
- Invariante: venta + anulación deja stock y caja como estaban.

### 6.8 Auditoría
Registrar como mínimo: login/logout/bloqueo, intento fallido de PIN, apertura/cierre de turno, descuento con aprobación, anulación, devolución, ajuste de inventario, cambio de precio, cambios de ajustes, reimpresión, exportación de respaldo.

---

## 7. Sincronización (resumen; detalle en `docs/API_CONTRACT.md`)
- **Push:** el `outbox` se envía en lotes ordenados por `seq`. El servidor es idempotente por `eventId`.
- **Pull:** datos de referencia con cursor. LWW por `version`.
- **Transacciones:** solo se agregan; no hay conflictos que resolver.
- **Disparadores:** arranque, `visibilitychange` a visible, evento `online`, temporizador (30 s con red), tras completar una venta (con debounce) y botón manual. El Background Sync API es solo mejora progresiva (no funciona en iOS).
- **Un solo ejecutor** de sync entre pestañas con Web Locks.
- **Estados visibles:** sincronizado · pendiente (N) · sin conexión · error. Un evento `dead` nunca se descarta en silencio: se muestra en Diagnóstico con opción de reintentar y exportar.
- **Respaldo de emergencia:** "Exportar pendientes" genera un JSON con todo el `outbox` no sincronizado.

---

## 8. PWA
- **Manifest:** `display: standalone`, `start_url` y `scope` en `/`, íconos 192/512 y maskable, `theme_color`, `lang: es`.
- **Service worker (`injectManifest`):** precache del app shell; imágenes con cache-first y límite; página de respaldo offline. Los datos de negocio **no** se cachean en el SW: viven en Dexie.
- **Actualizaciones:** `registerType: 'prompt'`. Se muestra un aviso "Hay una versión nueva". Se aplica **solo si no hay carrito con líneas ni cobro en curso**; si los hay, se pospone hasta el cierre de la venta o del turno.
- **Persistencia:** llamar `navigator.storage.persist()` tras el primer login y mostrar en Diagnóstico si quedó concedida, más `navigator.storage.estimate()`.
- **iOS:** guiar la instalación a pantalla de inicio (banner explicativo). Sin Background Sync; ver §7.
- **Varias pestañas:** detectar con `BroadcastChannel`/Web Locks y avisar; solo una pestaña puede cobrar.
- **Versionado en el cliente:** una caja offline puede correr una versión vieja por días. Cada evento del outbox lleva `schemaVersion`.

---

## 9. Hardware

**Escáner de código de barras (modo teclado):** hook global `useBarcodeScanner` que detecta ráfagas (caracteres con < 35 ms entre sí) terminadas en Enter y las envía a la búsqueda por código. No debe interferir con campos de texto normales.

**Impresión de recibos.** Interfaz `ReceiptPrinter { print(doc: ReceiptDoc): Promise<void>; openDrawer(): Promise<void>; status(): Promise<PrinterStatus> }`.

Implementaciones:
1. `BrowserPrinter` — HTML con `@page` de 58/80 mm y `window.print()`. Siempre disponible como respaldo.
2. `EscPosPrinter` — usa el encoder y un transporte:
   - `WebUsbTransport` (Chromium).
   - `WebSerialTransport` (Chromium; Firefox lo soporta desde la versión 151).
   - Detección de características y degradación limpia a `BrowserPrinter`.
3. Futuras (solo interfaz/stub): `CloudPrntTransport`, `LocalAgentTransport` (agente local en C por WebSocket con autenticación).

**Recibo con una sola definición.** Una plantilla JSON de bloques (`ReceiptTemplate`) produce un `ReceiptDoc` (representación intermedia: texto, fila izquierda/derecha, tabla, línea, código de barras, QR, corte, cajón) que dos renderizadores convierten a HTML y a bytes ESC/POS.

**Encoder ESC/POS (TypeScript puro, con pruebas de bytes):** inicializar (`ESC @`), alineación (`ESC a`), negrita (`ESC E`), tamaño (`GS !`), corte (`GS V`), pulso de cajón (`ESC p`), selección de página de códigos (`ESC t`) para acentos y ñ (CP858/CP1252; verificar contra el manual de la impresora), código de barras y QR (`GS k`, `GS ( k`). Todo comando se prueba con bytes esperados. Nunca asumir un modelo: el ancho, la página de códigos y el corte son ajustes.

---

## 10. UI/UX

**Pantallas:** Login PIN · Wizard inicial · Venta · Cobro · Historial de ventas/detalle · Catálogo · Clientes · Turnos y caja · Inventario · Reportes · Ajustes · Diagnóstico.

**Venta (≥ 1024 px):** dos paneles. Izquierda: buscador (F2), categorías, cuadrícula de productos. Derecha: carrito, totales, botón Cobrar (F4). En teléfono: pestañas Catálogo/Carrito.

**Reglas:** targets ≥ 48 px, teclado numérico propio para cantidades e importes, atajos de escritorio (F2 buscar, F4 cobrar, Esc cancelar diálogo), foco correcto tras escanear, confirmaciones para acciones destructivas, mensajes de error en español claro, tema claro/oscuro, accesibilidad AA (contraste, etiquetas, foco visible).

**Formato de moneda:** `Intl.NumberFormat` con `settings.currency`; nunca suponer símbolo ni decimales.

---

## 11. Seguridad
- PIN: PBKDF2-SHA256 con WebCrypto, ≥ 210 000 iteraciones, sal aleatoria de 16 bytes. Bloqueo temporal tras 5 intentos fallidos (backoff creciente). Bloqueo automático de sesión por inactividad (configurable).
- Sin scripts de terceros. Cabeceras del hosting: CSP restrictiva, `X-Content-Type-Options`, `Referrer-Policy`.
- Tokens del backend: solo en memoria + refresh token en IndexedDB (nunca `localStorage`).
- Nada de datos de tarjeta en ningún almacenamiento ni log.
- Acciones sensibles siempre auditadas.
- Los datos locales no están cifrados por el navegador más allá del aislamiento del origen; documentar esta limitación en el Diagnóstico.

---

## 12. Flexibilidad por nicho
- **Campos personalizados:** `custom` en producto, cliente y venta, con definiciones (`CustomFieldDef`). Formularios y vistas se generan dinámicamente desde las definiciones. Regla: dato que se filtra/reporta a menudo pasa a columna real en el futuro.
- **Feature flags:** `settings.modules` activa módulos por negocio.
- **Registro de módulos** (`features/modules/registry.ts`) con puntos de extensión: `posLineExtras`, `productFormFields`, `receiptBlocks`, `reportWidgets`, `paymentExtras`.
- **Plantillas de recibo** configurables por negocio.
- Módulos futuros previstos: mesas/comandas, variantes, lotes/vencimientos, citas/servicios, pesables con balanza.

---

## 13. Rendimiento y calidad (presupuestos)
- JS inicial ≤ 250 KB gzip. LCP < 2,5 s en Android de gama media con 4G.
- Búsqueda en 10 000 productos < 50 ms. Agregar al carrito < 100 ms. Completar venta local < 300 ms.
- Cobertura: `domain` ≥ 95 %; `data` ≥ 80 %.
- Navegadores: Chrome/Edge (Windows y Android) como principales; Safari iOS instalada en pantalla de inicio; Firefox funcionalidad básica.

---

## 14. Decisiones abiertas (confirmar antes del piloto)
1. Nombre del producto y marca.
2. País/moneda/régimen de impuestos por defecto del primer piloto.
3. Texto legal del recibo y numeración fiscal (módulo fiscal por país, más adelante).
4. Modelo de impresora y forma de conexión del primer piloto.
5. Primer nicho piloto y qué módulo necesita.
