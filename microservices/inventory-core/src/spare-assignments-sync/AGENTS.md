# AGENTS.md — spare-assignments-sync (bulk hacia órdenes)

> Reglas de mantenimiento: ver sección 0 del AGENTS.md raíz del MS.

Estado: **Probado** (2026-11-14).

Responde el bulk de asignaciones `inventory-core` que pide el MS de órdenes al
arrancar. Reconstruye desde los vales reales, no depende de eventos: cubre un
evento caído a la DLQ o un truncate de `spare_assignments` en órdenes.

```
src/spare-assignments-sync/
  spare-assignments-sync.module.ts
  controllers/spare-assignments-sync.controller.ts   @MessagePattern({ cmd: 'async_core_spare_assignments_start' })
  services/spare-assignments-sync.service.ts         findForSync(fromCache)
```
- Comando distinto del legacy (`async_spare_assignments_start`). Valida
  `payload.internalToken === INTERNAL_SECRET`, si no `401`.
- Solo **responde**; no tiene `onModuleInit` ni cliente RMQ (eso es de órdenes).
- `findForSync`: una fila por línea `OUT` con orden, misma forma que el bulk del
  legacy más `origin: 'inventory-core'`. `status`: `returned` si no queda saldo;
  `cancellation_requested` si hay solicitud `PENDING`; si no `active`. `quantity`
  = lo que falta por devolver; con retorno total, la cantidad del último retorno
  (igual que `returnSpareInventoryCore`). `updatedAt` = máximo entre fecha del
  vale, último retorno y solicitudes. `fromCache` se retrocede 5 min
  (el upsert es idempotente).
- Cola donde escucha inventory-core: **(sin confirmar)** en este archivo; órdenes la
  recibe en `INVENTORY_CORE_QUEUE`.
- Límites: solo corre al arrancar órdenes (no en caliente), sin paginar, sin
  filtro por empresa (igual que el legacy), no reconstruye las solicitudes (eso
  lo hace `spare-cancellations`, sección 5).