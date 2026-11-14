# AGENTS.md — outbox (eventos hacia Kafka)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**
> (`microservices/inventory-core/AGENTS.md`). No se duplican aquí.
>
> Solo se corrige lo verificado; lo no verificado se conserva tal cual.

Estado: **Probado** (2026-11-14): `SPARE_ASSIGNED`, `SPARE_RETURNED` y el
`SPARE_CANCELLED(returned)` de cierre. La reconciliación y la recuperación viven en
`spare-cancellations/` y `spare-assignments-sync/`.

## 1. Qué es y para qué sirve

Publica eventos a Kafka sin perderlos. El evento se inserta en `outbox_events`
**dentro de la transacción** del documento que lo origina; después del commit
se despacha. Así "documento guardado" y "evento registrado" son atómicos.

Lo usan stock-vouchers (avisos al MS de órdenes), products y stock (réplicas hacia billing).

## 2. Archivos

```text
src/outbox/

  outbox.module.ts
  constants/outbox-topics.ts
  entities/outbox-event.entity.ts
  services/outbox.service.ts
  controllers/outbox.controller.ts   (sin ver: no lo escribí en este hilo; completar)
```

- `constants/outbox-topics.ts`: `INVENTORY_CORE_ORIGIN = 'inventory-core'`,
  `SPARE_TOPICS` (`ASSIGNED`, `RETURNED`, `CANCELLED`, `CANCELLATION_REQUESTED`),
  `SPARE_EVENTS`.
- `CANCELLED` corresponde al evento de cierre `SPARE_CANCELLED`.
- `CANCELLATION_REQUESTED` corresponde al topic de solicitud que consume inventory-core.
- `OutboxModule` exporta `OutboxService`; lo importa `StockVouchersModule`.
  Usa `KafkaProducerService` (`KafkaModule` es `@Global`).
- `src/kafka/kafka.producer.ts` es **propio de inventory-core**
  (`SERVICE_NAME = 'ms-inventory-core'`, `idempotent: true`, sin
  `transactionalId`). `emit(topic, eventType, data, key?, eventId?)` **nunca
  lanza: devuelve `false`**.
  Sobre: `{ eventId, eventType, timestamp, source, version: 1, data }`.
  (sin confirmar) si usa `uuid` o `randomUUID` de `crypto` para el id por defecto.

## 3. Modelo de datos

`outbox_events`: `id` (uuid), `seq` (bigint, `@Generated('increment')`, orden
global), `company_id`, `topic`, `event_type`, `key` (key de Kafka), `payload`
(jsonb, tipado `any` en la entidad), `status` (varchar: `PENDING`/`SENT`/
`FAILED`), `attempts`, `next_attempt_at`, `last_error`, `created_at`, `sent_at`.

`status` es varchar, no enum de Postgres, para no depender de `ALTER TYPE`.

Índices: `(status, next_attempt_at)`, `(key, seq)`, `(company_id)`.

## 4. Cómo funciona

- **Encolar:** `outbox.enqueue(em, events)` con el `em` de la transacción
  del documento. Devuelve los ids.

- **Despachar:** `outbox.dispatchNow(ids)` se llama **después del commit y
  fuera del `try` que limpia S3**. Nunca lanza. En `StockVouchersService.create`:
  `void this.outbox.dispatchNow(outboxIds)` al final del método.

  `dispatchNow` hace **dos pasadas**: el outbox no saca dos eventos de la misma
  key en un lote, y la segunda libera el siguiente (p. ej. `SPARE_CANCELLED`
  tras `SPARE_RETURNED`).

- **Poller:** `setInterval` propio (`OUTBOX_POLL_MS`, 3000 por defecto), sin
  `@nestjs/schedule`. Toma lotes de 20.

- **Reclamo:** `UPDATE ... RETURNING` con `FOR UPDATE SKIP LOCKED` y un
  arriendo de 60 s (`next_attempt_at`). Si el proceso cae a medio envío, la
  fila vuelve a estar disponible tras ese tiempo.

- **Orden por key:** no toma una fila si existe otra `PENDING` anterior
  (menor `seq`) con la misma key. Un `returned` nunca adelanta a su `assigned`.

- **Reintentos:** backoff 5 s × 2^n, tope 15 min. **Nunca descarta**; `FAILED`
  solo se marca a mano.

- **Entrega al menos una vez:** el `eventId` del sobre es el id del outbox, así
  que un reintento lleva el mismo. Los consumidores deben ser idempotentes.

## 5. Eventos publicados (contrato con el MS de órdenes)

Los consume `SpareAssignmentsEventsListener` de órdenes. **La bandera de
origen va dentro de `data`** (`origin: 'inventory-core'`), no en `source`,
porque el consumer solo pasa `event.data` al handler. Ausencia de `origin` =
`legacy`.

### `SPARE_ASSIGNED` — `ms.inventory.spare.assigned`

Uno por **línea** de una salida con orden. Key = id de la línea.

| `data` | Fuente |
|---|---|
| `id`, `movementId` | `stock_voucher_lines.id` |
| `orderId` | `voucher.orderId` |
| `quantity` | `line.quantity` |
| `spare.sku` | `Product.sku` |
| `spare.productName` | `ProductName.name` (respaldo: `sku`; en órdenes es NOT NULL) |
| `spare.unitPrice` | `line.salePrice` como número **(asumido)** |
| `spare.batchNumber` | `Lot.code` |
| `spare.isBillableInRepairOrders` | `line.billableInRepairOrders` |
| `createdAt`, `updatedAt` | `voucher.createdAt` ISO |
| `origin` | `'inventory-core'` |
| `voucherId`, `voucherCode`, `lineNo` | informativos |

Condición: la salida tiene orden (`order != null`), no el código del motivo.

Si falta el producto o el lote se lanza error y **se revierte el vale**.

### `SPARE_RETURNED` — `ms.inventory.spare.returned`

Uno por **línea de origen** retornada, solo si el vale de origen tiene orden.

Key = id de la línea de origen.

| `data` | Valor |
|---|---|
| `id`, `movementId` | id de la línea de **salida** |
| `orderId`, `origin` | como en `assigned` |
| `returnedQuantity` | cantidad de este retorno |
| `remainingQuantity` | **absoluta**: `quantity − Σ retornos` (idempotente) |
| `isTotal` | `remainingQuantity === 0` |
| `returnedAt`, `updatedAt` | fecha del vale de retorno |
| `returnVoucherId`, `returnVoucherCode` | informativos |

`DEVOLUCION` (salidas sin orden) y `USO_LAB` etc. **no publican**. Un `replayed`
tampoco (no inserta nada).

### `SPARE_CANCELLED` (cierre) — `ms.inventory.spare.cancelled`

Lo encola `SpareCancellationsService.confirmForReturnedLines` dentro de la
transacción del retorno que deja `remainingQuantity = 0` en una línea con solicitud
`PENDING`, y también el barrido. Key = id de la línea. `data`: `request_id`,
`movement_id`, `order_id`, `assignment_status: 'returned'`.

Las respuestas de recepción (`cancellation_requested` / `active`) **no** pasan por el
outbox: salen directo (ver `spare-cancellations/AGENTS.md`).

### Eventos hacia billing (réplicas)

Consumidor: `ms-billing`. Topics definidos en `constants/outbox-topics.ts`
(`PRODUCT_TOPICS`, `LOT_TOPICS`; eventos `PRODUCT_EVENTS`, `LOT_EVENTS`).

| Evento | Topic | Key | Origen |
|---|---|---|---|
| `PRODUCT_UPSERTED` | `ms.inventory.core.product.upserted` | `product.id` | `ProductsService` create/update/remove/restore |
| `LOT_UPSERTED` | `ms.inventory.core.lot.upserted` | `lot.id` | `StockService.registerInbound` |

`data` = snapshot completo (contrato en `products/AGENTS.md` y `stock/AGENTS.md`).

No llevan `origin`. Consumidores idempotentes (entrega al menos una vez).

## 6. Lado MS órdenes (repo aparte, lo que se cambió)

- `spare_assignments.origin` (varchar 30, default `'legacy'`).

- `assignSpare`: con `origin = 'inventory-core'` hace **insert-or-ignore**
  (`orIgnore()`), para que una reentrega no reviva una asignación ya devuelta.
  El legacy sigue con `save` sin cambios.

- `returnSpare`: con `origin = 'inventory-core'` aplica por cantidad
  (`returnSpareInventoryCore`): parcial baja `quantity` y no cambia `status`;
  total pone `returned` y conserva `quantity`; evento repetido o ya
  `returned` se ignora; si la asignación aún no existe, lanza para que el
  consumer reintente (3 intentos, luego DLQ).

- **Legacy sin cambios.** Los eventos legacy no traen `origin`.

- `createCancellationRequest` publica según `spare.origin`:
  `inventory-core` → `ms.inventory.core.spare.cancellation.requested`; el resto
  → topic del legacy.
  `publishSpareCancellationRequested(request, origin)` ahora **lanza** si `emit`
  devuelve `false` (antes la solicitud quedaba `PENDING` sin aviso).
  **(sin confirmar)** que esa decisión quedó así.

- `getLastUpdatedAt(origin)` (por origen) y `origin` en `syncBulk`.

- `syncCoreOnStart` (en `spare-assignments-sync.controller.ts` de órdenes) corre
  en paralelo e independiente de `syncOnStart`; cliente `INVENTORY_CORE_SYNC`
  y variable `INVENTORY_CORE_QUEUE`. Si falta la variable, se omite.

## 7. Pendientes (numeración propia O1…)

**O1. Resuelto.** Fase 3, cancelación por solicitud.
Implementado en `spare-cancellations/`.

**O2. Resuelto.** Bulk/reconciliación de inventory-core.
Implementado en `spare-assignments-sync/` más la reconciliación.

**O3.** Ventana de carrera: **resuelta** con el barrido. Rechazo desde bodega:
pasa a O7 de `spare-cancellations/`.

**O4.** Retención: no hay limpieza de filas `SENT`; no hay herramienta para
reintentar o marcar `FAILED`. `outbox.controller.ts` (sin ver) no está
documentado.

**O5.** `returnSpare` legacy en órdenes crea `newAssignment` sin `id` (PK varchar
sin generador) en el retorno parcial. No afecta a `inventory-core`; queda
como deuda del legacy.

**O6.** Producción: migración de `outbox_events` con sus índices (ver raíz 24).

## 8. Errores y lecciones

- `KafkaProducerService.emit` **no lanza**: un `try/catch` no detecta el fallo;
  hay que revisar el booleano.

- `em.insert` con una columna `jsonb`: `QueryDeepPartialEntity` no acepta
  `Record<string, unknown>`. Se tipa la fila como `QueryDeepPartialEntity<OutboxEvent>`
  con `payload as any`.

- En `create()`, `const result` dentro del `try` impedía despachar fuera de
  él: pasó a `let result` declarado antes. El despacho nunca va dentro del `try`
  que limpia S3.

- Un `assigned` reentregado con `save` revive una asignación ya devuelta:
  por eso el insert-or-ignore.

## 9. Cómo actualizar este archivo

Si cambia un evento o su payload: actualizar la sección 5 **y** el lado órdenes
(sección 6). Reglas completas en la sección 0 de la raíz.