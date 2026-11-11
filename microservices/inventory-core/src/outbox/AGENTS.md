# AGENTS.md — outbox (eventos hacia Kafka)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**
> (`microservices/inventory-core/AGENTS.md`). No se duplican aquí.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual.

Estado: **Probado** (2026-11-10) para `SPARE_ASSIGNED` y `SPARE_RETURNED`
(fases 1 y 2). La fase 3 (cancelación por solicitud y bulk) **no existe**.

## 1. Qué es y para qué sirve

Publica eventos a Kafka sin perderlos. El evento se inserta en `outbox_events`
**dentro de la transacción** del documento que lo origina; después del commit
se despacha. Así "documento guardado" y "evento registrado" son atómicos.
Hoy solo lo usa `stock-vouchers` para avisar al MS de órdenes.

## 2. Archivos

```
src/outbox/
  outbox.module.ts
  constants/outbox-topics.ts
  entities/outbox-event.entity.ts
  services/outbox.service.ts
  controllers/outbox.controller.ts   (sin ver: no lo escribí en este hilo; completar)
```

- `constants/outbox-topics.ts`: `INVENTORY_CORE_ORIGIN = 'inventory-core'`,
  `SPARE_TOPICS` (`ASSIGNED`, `RETURNED`, `CANCELLED`), `SPARE_EVENTS`.
  `CANCELLED` está definido pero **no se publica desde aquí todavía** (fase 3).
- `OutboxModule` exporta `OutboxService`; lo importa `StockVouchersModule`.
  Usa `KafkaProducerService` (`KafkaModule` es `@Global`).
- `src/kafka/kafka.producer.ts` es **propio de inventory-core**
  (`SERVICE_NAME = 'ms-inventory-core'`, `idempotent: true`, sin
  `transactionalId`). `emit(topic, eventType, data, key?, eventId?)` **nunca
  lanza: devuelve `false`**. Sobre: `{ eventId, eventType, timestamp, source, version: 1, data }`.
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

## 7. Pendientes (numeración propia O1…)

O1. **Fase 3, cancelación por solicitud.** Hoy `createCancellationRequest` de
    órdenes publica siempre en `ms.inventory.spare.cancellation.requested`, que
    consume el **legacy**. El handler legacy hace `findById(uuid)` → `CastError`,
    el `catch` lanza otro error y el mensaje se reintenta sin fin (además crea
    un `CancellationRequestLog` basura). **Hasta resolverlo, no pedir
    cancelación por solicitud sobre asignaciones `inventory-core`.** Diseño
    acordado: topic propio (nombre **(sin confirmar)**:
    `ms.inventory.core.spare.cancellation.requested`) elegido por `origin`;
    inventory-core consume, valida, guarda la solicitud (`PENDING`) y responde
    `SPARE_CANCELLED` con `cancellation_requested` (o `active` + `error_detail`);
    se cierra con el `SPARE_RETURNED` + `SPARE_CANCELLED(returned)` cuando el
    retorno deja `remainingQuantity = 0`. Retorno parcial: la solicitud sigue
    pendiente. Requiere registrar el listener en `kafka-listeners.orchestrator.ts`.
O2. **Bulk/reconciliación de inventory-core.** El bulk de órdenes
    (`async_spare_assignments_start`) solo lo responde el legacy. Si órdenes
    trunca y reconcilia, las asignaciones `inventory-core` desaparecen; y un
    evento enviado a la DLQ tras 3 fallos se pierde. Falta: responder bulk en
    cola propia (reconstruir desde líneas `OUT` con orden), `origin` en
    `syncBulk` y `getLastUpdatedAt` por origen en órdenes.
O3. Cancelación desde bodega: rechazar una solicitud y una solicitud que llega
    en la misma ventana que el retorno total (sin diseño).
O4. Retención: no hay limpieza de filas `SENT`; no hay herramienta para
    reintentar o marcar `FAILED`. `outbox.controller.ts` (sin ver) no está
    documentado.
O5. `returnSpare` legacy en órdenes crea `newAssignment` sin `id` (PK varchar
    sin generador) en el retorno parcial. No afecta a `inventory-core`; queda
    como deuda del legacy.
O6. Producción: migración de `outbox_events` con sus índices (ver raíz 24).

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