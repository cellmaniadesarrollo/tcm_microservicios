# AGENTS.md — stock-vouchers (movimientos manuales de stock)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**
> (`microservices/inventory-core/AGENTS.md`). No se duplican aquí.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual; los
> marcadores `[ENTREGADO, SIN PROBAR]` y `(verificar)` se quitan solo con
> código visto o prueba ejecutada.

Salidas (a técnico/empleado, con o sin orden) y retornos de stock. Un vale es
un documento **inmutable** con fotos por línea. Todo lo marcado
**[ENTREGADO, SIN PROBAR]** se escribió y pasó revisión de sintaxis, pero no se
ha ejecutado contra Postgres ni compilado con el type-check completo del repo.

## 1. Archivos clave y dependencias

- `stock-vouchers.service.ts`: `create` / `createOut` / `createIn`, `list`,
  `getDetail`, `getOrderSummary`, `searchLots`, `listLotUnits`, `getNewData`,
  `uploadPhotos(companyId, voucherId, files, lineCount)`, `mapAttachments`
  (devuelve `Map<lineId, fotos[]>`), `returnProgress`, **`returnState`** (regla
  única de `canReturn`/`returnBlock`, usada por `list` y `getDetail`),
  `replay`, `summary`, `normalizeInput`.
- `stock-vouchers.controller.ts`, `stock-vouchers.module.ts`.
- `entities/` (5 entidades, ver sección 2).
- `enums/stock-voucher.enums.ts`: `VoucherDirection`, `ReasonOrderLink`,
  constantes de estados de orden (`ORDER_STATUSES_BLOCK_ISSUE = [8,9,10]`,
  `ORDER_STATUSES_BLOCK_RETURN = [8]`).
- `seeds/stock-movement-reasons.seed.ts`.
- `helpers/stock-voucher-attachments.helper.ts` vive en el **gateway**
  (`prepareStockVoucherFiles`, ver parte 2).

**Módulos a importar en `StockVouchersModule`:**
`TypeOrmModule.forFeature([StockMovementReason, StockVoucher, StockVoucherLine, StockVoucherLineUnit, StockVoucherAttachment])`,
`CompaniesModule`, `StockModule`, `SequencesModule`, `AuditLogModule`,
**`AwsS3Module`** (nuevo). Lee `OrderReplica` y `UserEmployeeCache` por
`EntityManager` (sus módulos ya registran las entidades vía `autoLoadEntities`).

**`StockVouchersService` inyecta:**
`DataSource, StockService, SequencesService, AuditLogService, MainBranchService, AwsS3Service`.

**Regla de oro:** el stock se mueve únicamente a través de `StockService`
(ver `stock/AGENTS.md`).

## 2. Modelo de datos  [ENTREGADO, SIN PROBAR]

| Entidad | Tabla | Notas clave |
|---|---|---|
| `StockMovementReason` | `stock_movement_reasons` | Catálogo **por empresa** (reemplaza `name_movement`/`name_movementtype` del legacy Mongo). `code`, `name`, `direction` (`OUT`/`IN`), `order_link` (`REQUIRED`/`FORBIDDEN`), `is_returnable`, `is_system`, `status`, `sort_order`. Único `(company_id, code)`. FK a `CompanyReplica` con CASCADE. |
| `StockVoucher` | `stock_vouchers` | Cabecera **inmutable**: `code` (correlativo `stock_voucher_code`, `update: false`), `direction`, `reason_id`, `branch_id`, `employee_id` (sin FK), `order_id` + `order_number` (sin FK; snapshot), `origin_voucher_id` (solo retornos), `note`, `client_request_id` + `request_hash`, `created_by_id`, `created_at` (timestamptz). Únicos `(company, code)` y `(company, client_request_id)`. CHECK: `(direction='IN') = (origin_voucher_id IS NOT NULL)` y `(order_id IS NULL) = (order_number IS NULL)`. |
| `StockVoucherLine` | `stock_voucher_lines` | `line_no`, `product_id`, `lot_id`, `quantity > 0`, **snapshot** del lote (`unit_cost`, `sale_price`, `billable_in_sales`, `billable_in_repair_orders`), `origin_line_id` (retornos). Único `(voucher_id, line_no)`. FK a voucher/producto/lote con RESTRICT. **(verificar)** índice en `origin_line_id` (lo usan el listado y `returnProgress`). |
| `StockVoucherLineUnit` | `stock_voucher_line_units` | PK `(line_id, unit_id)`: qué IMEI/seriales se movieron en cada línea serializada. |
| `StockVoucherAttachment` | `stock_voucher_attachments` | **[ENTREGADO, SIN PROBAR]** Fotos **por línea** del vale (estado del repuesto al salir o al regresar). `company_id`, `voucher_id` (FK RESTRICT, índice), **`line_id`** (FK a `stock_voucher_lines`, RESTRICT, índice, NOT NULL), `file_key` (S3), `original_name`, `mime_type`, `size_bytes`, `sort_order` (base 0, **dentro de su línea**), `created_by_id`, `created_at`. **Solo inserción** (el vale es inmutable). Antes eran por vale: al migrar una base de pruebas hay que vaciar la tabla (`TRUNCATE stock_voucher_attachments;`) porque `line_id` es NOT NULL. |

**Kardex de un vale:** `reference_type = 'STOCK_VOUCHER'` y `reference_id` =
id del **vale** (uuid). La orden (id entero) vive en el vale, no en el kardex
(`reference_id` es uuid; ver errores en la raíz).

**Enums de stock que usa este módulo** (definidos en `stock/`):
`UnitStatus.ISSUED` (en poder de un empleado por una salida manual) y
`MovementType.INTERNAL_OUT` (salida manual sin orden). `REPAIR_CONSUMPTION` es
la salida con orden; `RETURN_IN` es el retorno. Aplicar con `synchronize` en
pruebas (ver pendiente 24 de la raíz para producción).

## 3. Motivos de sistema (seed)

Nombres según el legacy. La siembra vive en `CatalogsService`
(ver `catalogs/AGENTS.md`), aunque la entidad esté aquí, a propósito: evita
dependencia circular entre módulos.

| code | nombre | dirección | orden | retornable |
|---|---|---|---|---|
| `REPARACION_DANO` | REPARACION DAÑO | OUT | REQUIRED | sí |
| `USO_LAB` | USO LAB | OUT | FORBIDDEN | sí |
| `REMANOFACTURAR` | REMANOFACTURAR | OUT | FORBIDDEN | no |
| `RECICLAJE` | RECICLAJE | OUT | FORBIDDEN | no |
| `NO_REQUERIDO` | NO REQUERIDO | IN | REQUIRED (solo sobre salidas con orden) | — |
| `DEVOLUCION` | DEVOLUCION | IN | FORBIDDEN (solo sobre salidas sin orden) | — |

- Legacy: `id_type_movement` `657cb079…` = SALIDA, `658d863e…` = ENTRADA.
  **No se migra historial**: se empieza desde cero.
- `DEVOLUCION` es nuevo (contraparte sin orden de NO REQUERIDO).
- `is_returnable = false` en REMANOFACTURAR y RECICLAJE es una **suposición**
  (editable en el seed o en la tabla).

## 4. Estados de orden y su efecto en inventario

Datos reales de producción del ms orders. La réplica está en
`orders-relay/AGENTS.md`.

| id | nombre | efecto en inventario |
|---|---|---|
| 1 | INGRESADO | admite repuestos y retornos |
| 2 | VISTA | ídem |
| 3 | EN REVISION | ídem |
| 4 | EN ESPERA APROBACION | ídem |
| 5 | EN BUSQUEDA REPUESTO | ídem |
| 6 | EN REPARACION | ídem |
| 7 | TRABAJO FINALIZADO | ídem |
| **8** | **ENTREGADA** | **inmutable: no admite salidas ni retornos** |
| 9 | PASAR A BODEGA | no admite salidas nuevas; **sí** retornos (ahí se devuelve a bodega) |
| 10 | EN INVENTARIO | no admite salidas nuevas; sí retornos |

Constantes: `ORDER_STATUSES_BLOCK_ISSUE = [8,9,10]`,
`ORDER_STATUSES_BLOCK_RETURN = [8]`.

## 5. Reglas de negocio

1. **Un vale es un documento inmutable** (cabecera + líneas + fotos). No se
   edita ni se borra. Un error se corrige con un **retorno**. El kardex también
   es solo-inserción.
2. **Dirección y reglas salen del motivo** (`StockMovementReason`):
   `direction` (OUT/IN) y `order_link`. Para OUT: `REQUIRED` exige `orderId`,
   `FORBIDDEN` lo prohíbe. Para IN: indica sobre qué salidas aplica (con o sin
   orden).

3. **Salida (OUT):**
   - Exige `employeeId` (debe existir en `user_employee_cache` de la empresa).
   - Con orden: la orden debe existir en `orders_replica` de la empresa y
     **no** estar en estados 8/9/10. Tipo de movimiento `REPAIR_CONSUMPTION`.
     Sin orden: `INTERNAL_OUT`.
   - **El lote lo elige el usuario** (`lotId` obligatorio por línea). No hay
     FIFO automático (los lotes tienen distinta facturabilidad en órdenes; un
     FIFO silencioso podría cobrar mal). El front recibe los lotes ordenados
     por antigüedad.
   - Un mismo lote no puede repetirse en dos líneas del mismo vale.
   - Sale de la sucursal principal (hoy; ver pendiente 26); valida
     `on_hand − reserved ≥ cantidad`; nunca deja stock negativo.
   - Productos `SERIAL`: `unitIds.length = quantity`, unidades `AVAILABLE` del
     lote y la sucursal; pasan a `ISSUED`. Productos por cantidad no llevan
     `unitIds`.
   - La línea guarda el **snapshot** del lote (costo, precio, banderas).

4. **Retorno (IN)** (caso típico: el repuesto no se ocupó en la orden):
   - Se crea con el mismo `POST /stock-vouchers` (no hay endpoint propio): el
     servidor lo trata como retorno porque el motivo es de dirección `IN`.
   - Referencia **un solo** vale de salida (`originVoucherId`) cuyo motivo sea
     `is_returnable`. Cada línea apunta a una línea de ese vale
     (`originLineId`).
   - **Hereda** del vale original: empleado, orden, sucursal y snapshot de
     costo/precio. Si el cliente envía empleado/orden distintos → 400; si envía
     `lotId` → 400.
   - Vuelve al **mismo lote y sucursal** (conserva el costo). Los seriales
     vuelven como la **misma unidad** (`ISSUED` → `AVAILABLE`); no se crea otra.
   - `devuelto ≤ sacado − ya devuelto` por línea; las líneas de origen se
     bloquean (`FOR UPDATE`) para serializar retornos concurrentes. En
     serializados, solo unidades de esa línea aún no retornadas (se verifica
     con las líneas de retorno que apuntan a la origen) y con estado `ISSUED`.
   - El motivo IN debe ser compatible: `REQUIRED` ⇒ la salida tenía orden
     (NO REQUERIDO); `FORBIDDEN` ⇒ no tenía (DEVOLUCION).
   - Si la orden está ENTREGADA (8) **no** admite retorno (inmutable). Si la
     orden no está en la réplica (p. ej. mientras se repuebla) se **rechaza**
     con mensaje de reintentar, en vez de dejar pasar el cambio.
   - **Decisiones tomadas:**
     (a) la pieza vuelve a la **sucursal del vale original**, aunque lo
     devuelva un usuario de otra sucursal (consistente con el kardex mientras
     no haya transferencias);
     (b) la pieza devuelta queda **siempre `AVAILABLE`**, sin condición
     "dañado" (la foto de retorno es la evidencia; ver pendiente 33);
     (c) **cualquier usuario autenticado** puede devolver cualquier salida, no
     solo el empleado que la recibió (permisos: pendiente 22 de la raíz);
     (d) "devolver todo lo pendiente" es solo un atajo del front (precarga
     líneas con `pending > 0` y unidades con `returned: false`), sin endpoint
     nuevo.
   - **Efecto en el costo:** el costo neto de la orden baja (salidas − retornos
     con costo congelado). Si la orden ya se facturó antes de pasar a 8, ese
     ajuste no se refleja en facturación (fuera de este módulo).

5. **Puede devolverse (`canReturn`):** lo calcula el servidor con
   `returnState(...)` (una sola función para listado y detalle). Es `true`
   solo si se cumplen todas: el vale es `OUT`; `reason.isReturnable`; queda
   algo pendiente (`pending > 0`); y, si tiene orden, la orden está en la
   réplica y su estado no es 8. Si no, `returnBlock` explica por qué:
   `IS_RETURN`, `NOT_RETURNABLE`, `FULLY_RETURNED`, `ORDER_DELIVERED` o
   `ORDER_UNKNOWN`. Es una **guía visual**: el servidor vuelve a validar todo
   al crear el retorno, y la réplica puede ir por detrás de la orden real
   (pendiente 11).

6. **Fotos del vale [ENTREGADO, SIN PROBAR]:** **por línea (por producto)**,
   siempre opcionales, en salidas **y** retornos. Hasta **5 imágenes por
   línea**, solo imágenes, 5 MB c/u ya en WebP, **25 MB en total por vale**.
   Campos multipart `photos_<n>` (n = índice de la línea en `lines`, base 0).
   En un retorno, `photos_0` es la primera línea del retorno. Casos de uso:
   foto del repuesto dañado al entregarlo al técnico y foto de cómo regresó la
   pieza. Se suben a S3 **antes** de la transacción (prefijo
   `stock-vouchers/{companyId}/{voucherId}/`); las filas se insertan dentro
   (`lineIndex` → id de la línea creada, `lineNo = índice + 1`); si el vale ya
   existía (`replayed`) o la transacción falla, se borran. No se pueden
   agregar después de creado el vale (inmutable). `summary` y `getDetail`
   devuelven las fotos en
   **`lines[].attachments[{ id, originalName, mimeType, sizeBytes, url }]`**
   (URL firmada, 30 min). **Ya no existe `attachments` en la raíz del vale**
   (cambio de contrato).

7. **Costo por orden** = `Σ(salidas) − Σ(retornos)` sobre las líneas de los
   vales de esa orden, con el costo congelado en cada línea.
   `netBillableAmount` solo suma líneas con `billable_in_repair_orders`, al
   precio congelado, sin impuesto.

8. **No existe "saldo por empleado" / custodia.** Lo que sale con una orden se
   **consume**, no queda en custodia, así que "pendiente por devolver" no tiene
   significado de negocio. El listado con filtro `employeeId` cubre la
   consulta.

9. **Todo con idempotencia (`clientRequestId`) y auditoría** (`CREATED`) en la
   misma transacción. El stock se mueve únicamente a través de `StockService`.
   Límites: 100 líneas por vale, nota ≤ 500.
## 6. Gateway (repo aparte)  [ENTREGADO, SIN PROBAR]

Ubicación: `gateway/src/inventory-core/stock-vouchers/`
(`stock-vouchers.controller.ts`, `stock-vouchers.service.ts`,
`dto/create-stock-voucher-gateway.dto.ts`, `dto/list-stock-vouchers-query.dto.ts`,
`helpers/stock-voucher-attachments.helper.ts`). Controller con
`@Controller('stock-vouchers') @Auth()` y `ctx(user)` =
`{ userId: user.sub, companyId: user.companyId, branchId: user.branchId }`.
Hay que registrarlos en el módulo del gateway que agrupa `inventory-core`
**(verificar)**.

Contrato completo para el front: documento "Contrato de API — Movimientos
manuales de stock (vales)" (**actualizar: multipart por línea,
`lines[].attachments`, selector de lotes, listado enriquecido, `canReturn`**;
ver pendiente 20).

### 6.1 Endpoints

| Método y ruta | Comando MS | Payload al MS | Descripción |
|---|---|---|---|
| `GET new-data` | `get_stock_voucher_new_data` | `{ user }` | Motivos activos con sus reglas (`direction`, `orderLink`, `isReturnable`). |
| `GET products/:productId/lots` | `search_stock_voucher_lots` | `{ productId, user }` | Lotes con existencias del producto **en la sucursal del usuario** (`user.branchId`, obligatorio), más antiguos primero, solo `available > 0`, filtrados por `LOT_PICKER_FILTERS` (ver 6.2). Cada lote trae `units[{ id, serials[] }]` (unidades `AVAILABLE` con todos sus IMEI; vacío en productos por cantidad). |
| `GET lots/:lotId/units` | `list_stock_voucher_lot_units` | `{ lotId, user }` | Unidades `AVAILABLE` del lote con todos sus IMEI (sucursal **principal**). Ya no lo necesita el modal de salida (los lotes traen `units`). |
| `GET orders/:orderId` | `get_order_stock_summary` | `{ orderId, user }` | Vales de la orden + `products[]` (`netQuantity`, `netCost`, `netBillableAmount`) + `totals`. `orderId` entero (`ParseIntPipe`). |
| `POST /` | `create_stock_voucher` | `{ dto, files, user }` | **multipart**: campo `data` (JSON del vale) + campos `photos_<n>` (0–5 imágenes por línea, n = índice de línea base 0). Crea una salida **o** un retorno según el motivo. Idempotente. Devuelve resumen con `lines[].attachments` y `replayed`. |
| `GET /` | `list_stock_vouchers` | `{ query, user }` | Listado enriquecido (ver 6.3). Filtros `direction, reasonId, employeeId, orderId, from, to, search`, `page/limit/sortBy(createdAt\|code)/sortDir`, `includeFilters`. |
| `GET :id` | `get_stock_voucher_detail` | `{ id, user }` | Cabecera, motivo, empleado y creador **con nombre**, orden (con estado/cliente de la réplica), vale origen, retornos, `canReturn`/`returnBlock`, líneas (SKU, lote, snapshot, unidades con IMEI, `attachments` con URL firmada), `returned`/`pending` por línea en salidas. |

Rutas literales (`new-data`, `products/...`, `lots/...`, `orders/...`) van
**antes** de `:id`.

### 6.2 `LOT_PICKER_FILTERS` y payload de creación

**`LOT_PICKER_FILTERS`** (constante en `stock-vouchers.service.ts`): hoy `{}`
(**PRUEBAS**: lista todos los lotes). **Antes de producción restaurar
`{ billableInRepairOrders: true }`** (pendiente 27); si no, se puede asignar a
una orden un lote no facturable en órdenes (su costo sale del stock pero
`netBillableAmount` lo ignora).

Payload `data` de `create_stock_voucher`:
`{ clientRequestId, reasonId, employeeId?, orderId?, originVoucherId?, note?, lines[{ lotId?, originLineId?, quantity, unitIds? }] }`.
- Salida: `employeeId` obligatorio; `orderId` si el motivo lo exige; cada línea
  con `lotId`; `unitIds` solo en serializados.
- Retorno: `originVoucherId` obligatorio; cada línea con `originLineId`; **no**
  enviar lote, empleado ni orden.
- Fotos: campos `photos_<n>` (cualquier otro nombre → 400; índice ≥ número de
  líneas → 400), solo `image/*`.

**Helper del gateway** `helpers/stock-voucher-attachments.helper.ts` →
`prepareStockVoucherFiles(files, lineCount)` **[ENTREGADO, SIN PROBAR]**:
campos `photos_<n>` (n = línea base 0), solo imágenes, máx. 5 por línea, 5 MB
c/u (tras WebP), **25 MB en total**. Cada foto serializada lleva `lineIndex`.
Otro nombre de campo o un índice ≥ número de líneas → 400. Asume que
`serializeFilesForMicroservice` devuelve un elemento por archivo y en el mismo
orden.

### 6.3 Listado `GET /stock-vouchers`

**Query** (todos opcionales): `page` (≥ 1, def. 1), `limit` (1–100, def. 20),
`sortBy` (`createdAt`\|`code`), `sortDir` (`ASC`\|`DESC`, también minúsculas),
`direction` (`OUT`\|`IN`), `reasonId` (uuid), `employeeId` (uuid), `orderId`
(entero = **id interno** de la orden, no el número visible), `from`/`to`
(`AAAA-MM-DD`, inclusivo, hora de Guayaquil), `search` (máx. 100: solo dígitos
hasta 9 → código de vale **o** número de orden; otro texto → nombre del
empleado **o nombre del cliente de la orden**, `ILIKE`, sensible a tildes),
`includeFilters=true` (agrega `filters.reasons` solo en la primera carga).

**Item** (los campos antiguos se conservan; los nuevos se listan debajo del
ejemplo):
```json
{
  "id": "uuid", "code": 57, "direction": "OUT",
  "reason": { "id": "uuid", "code": "REPARACION_DANO", "name": "REPARACION DAÑO", "isReturnable": true },
  "employee": { "id": "uuid", "name": "Juan Pérez" },
  "createdBy": { "id": "uuid", "name": "María Gómez" },
  "orderId": 4521, "orderNumber": 123,
  "orderStatus": { "id": 6, "name": "EN REPARACION" },
  "customerName": "Pedro Sánchez",
  "originVoucherId": null, "originVoucher": null,
  "lineCount": 2, "totalQuantity": 3, "returnedQuantity": 1, "pendingQuantity": 2,
  "returnStatus": "PARTIAL", "returnCount": 1, "photoCount": 2,
  "canReturn": true, "returnBlock": null,
  "createdAt": "2026-11-05T15:20:00.000Z"
}
```
- Nuevos: `reason.code`, `reason.isReturnable`, `createdBy`, `orderStatus`,
  `customerName`, `originVoucher { id, code }`, `totalQuantity` (suma de
  unidades, no de líneas), `returnedQuantity`, `pendingQuantity`,
  `returnStatus` (`NONE`\|`PARTIAL`\|`FULL`), `returnCount`, `photoCount`,
  `canReturn`, `returnBlock`.
- En retornos (`IN`): `returnedQuantity`, `pendingQuantity` y `returnStatus`
  son `null`; `canReturn` es `false` con `returnBlock: 'IS_RETURN'`;
  `originVoucher` trae la salida.
- `orderStatus` y `customerName` son `null` si no hay orden o aún no se
  replicó. `employee.name` y `createdBy.name` pueden ser `null` si el usuario
  no está en la réplica.
- `returnBlock` ∈ `IS_RETURN`, `NOT_RETURNABLE`, `FULLY_RETURNED`,
  `ORDER_DELIVERED`, `ORDER_UNKNOWN`. El front solo necesita `canReturn`;
  `returnBlock` sirve para el tooltip.
- El listado une `orders_replica` con
  `LEFT JOIN ... AND o.company_id = v.company_id::text` (ver raíz sección 4) y
  calcula seis subconsultas correlacionadas por fila (con `limit` ≤ 100 es
  aceptable).

### 6.4 Detalle `GET /stock-vouchers/:id`

Notas de contrato: `reason` puede ser `null`; `order` es `null` sin orden (y
`statusId/statusName/customerName` pueden ser `null` si no se replicó);
`originVoucher { id, code }` solo en retornos; `returns[{ id, code, createdAt }]`
solo en salidas; `canReturn`/`returnBlock` en la raíz; en cada línea
`units[{ unitId, serials[], returned }]` (en retornos `returned` siempre es
`false`), `attachments[]` con `url` firmada (30 min; no cachear; si no empieza
por `http`, la firma falló), y `returned`/`pending` solo en salidas.
Errores: `400` si `:id` no es UUID (mensaje de `ParseUUIDPipe` en inglés,
pendiente 35 de la raíz), `404` "El vale no existe" (también si es de otra
empresa).

### 6.5 Flujo de retorno desde el front

1. Desde el detalle o el listado de una **salida**, mostrar "Registrar
   retorno" si `canReturn`.
2. El motivo sale de `new-data` filtrando `direction === 'IN'` y, según la
   salida, `orderLink === 'REQUIRED'` si tiene orden o `'FORBIDDEN'` si no.
3. Ofrecer solo líneas con `pending > 0` y, en serializados, las `units` con
   `returned === false`.
4. `POST /stock-vouchers` multipart con
   `data = { clientRequestId, reasonId, originVoucherId, note?, lines[{ originLineId, quantity, unitIds? }] }`
   y `photos_<n>` indexadas por línea **del retorno** (reindexar si se quitan
   líneas).
5. En la respuesta, `replayed: true` significa que ya existía (las fotos del
   reintento se descartan).

**Errores del retorno**, todos 400 en español con número de línea: falta
`originVoucherId`; la salida no existe; motivo no retornable; motivo
incompatible con la orden; orden/empleado distintos; orden ENTREGADA; no se
pudo verificar la orden; falta `originLineId`; se envió lote; líneas de origen
repetidas; la línea no es del vale; unidades que no cuadran con la cantidad;
unidad no pendiente; producto por cantidad con unidades; "solo quedan X por
retornar de Y". `409` si el `clientRequestId` se reutilizó con datos distintos
o colisiona el correlativo.

### 6.6 Selects auxiliares del modal de vales

Contrato de `GET /employees/basic` → ver `users-employees-events/AGENTS.md`.
Contrato de `GET /inventory-orders/search` → ver `orders-relay/AGENTS.md`.
Los retornos no usan el buscador de órdenes (heredan la orden del vale
original).

## 7. Comandos del MS

`stock-vouchers.controller.ts` (`@Controller()` con `run` + `ctx` + `uuid`):
`get_stock_voucher_new_data`, `create_stock_voucher` (pasa `data.files ?? {}`),
`list_stock_vouchers`, `get_stock_voucher_detail`, `get_order_stock_summary`,
`search_stock_voucher_lots` (exige `user.branchId` uuid; si falta, 400),
`list_stock_voucher_lot_units`. Deben coincidir con el gateway.

**Ojo:** el archivo original usaba
`stock_vouchers.create|list|detail|order_summary|lots|lot_units` (no
coincidían con el gateway); el parche de renombre está **entregado, sin
aplicar/verificar**.

## 8. Estado  [ENTREGADO, SIN PROBAR]

| Componente | Estado |
|---|---|
| `stock-vouchers` (MS) | **ENTREGADO, SIN PROBAR.** Solo se verificó sintaxis (transpilación TS). No se ha corrido el type-check completo del repo ni ninguna prueba contra Postgres. |
| Selector de lotes (`search_stock_voucher_lots`: sucursal del usuario, `units` con IMEI, filtros) | **ENTREGADO, aplicado en el service, SIN PROBAR.** `LOT_PICKER_FILTERS = {}` (pruebas). Inconsistente con `createOut` (pendiente 26). |
| Fotos **por línea** (entidad con `line_id`, helper `photos_<n>`, `create`/`uploadPhotos`/`mapAttachments`/`summary`/`getDetail`, controller gateway) | **ENTREGADO, SIN PROBAR.** Checklist: `TRUNCATE stock_voucher_attachments;`, registrar la entidad en `forFeature`, importar `AwsS3Module`, buscar usos de `MAX_VOUCHER_PHOTOS`, confirmar que `serializeFilesForMicroservice` devuelve un elemento por archivo y en el mismo orden. |
| Listado enriquecido (`list` con `returnState`, join a `orders_replica`, subconsultas de cantidades) | **ENTREGADO; el primer arranque falló por el cast `varchar = uuid` y se corrigió con `::text` (corrección entregada, sin reconfirmar).** Falta probar el listado completo. |
| `canReturn`/`returnBlock` en `getDetail` (cambio con `returnState`, dos inserciones) | **ENTREGADO, SIN PROBAR.** **(verificar)** que se aplicó: antes de esto el detalle no devolvía `canReturn`. |
| Flujo de retorno (`createIn`/`registerReturn`; contrato para el front) | Lógica **ENTREGADA, SIN PROBAR**; contrato documentado en 6.5. **(verificar)** que `CreateStockVoucherGatewayDto` acepta `originVoucherId` y `lines[].originLineId` (pendiente 31). |
| Renombre de comandos del controller del MS | **ENTREGADO, sin aplicar.** |
| `parse-json-field.helper.ts` en el controller de vales | Ya lo usa (la migración de ingresos está en `receipts/` y raíz 25). |
| Enums `UnitStatus.ISSUED`, `MovementType.INTERNAL_OUT` | **Pendiente de aplicar** (en pruebas basta con `synchronize`). |
| Seed de motivos | **ENTREGADO como parche** en `CatalogsService`; falta enganchar `seedStockMovementReasons(companyId)` al flujo de empresa nueva (ver `catalogs/AGENTS.md`). |
| `StockService` (`registerOutbound`, `registerReturn`, `listAvailableUnits`) | Ver `stock/AGENTS.md`. |
| Gateway `stock-vouchers` | **ENTREGADO, SIN PROBAR.** Falta registrarlo en el módulo del gateway (y RouterModule si aplica). |

### Primera prueba recomendada
Una **salida serializada** completa (con orden, fotos en `photos_0` y
`photos_1`) seguida de un **retorno parcial** (con foto) y luego del resto; ahí
se cruzan bloqueos, unidades `ISSUED`, pendiente por línea, snapshot y
adjuntos. Verificar en el listado que `canReturn` pase de `true` a `false` con
`returnBlock: 'FULLY_RETURNED'` al devolver todo.

Antes, probar los selectores: buscar `#123` y por texto, listar lotes con un
usuario de la sucursal principal y con uno de otra (este debería ver la lista
vacía).

Después: salida sin orden (USO LAB), orden en estado 8/9/10 (el listado debe
mostrar `ORDER_DELIVERED` en 8), listado con `orders_replica` vacía
(`ORDER_UNKNOWN`), doble envío con el mismo `clientRequestId` (verificar que
las fotos del reintento se borren de S3), una foto que no es imagen, 6 fotos
en una línea, fotos con índice de línea inexistente, y dos salidas
concurrentes del mismo lote.

## 9. Pendientes (numeración conservada)

7. **Aplicar y probar** todo lo marcado SIN PROBAR (sección 8).
8. **Buscador de productos con existencias** para vales (hoy el front
   reutiliza `GET receipts/products/search` y luego pide lotes; un producto
   sin stock devuelve lista vacía). Requiere ver `ProductsService`.
9. **Nombre del producto** en el detalle/resumen/listado de vales (hoy solo
   `sku`); requiere la entidad `ProductName`. Con ella el listado podría
   mostrar el primer producto y "+N más".
10. **Búsqueda por palabras** en el listado con `search-sql.ts` (hoy: número =
    código/orden; texto = nombre del empleado o del cliente de la orden con
    `ILIKE`, sensible a tildes).
11. **Carrera orden→ENTREGADA:** si la orden pasa a 8 justo cuando alguien saca
    un repuesto (o lo devuelve) y Kafka aún no replicó el cambio, el vale
    pasa; y `canReturn` puede ir desfasado. Un bloqueo definitivo exigiría una
    consulta síncrona al MS de órdenes. (Enlaza con `orders-relay/`.)
12. **Regularizar lote** (editar banderas de un lote confirmado, con
    auditoría): mencionado en la entidad `Lot`, no construido. (Enlaza con
    `stock/`.)
13. Decidir si `REMANOFACTURAR` debe **producir** una pieza nueva (hoy solo
    saca stock) y si RECICLAJE/REMANOFACTURAR deben admitir retorno.
14. Decidir si el consumo de repuestos de una reparación desde el **MS de
    órdenes** debe pasar por `StockService`/vales (hoy no existe ese camino;
    si aparece, debe usar `StockService` y quedar ligado a la orden).
18. Aprobación de salidas (`requires_approval`) no existe; las salidas
    descuentan stock de inmediato, sin custodia ni estado intermedio.
19. **Fotos de vales:** endpoint aparte para agregar fotos a un vale ya creado
    (hoy no se puede); barrer huérfanos de `stock-vouchers/…` junto con los de
    `receipts/…` (raíz 23). (Ya resuelto: las fotos van por línea.)
20. Actualizar el documento "Contrato de API — Movimientos manuales de stock"
    con multipart por línea (`photos_<n>`), `lines[].attachments`, el selector
    de lotes con `units`, el listado enriquecido y `canReturn`/`returnBlock`.
26. **Sucursal de las salidas:** el selector de lotes usa `user.branchId` pero
    `createOut` sigue usando `MainBranchService`. Opción recomendada:
    `createOut` recibe `branchId` desde `data.user.branchId`, lo pasa a
    `registerOutbound` y valida que el saldo exista en esa sucursal; los
    retornos no cambian (usan la del vale original). Hoy los saldos existen
    solo en la sucursal principal (los ingresos también usan
    `MainBranchService`), así que un usuario de otra sucursal verá la lista
    vacía hasta que haya transferencias o ingresos hacia su sucursal.
27. **Restaurar `LOT_PICKER_FILTERS = { billableInRepairOrders: true }`**
    antes de producción.
31. **Verificar el DTO de creación** (`create-stock-voucher-gateway.dto.ts`, no
    revisado): debe declarar `originVoucherId` y `lines[].originLineId`; con
    `forbidNonWhitelisted` los rechazaría con 400 antes de llegar al MS y los
    retornos no funcionarían.
32. **Validar fechas y rango en `list`:** `from=2026-02-31` o `2026-13-01`
    pasan el `Matches` del DTO y el `DATE_RE` del MS pero Postgres falla al
    convertir a `date` y responde **500** en vez de 400; y `from > to`
    devuelve lista vacía sin avisar. Corregir con validación de fecha real y
    de rango (400 en español).
33. **Condición de la pieza devuelta** (opción B del retorno): hoy siempre
    vuelve `AVAILABLE`. Si en la práctica llegan piezas dañadas, agregar
    condición `GOOD`/`DAMAGED` al retorno y un estado de unidad o lote aparte
    para lo dañado (tocaría `registerReturn` y `UnitStatus`).
34. **Filtro "pendientes de retorno" en el listado** (p. ej.
    `returnStatus=PENDING`): requiere parámetro nuevo en el DTO y condición en
    el `where`. Además **verificar índices** en
    `stock_voucher_lines(origin_line_id)` y `stock_vouchers(origin_voucher_id)`,
    que usan las subconsultas del listado (el de
    `stock_voucher_attachments(voucher_id)` ya existe).

Pendientes de la raíz que afectan a este módulo: 22 (permisos de
salidas/retornos), 24 (migraciones), 35 (mensajes de `ParseUUIDPipe`).

## 10. Errores y lecciones propios del módulo

- `data.files` no se pasaba al servicio en el controller del MS → adjuntos no
  se guardaban. El handler debe llamar al service con `data.files ?? {}`.
- **Nombres de comando desalineados** (`create_stock_voucher` vs
  `stock_vouchers.create`): el mensaje nunca llegaba al handler.
- **Error real (listado):** `QueryFailedError: el operador no existe: character varying = uuid`
  al unir `orders_replica` con `stock_vouchers` (`o.company_id = v.company_id`).
  Falla solo al comparar **columna con columna**. Solución: `v.company_id::text`.
  Aparece primero en `getCount`, porque es la primera consulta que usa el join.
- Cambiar la firma de `searchLots(companyId, productId)` →
  `(companyId, productId, branchId)` obligó a buscar todos sus llamadores.
- Al renombrar `MAX_VOUCHER_PHOTOS` → `MAX_PHOTOS_PER_LINE` (gateway), buscar
  quién más la importaba.
- `LOT_PICKER_FILTERS = {}` es solo de pruebas; se olvida fácil al pasar a
  producción (pendiente 27).
- Validar stock en el servicio antes de que salten los `CHECK` de saldo
  (mensaje en español con número de línea y lote).

## 11. Cómo actualizar este archivo
Al cambiar reglas, contrato o comandos de vales: actualizar las secciones 5–7
de este archivo. Si el cambio toca `StockService`, también `stock/AGENTS.md`;
si toca la réplica de órdenes, `orders-relay/AGENTS.md`. Las reglas completas
están en la sección 0 de la raíz. 