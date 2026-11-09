# AGENTS.md — products (catálogo de productos / SKU)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual.
> Los marcadores `[ENTREGADO, SIN PROBAR]` y `(verificar)` se quitan solo con
> código visto o prueba ejecutada.

Ficha de catálogo (SKU). **No guarda existencias, costos ni condiciones
fiscales reales**: eso vive en lote, saldos y unidades (`stock/AGENTS.md`).

## 1. Archivos
- `products.service.ts`: `receiptItemsQuery`, `mapReceiptItems`,
  `findReceiptItemsByIds`, `searchForReceipt`, `list`, `findOne`.
- Catálogos auxiliares en `product-catalogs/` (tipos, nombres, colores,
  calidades, usos; seeds json).
- Tablas usadas en consultas crudas (réplica de dispositivos):
  `brands (brands_id, brands_name)`, `models (models_id, models_name, models_brands_id)`,
  `model_technical_codes (mtc_models_id, mtc_code)`, `product_models (product_id, model_id)`.

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

## 5. Pendientes
Relacionados en `stock-vouchers/`: 8 (buscador de productos con existencias,
requiere ver `ProductsService`) y 9 (nombre del producto, requiere entidad
`ProductName`).

## 6. Errores y lecciones
- Correlativo de productos con `MAX(code)+1` + `pg_advisory_xact_lock`: no
  usar `SequencesService` aquí.