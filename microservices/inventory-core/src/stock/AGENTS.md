# AGENTS.md — stock (lotes, saldos, unidades, kardex)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**
> (`microservices/inventory-core/AGENTS.md`). No se duplican aquí.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual; los
> marcadores `[ENTREGADO, SIN PROBAR]` y `(verificar)` se quitan solo con
> código visto o prueba ejecutada.

Núcleo del inventario. `StockService` es la **única puerta de escritura**:
ningún otro módulo escribe en lotes, saldos, unidades ni movimientos.
Consumidores: `receipts/` (entradas) y `stock-vouchers/` (salidas y retornos).

## 1. Archivos clave

- `stock/stock.service.ts`: `StockService` (ver sección 3).
- `stock/enums/stock.enums.ts`: `LotOriginType`, `UnitStatus`, `MovementType`.
- Entidades: `Lot`, `StockBalance`, `StockUnit`, `StockMovement`
  **(verificar)** nombres exactos de archivo en `stock/entities/`.
- Relacionadas (viven en `receipts/`): `StockUnitSerial`
  (`stock_unit_serials`).
- Correlativo de lotes y productos: `MAX(code)+1` con
  `pg_advisory_xact_lock` (patrón en `StockService` y `ProductsService`).
- `events/lot-snapshot.ts`: `buildLotSnapshots(em, ids)`.
- `lots-sync.controller.ts`: comando `get_lots_sync`. `StockModule` importa
  `OutboxModule` y declara este controller. `StockService` inyecta
  `OutboxService`.

## 2. Modelo de datos

| Entidad | Tabla | Notas clave |
|---|---|---|
| `Lot` | `lots` | Snapshot de las condiciones con que entró una cantidad: `code` (correlativo por empresa; lo que codifica el QR), `origin_type` (`LotOriginType`) + `origin_id` (= `receipt_lines.id`, sin FK), `quantity_received`, `unit_cost` (sin impuesto, 4 dec.), `sale_price`, `warranty_days`, `has_tax`, `price_includes_tax`, `billable_in_sales`, `billable_in_repair_orders`, `created_by_id`. **No guarda existencias.** CHECK: repair ⇒ sales; cantidad > 0; costo/precio/garantía ≥ 0. Un lote confirmado no se edita con CRUD (solo "regularizar", con auditoría, **pendiente**, ver 12 en `stock-vouchers/`). |
| `StockBalance` | `stock_balances` | PK `(lot_id, branch_id)`. `on_hand`, `reserved` (hoy 0), `available = on_hand − reserved`. CHECK `on_hand ≥ 0` y `0 ≤ reserved ≤ on_hand`. Hoy una fila por lote (sucursal principal). Índices `(company_id, product_id, branch_id)` y `branch_id`. |
| `StockUnit` | `stock_units` | Unidad física de producto serializado. `serial` normalizado (trim + mayúsculas), `status` (`UnitStatus`), lote y sucursal. Único `(empresa, producto, serial)`. |
| `StockUnitSerial` | `stock_unit_serials` | Todos los IMEI/seriales de una unidad (posición 0 = principal, copiado a `stock_units.serial`). Único `(empresa, producto, valor)`. |
| `StockMovement` | `stock_movements` | **Kardex: solo se insertan filas**, nunca se editan ni se borran. `quantity` **con signo** (+ entra, − sale). En serializados hay **un movimiento por unidad** (`±1`, con `unit_id`). `unit_cost` = copia del costo del lote al momento. `reference_type` (varchar 30) + `reference_id` (**uuid**, sin FK) = documento origen. |

`reference_id` es uuid: por eso el kardex de un vale apunta al **vale**
(`reference_type = 'STOCK_VOUCHER'`) y la orden (id entero) vive en el vale.

## 3. Enums (`stock/enums/stock.enums.ts`)

- `LotOriginType`: `RECEIPT, ADJUSTMENT, RETURN, OPENING`.
- `UnitStatus`: `AVAILABLE, RESERVED, SOLD, CONSUMED, RETURNED` + **`ISSUED`**
  (nuevo: en poder de un empleado por una salida manual). `CONSUMED` = usada en
  una orden de reparación (otro flujo); `RETURNED` existe pero **no** se usa en
  los vales **(verificar su significado original)**.
- `MovementType`: `RECEIPT_IN, RECEIPT_VOID, SALE_OUT, REPAIR_CONSUMPTION,
  TRANSFER_OUT, TRANSFER_IN, ADJUSTMENT, RETURN_IN` + **`INTERNAL_OUT`**
  (nuevo: salida manual sin orden).
- `ISSUED` e `INTERNAL_OUT` **pendientes de aplicar**: en pruebas basta con
  `synchronize`; en producción requieren `ALTER TYPE ... ADD VALUE` (ver raíz
  sección 4 y pendiente 24).

## 4. `StockService` (única puerta al inventario)

| Método | Qué hace |
|---|---|
| `registerInbound(em, input)` | Crea lote por línea, saldo, unidades serializadas y kardex (`RECEIPT_IN` por defecto). Valida seriales (no repetidos en el ingreso ni en stock). Correlativo de lotes con `MAX(code)+1` + advisory lock. Al final, en la misma transacción, encola un `LOT_UPSERTED` por lote creado. |
| `registerOutbound(em, input)` `[ENTREGADO]` | Saca stock de lotes concretos: bloquea saldos y unidades (orden estable), valida disponibilidad y estado, descuenta `on_hand`, marca unidades `ISSUED`, inserta kardex (`REPAIR_CONSUMPTION` o `INTERNAL_OUT`; −qty o −1 por unidad). Devuelve el snapshot del lote por línea (`OutboundLineResult`: `lineRef, productId, lotId, quantity, unitCost, salePrice, billable…`). |
| `registerReturn(em, input)` `[ENTREGADO]` | Regresa al mismo lote/sucursal: suma `on_hand`, unidades `ISSUED` → `AVAILABLE`, kardex `RETURN_IN` (+qty o +1 por unidad). **Quien llama valida que lo retornado no supere lo sacado.** |
| `availability(companyId, productIds, branchId?)` | Disponibilidad por producto, separando lo facturable en ventas y en órdenes. |
| `listLotsWithStock(companyId, productId, branchId?, filters?)` | Lotes con existencias (`on_hand > 0`), más antiguos primero (para elegir lote o resolver el QR). `filters` opcional: `{ billableInRepairOrders?, billableInSales? }`; cada filtro solo se aplica si no es `undefined`. |
| `listAvailableUnits(companyId, lotId, branchId?)` `[ENTREGADO]` | Unidades `AVAILABLE` de un lote con todos sus IMEI. |
| `syncLotsPage({ cursor?, createdSince?, limit? })` | Página de snapshots de lotes (todas las empresas), orden `(created_at, id)`, cursor `"ISO|uuid"`, máx. 1000. |

- Todas las operaciones de escritura reciben el `EntityManager` de quien
  confirma (van **dentro de su transacción**).
- **Bloqueos:** `SELECT ... FOR UPDATE` (`setLock('pessimistic_write')`) sobre
  saldos y unidades **ordenado por id** (`lot_id`, `u.id`) para evitar
  deadlocks. Validar disponibilidad en el servicio **antes** de que salten los
  `CHECK` de la BD (mensaje en español con número de línea y lote).
- **Anular un ingreso** (pendiente, ver `receipts/`): "lote sin consumir" =
  `on_hand = quantity_received` **y** sin unidades `ISSUED`; una salida manual
  pendiente de retorno bloquea la anulación.

## 5. Estado

| Componente | Estado |
|---|---|
| `registerInbound`, `availability`, `listLotsWithStock` (sin filtros) | Construido y en uso (según el historial previo). |
| `registerOutbound`, `registerReturn`, `listAvailableUnits`; `listLotsWithStock` con filtros | **ENTREGADO como parche, SIN PROBAR.** **(verificar)** que se pegó y que `Product` está importado. |
| Enums `UnitStatus.ISSUED`, `MovementType.INTERNAL_OUT` | **Pendiente de aplicar.** |

La prueba end-to-end está descrita en `stock-vouchers/AGENTS.md` (sección 8).

## 6. Pendientes (numeración conservada)

15. Decidir unicidad de IMEI **global por empresa** (hoy por producto).
16. Reservas de stock (`reserved`) dependen de ventas/órdenes, hoy en 0.
17. Stock por sucursal (`byBranch`) cuando existan transferencias.
18. **Flujo de venta con billing** (sin construir): `list_sale_lots`,
    `create_sale_outbound`, `return_sale_outbound`, idempotentes con
    `clientRequestId`, `MovementType.SALE_OUT` (ya existe), kardex con
    `reference_type = 'SALE'` y `reference_id` = id de la venta de billing.
    Venta siempre de la sucursal principal. (Numeración propia a confirmar
    para no chocar con los existentes.)

Relacionados en otros módulos: 12 (regularizar lote) y 26 (sucursal de las
salidas) en `stock-vouchers/`; 2 (anular ingreso) en `receipts/`.

## 7. Errores y lecciones propios del módulo

- `reference_id` del kardex es **uuid**: no sirve para ids enteros (órdenes).
  Referenciar el documento propio y guardar la orden en él.
- Validar stock en el servicio antes de que salten los `CHECK` de saldo.
- Si se cambian enums de BD (`UnitStatus`, `MovementType`), limpiar el tipo
  anterior o migrar (`ALTER TYPE ... ADD VALUE` en producción).
- Cambiar la firma de un método de `StockService` obliga a buscar todos sus
  llamadores (TypeScript marca error en los que quedaron con argumentos viejos).

## 8. Cómo actualizar este archivo
Al cambiar un método de `StockService`, una entidad o un enum: actualizar las
secciones 2–4. Si cambia el contrato con vales o ingresos, anotarlo también en
`stock-vouchers/AGENTS.md` o `receipts/AGENTS.md`. Reglas completas en la
sección 0 de la raíz.

## 9. Réplica de lotes hacia billing (Probado 2026-11-12)
- **Snapshot** (`LotSnapshot`): `id, companyId, productId, code, originType,
  quantityReceived, salePrice, warrantyDays, hasTax, priceIncludesTax,
  billableInSales, billableInRepairOrders, createdAt`. **No** viaja `unitCost`
  (dato sensible) ni saldos ni unidades.
- Un ingreso que falla (p. ej. serial repetido) revierte la transacción y no
  deja evento.
- Lo único que cambia un lote tras crearse es "regularizar" (no construido): al
  construirlo, agregar `updated_at` a `lots`, reenviar el evento y usar guard
  de fecha en billing.
- Lado consumidor: `ms-billing/src/lots-replica/AGENTS.md`.