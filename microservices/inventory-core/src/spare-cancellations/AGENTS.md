# AGENTS.md — spare-cancellations (solicitudes de cancelación de repuestos)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**. No se duplican aquí.

Estado: **Probado** (2026-11-14): recepción de solicitudes, cierre por retorno
total y reconciliación con órdenes. **Falta** (otro hilo): endpoints de bodega
para listar, aceptar y rechazar (pendiente O7).

## 1. Qué es
El MS de órdenes (dueño de la solicitud) pide cancelar un repuesto asignado con
`origin = 'inventory-core'`. Este módulo **registra la intención; no mueve
stock**. El stock vuelve cuando bodega registra un retorno `NO_REQUERIDO`
(`stock-vouchers`), y ese retorno total cierra la solicitud.

## 2. Archivos
```
src/spare-cancellations/
  spare-cancellations.module.ts
  entities/spare-cancellation-request.entity.ts
  services/spare-cancellations.service.ts
  listeners/spare-cancellations-events.listener.ts
```
- Módulo: `TypeOrmModule.forFeature([SpareCancellationRequest])`, `OutboxModule`
  y un proveedor `ORDERS_CANCELLATIONS_SYNC` (`ClientProxyFactory` RMQ, `null` si
  falta `ORDERS_CANCELLATIONS_QUEUE`). Exporta listener y servicio.
- Lo importan `KafkaModule` (registro del listener) y `StockVouchersModule`
  (inyecta `SpareCancellationsService`). Sin dependencia circular.
- El listener se registra en `kafka-listeners.orchestrator.ts`.

## 3. Modelo de datos
`spare_cancellation_requests`: `id` (uuid), `request_id` (uuid, único),
`company_id` (nulo si la línea no existe), `movement_id` (varchar = **id de la
línea de salida**, sin FK), `order_id`, `status` (varchar: `PENDING` /
`CONFIRMED` / `REJECTED`), `reason`, `requested_by_id`, `error_detail`,
`confirmed_at`, `created_at`, `updated_at`.
Índice único parcial `uq_scr_pending_movement (movement_id) WHERE status='PENDING'`:
una sola solicitud pendiente por línea.

## 4. Flujo
1. Órdenes publica `SPARE_CANCELLATION_REQUESTED` en
   `ms.inventory.core.spare.cancellation.requested` (el legacy **no** consume
   ese topic). Payload: `request_id`, `movement_id`, `order_id`, `reason`,
   `requested_by_id`, etc.
2. `handleRequested(data)` (idempotente por `request_id`; una reentrega reenvía
   la respuesta guardada) valida y guarda:

   | Caso | Resultado |
   |---|---|
   | `movement_id` no uuid o línea inexistente | `REJECTED` "Asignación no encontrada" |
   | Línea de otra orden o vale que no es salida | `REJECTED` |
   | Orden ENTREGADA (8) | `REJECTED` |
   | Orden no replicada | `REJECTED` (reintentar luego) |
   | Línea ya devuelta por completo | `REJECTED` |
   | Ya hay otra `PENDING` (índice único) | `REJECTED` |
   | Procede | `PENDING` |
3. Responde **directo con `emit`** (no outbox, porque puede no haber `companyId`)
   `SPARE_CANCELLED` en `ms.inventory.spare.cancelled`:
   `cancellation_requested` si `PENDING`; `active` + `error_detail` si
   `REJECTED`. Si `emit` devuelve `false`, el handler lanza y el consumer
   reintenta (3 veces, luego DLQ).
4. **Cierre:** `confirmForReturnedLines(em, companyId, lineIds)` se llama desde
   `StockVouchersService.enqueueSpareReturned` **dentro de la transacción del
   retorno**, para las líneas con `remainingQuantity = 0`: pasa `PENDING` →
   `CONFIRMED` y devuelve un `SPARE_CANCELLED` con `assignment_status: 'returned'`
   (misma key que el `SPARE_RETURNED`, mayor `seq`), que `enqueueSpareReturned`
   encola en el outbox. Retorno parcial: la solicitud sigue `PENDING`.
5. En órdenes `active` con `error_detail` = `REJECTED`; `active` sin detalle =
   `FAILED`.

## 5. Recuperación (paso 12b)
Timers propios (`setTimeout`/`setInterval`, `unref`), sin `@nestjs/schedule`:
- **Barrido** `sweepFullyReturned()`: al arranque (+15 s) y cada
  `SPARE_SWEEP_MS` (60 s). Confirma las `PENDING` cuya línea ya tiene saldo 0
  (carrera entre solicitud y retorno, o cierre perdido). Transacción +
  outbox + `dispatchNow`. Banderas contra solapes.
- **Reconciliación** `reconcileWithOrders(resendPending)`: al arranque y cada
  `SPARE_RECONCILE_MS` (10 min). Pide a órdenes `async_spare_cancellations_start`
  (`internalToken`, `fromCache` = max `updated_at` − 5 min), toma las `PENDING`
  con `request_id` y `movement_id` uuid **que sean líneas de este MS** y llama
  `handleRequested`. Sin fila local: la crea y responde. Con `CONFIRMED` o
  `REJECTED`: reenvía la respuesta. Con `PENDING`: solo en el arranque.
  **Las solicitudes legacy se ignoran siempre** (nunca se responde por ellas).
- Sin `ORDERS_CANCELLATIONS_QUEUE` la reconciliación se omite; el barrido sigue.

## 6. Variables de entorno
`ORDERS_CANCELLATIONS_QUEUE` (cola donde escucha órdenes; **valor sin confirmar**
en este archivo), `RABBIT_URL` (nombre **(sin confirmar)** en inventory-core),
`INTERNAL_SECRET`, opcionales `SPARE_SWEEP_MS`, `SPARE_RECONCILE_MS`.

## 7. Pendientes
O7. **Endpoints de bodega (otro hilo):** listar solicitudes `PENDING` (con
    `originVoucherId` y `originLineId` para precargar el retorno), **rechazar**
    (marcar `REJECTED` + `error_detail` y encolar en el outbox un `SPARE_CANCELLED`
    `active` con detalle; idempotente, validar `PENDING` y empresa). "Aceptar" ya
    existe: es registrar el retorno `NO_REQUERIDO` con `POST /stock-vouchers`.
    Decisión abierta: si el front debe forzar el retorno total (hoy el parcial
    deja la solicitud pendiente). Permisos: raíz 22.
O8. La respuesta inicial `cancellation_requested` perdida con la solicitud
    `PENDING` en ambos lados solo se reenvía en el arranque (decisión
    consciente).
O9. La reconciliación no está paginada (un solo mensaje RMQ de órdenes).
    **(sin confirmar)** que el `return result` del bulk de órdenes responda a un
    `ClientProxy` normal; su envío manual solo cubre el `replyTo` del legacy.

## 8. Errores y lecciones
- Las respuestas de este módulo salen por `emit` directo porque la línea puede no
  existir (sin `companyId`). Las de cierre van por outbox porque la atomicidad con
  el retorno importa.
- Responder `active` a una solicitud legacy la rechazaría por error: filtrar por
  línea propia antes de reconciliar.
- El legacy no puede recibir ids uuid en su handler de cancelación (`findById`
  lanza `CastError`): por eso el topic aparte.