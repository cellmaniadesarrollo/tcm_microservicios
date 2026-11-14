# AGENTS.md — products-replica (réplica de productos)

> Reglas de mantenimiento: ver sección 0 del `AGENTS.md` raíz del MS.

Estado: **Probado** (2026-11-12): bulk al arrancar y tiempo real por Kafka.

## 1. Qué es
Copia de lectura de los productos de inventory-core. Sin FK ni relaciones.
Inventory es el dueño; billing nunca la escribe fuera del sync.

## 2. Archivos
Estructura entregada (sin confirmar si la reorganizaste como `lots-replica/`):
```
products-replica/
  entities/product-replica.entity.ts
  types/product-snapshot.ts
  products-replica.service.ts      upsertMany, getLastUpdatedAt
  products-sync.service.ts         sync de arranque + cron diario
  products-events.listener.ts      topic de Kafka
  products-replica.module.ts
```

## 3. Modelo (`products_replica`)
PK `id` (uuid). `company_id`, `code`, `sku`, `upc`, `name` (nombre ya resuelto),
`description`, `kind`, `tracking_mode`, `product_type_id/code/name`,
`color_id/name`, `quality_id/name`, `model_ids` (int[]), `status`, `defaults`
(jsonb informativo: `basePrice`, `hasTax`, `priceIncludesTax`,
`billableInSales`, `billableInRepairOrders`, `warrantyDays`), `created_at`,
`updated_at` (**del origen**, es el guard de orden), `synced_at`.
Índices `(company_id, sku)` (no único, para que un conflicto no bloquee el
sync), `(company_id, status)`, `(updated_at)`.
Los catálogos (tipo, color, calidad, nombre) **no se replican**: solo sus nombres
ya resueltos dentro del producto. Modelos/marcas vienen de `devices-replica`.

## 4. Cómo sincroniza
- **Tiempo real:** topic `ms.inventory.core.product.upserted`, evento
  `PRODUCT_UPSERTED` (snapshot completo, también al desactivar/reactivar).
- **Upsert con guard:** `INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE
  products_replica.updated_at <= EXCLUDED.updated_at`. Con `<=` un reenvío del
  mismo estado se reaplica (corrige nombres de catálogo cambiados sin que cambie
  `updatedAt`). Un evento más viejo no pisa uno más nuevo.
- **Bulk:** comando RMQ `get_products_sync` a `inventory_core_queue_sync`,
  páginas de 500, cursor `"ISO|uuid"` ordenado por `(updated_at, id)`.
  Timeout 30 s por página.
  - Arranque: en segundo plano (`onApplicationBootstrap`), hasta 8 intentos con
    espera creciente. Tabla vacía ⇒ trae todo; si no, `updatedSince` =
    `max(updated_at)` − 1 día.
  - Cron diario `0 3 * * *` `America/Guayaquil`: pull **completo**. Es lo que
    recupera eventos perdidos (DLQ) y nombres de catálogo desactualizados.
- Forzar reconciliación: `TRUNCATE products_replica;` y reiniciar billing.

## 5. Pendientes
P1. `onConflict` está deprecado en TypeORM aunque funciona; alternativa: SQL
    crudo con `unnest`.
P2. Los nombres de catálogo solo se actualizan por el cron diario (los
    catálogos no tienen CRUD, solo seeds; si se agrega CRUD, inventory debe
    republicar los productos afectados).
P3. Si algún día se borran productos físicamente, la reconciliación no los
    detecta: harán falta tombstones.
P4. Chequeo liviano opcional (conteo y `max(updated_at)` por empresa) que
    dispare el completo solo si no cuadra.

## 6. Errores y lecciones
- Precisión: Postgres guarda microsegundos y JS milisegundos. Todas las fechas
  de producto se fijan desde JS en inventory y el sync usa
  `date_trunc('milliseconds', ...)`.
- El advisory lock de sesión se toma y suelta en la **misma conexión**
  (`QueryRunner`).

## 7. Cómo actualizar
Si cambia el snapshot, cambia `types/product-snapshot.ts` aquí **y**
`products/events/product-snapshot.ts` en inventory-core, más la entidad y el
`UPDATE_COLUMNS` del service.