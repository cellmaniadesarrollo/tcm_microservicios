# AGENTS.md — products (catálogo de productos / SKU)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual.
> Los marcadores `[ENTREGADO, SIN PROBAR]` y `(verificar)` se quitan solo con
> código visto o prueba ejecutada.

Ficha de catálogo (SKU). **No guarda existencias, costos ni condiciones
fiscales reales**: eso vive en lote, saldos y unidades (`stock/AGENTS.md`).

## 1. Archivos (adición)
- `events/product-snapshot.ts`: `buildProductSnapshots(em, ids, companyId?)`.
  Snapshot compartido por el evento y el sync.
- `ProductsService`: `enqueueProductUpserted` (privado) y `syncPage`.
- `ProductsController`: comando `get_products_sync`.
- `ProductsModule` importa `OutboxModule`.

## 2. Modelo (`products`)
- `code` (correlativo por empresa, inmutable; `MAX(code)+1` con advisory lock),
  `sku` (`{KIND}-{TIPO}-{MARCA}-{code}`, inmutable), `upc`, `product_name_id`
  (relación `productName`), `kind` (`ProductKind`, debe coincidir con el tipo),
  `tracking_mode` (`QUANTITY` | `SERIAL`), `product_type_id`, `color_id`,
  `quality_id`, `min_stock`, usos (`usages`, mínimo uno), modelos compatibles,
  imágenes.
- CHECK: un `DEVICE` siempre es `SERIAL`.
- Valores por defecto (`warranty_days`, `base_price`, `has_tax`,
  `price_includes_tax`, `billable_in_sales`, `billable_in_repair_orders`)
  **solo precargan el ingreso**; el lote guarda su copia.
- Validaciones en servicio: al menos un uso; `kind` = `productType.kind`; un
  DEVICE tiene exactamente un modelo compatible; `billableInRepairOrders`
  exige `billableInSales`.

## 3. Gateway (repo aparte)
- `GET products`: listado con `stock { onHand, reserved, available, billable…, status OUT|LOW|OK }`,
  `lastLot`, filtros `stockStatus/trackingMode/qualityId`, orden por stock,
  `includeFilters`.
- `GET products/:id`: ficha + `stock`, `lots` con ingreso de origen, `units`
  con IMEI, `movements` (kardex), `history`.
- Buscador para ingresos (`products/search`): ver `receipts/AGENTS.md`.

## 4. Estado

Construido y en uso (según el historial previo).

## 5. Pendientes (adición)

Relacionados en `stock-vouchers/`: 8 (buscador de productos con existencias,
requiere ver `ProductsService`) y 9 (nombre del producto, requiere entidad
`ProductName`).

- `restore` existe en el service pero **no tiene comando** en el controller
  (`(verificar)` gateway): el evento saldrá cuando exista el endpoint.
- Si se crea CRUD de catálogos (hoy solo seeds), republicar los productos
  afectados.

## 6. Errores y lecciones

- Correlativo de productos con `MAX(code)+1` + `pg_advisory_xact_lock`: no
  usar `SequencesService` aquí.

## 7. Réplica hacia billing (Probado 2026-11-12)

- `create`, `update` (solo si hubo cambio real), `remove` y `restore` encolan
  un `PRODUCT_UPSERTED` dentro de la transacción; `void outbox.dispatchNow(ids)`
  tras el commit y fuera del `try` que limpia S3.
- **Fechas:** `createdAt/updatedAt` se fijan desde JS (`new Date()`) y en
  `update/remove/restore` después de tomar el lock. `update` fija `updatedAt`
  también si solo cambiaron modelos/usos.
- **Snapshot** (`ProductSnapshot`): `id, companyId, code, sku, upc, name,
  description, kind, trackingMode, productTypeId/Code/Name, colorId/Name,
  qualityId/Name, modelIds, status, defaults{basePrice, hasTax,
  priceIncludesTax, billableInSales, billableInRepairOrders, warrantyDays},
  createdAt, updatedAt` (ISO, ms). No viajan imágenes ni usos.
- **Sync:** `get_products_sync` `{ cursor?, updatedSince?, limit }` (máx. 1000,
  defecto 500) → `{ items, nextCursor }`. Todas las empresas, incluye
  inactivos, orden `(date_trunc('milliseconds', updated_at), id)`. El token lo
  valida `InternalAuthInterceptor` global.
- Lado consumidor: `ms-billing/src/products-replica/AGENTS.md`.
