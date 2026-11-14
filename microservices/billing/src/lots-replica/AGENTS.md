# AGENTS.md — lots-replica (réplica de lotes, sin saldos)

> Reglas de mantenimiento: ver sección 0 del `AGENTS.md` raíz del MS.

Estado: **Probado** (2026-11-12).

## 1. Qué es
Copia de lectura de los **lotes** de inventory-core. **No replica existencias,
saldos ni unidades/IMEI ni `unit_cost`**. Sirve para guardar `lot_id` y
`lot_code` en una factura, mostrar precio/banderas de IVA y validar que el lote
pertenece al producto. La disponibilidad y el descuento irán por RabbitMQ
síncrono contra inventory (ver raíz, decisión 2).

## 2. Archivos
```
lots-replica/
  lots-replica.module.ts
  controllers/lots-replica.controller.ts   (sin ver: lo creaste tú; completar)
  entities/lot-replica.entity.ts
  listeners/lots-events.listener.ts
  services/lots-replica.service.ts         upsertMany, getLastCreatedAt
  services/lots-sync.service.ts            sync de arranque + cron diario
```
Los imports de mi entrega asumían estructura plana: tras tu reorganización hay
que ajustar rutas `(verificar)`.

## 3. Modelo (`lots_replica`)
PK `id`. `company_id`, `product_id` (sin FK), `code`, `origin_type`,
`quantity_received` (cantidad **recibida**, no existencia), `sale_price`,
`warranty_days`, `has_tax`, `price_includes_tax`, `billable_in_sales`,
`billable_in_repair_orders`, `created_at` (del origen), `synced_at`.
Índices: `(company_id, product_id)`, único `(company_id, code)`, `(created_at)`.

## 4. Cómo sincroniza
- **Tiempo real:** topic `ms.inventory.core.lot.upserted`, evento
  `LOT_UPSERTED`, key = `lotId`. Inventory lo encola en
  `StockService.registerInbound` (única puerta de entrada de lotes), dentro de
  la transacción del ingreso; si el ingreso se revierte, no hay evento.
- **Upsert:** `ON CONFLICT (id) DO UPDATE` sin guard de fecha, porque el lote no
  cambia tras crearse.
- **Bulk:** comando `get_lots_sync`, páginas de 500, cursor `"ISO|uuid"` por
  `(created_at, id)`. Arranque en segundo plano con reintentos (8) y traslape
  de 1 día; cron diario `15 3 * * *` `America/Guayaquil` (pull completo).
- Forzar reconciliación: `TRUNCATE lots_replica;` y reiniciar billing.

## 5. Pendientes
L1. **Regularizar lote** (editar banderas de un lote confirmado; pendiente en
    inventory, ver `stock-vouchers/` 12): hará falta `updated_at` en `lots`, un
    guard como el de productos y reenviar el evento. Hoy un cambio no llegaría.
L2. Si un lote se borrara en origen, la reconciliación no lo elimina aquí.
L3. El índice único `(company_id, code)` podría chocar si el origen reutiliza un
    código; hoy el correlativo es `MAX(code)+1` por empresa.
L4. Documentar `lots-replica.controller.ts` (no se vio).

## 6. Lo que NO es esta réplica
Para vender: lotes con stock y unidades, y el descuento, se piden a
inventory-core (pendiente B1 de la raíz de billing).