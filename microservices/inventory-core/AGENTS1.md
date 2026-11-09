# AGENTS.md — ms inventory-core (inventario, ingresos, movimientos de stock)

Documento de referencia para agentes y desarrolladores. Resume lo construido, las reglas de negocio, las convenciones del proyecto y lo pendiente. Idioma del producto: español (mensajes de error y etiquetas en español).

> **Cómo leer este documento**
> - Los snippets de este historial se entregaron por partes (chat). Antes de asumir que algo existe, **verifica en el código real**. Los comentarios `/* igual */` o `// ...` que aparecieron en respuestas eran abreviaciones, **nunca** código válido (ya causaron un bug: validación de UUID vacía en `list`).
> - Lo marcado **(verificar)** es una deducción hecha sin ver el archivo real.
> - Lo marcado **[ENTREGADO, SIN PROBAR]** se escribió y pasó revisión de sintaxis, pero **no se ha ejecutado contra una base de datos ni compilado con el type-check completo del repo**. Ver la sección 11.
> - **Entorno:** el proyecto está en **pruebas, no en producción**. `synchronize` crea/ajusta tablas fuera de producción, así que por ahora **no se escriben migraciones**. Las notas sobre `ALTER TYPE`/migraciones se conservan para el primer despliegue real (ver 12, "Transversal").

---

## 1. Arquitectura

```
Front ──HTTP──> gateway (Nest + Fastify) ──RabbitMQ──> ms inventory-core (Nest microservice, TypeORM + Postgres)
                                                          ▲            ▲
                                       Kafka (tiempo real)┘            └ RabbitMQ (bulk / reconciliación)
                                       réplicas: órdenes, usuarios, empresas, dispositivos
```

- **Gateway:** `gateway/src/inventory-core/<módulo>/` con `*.controller.ts`, `*.service.ts`, `dto/`, `helpers/`. Usa `@Auth()` y `@User()` (`../../common/auth/decorators/`). Valida con class-validator (DTOs). Envía con `this.inventoryClient.send('<cmd>', payload)` donde `inventoryClient` es `InventoryCoreServiceClient` (`../../common/microservices/inventory-core-service-client`). El gateway manda el comando como **string**; el MS lo recibe como `@MessagePattern({ cmd: '<cmd>' })`.
- **Microservicio:** `microservices/inventory-core/src/<módulo>/`. Handlers con `@MessagePattern({ cmd: '<cmd>' })`.
- **Nombres de comandos:** verbo en `snake_case` (`get_receipt_detail`, `create_receipt`, `list_receipts`, `create_stock_voucher`, `search_orders`, `get_employees_basic`). **No** usar el estilo `modulo.accion` (`stock_vouchers.create`): ya causó un desajuste (ver 10). Mantener el estilo.
- **Contexto de usuario** (`ctx(user)` en el gateway): `{ userId: user.sub, companyId: user.companyId, branchId: user.branchId }`. El payload al MS es `{ dto|query, user, files?, file?, ...ids }`. El MS valida `data.user.companyId` / `data.user.userId`. El MS **ignora** `user.branchId`, con **una excepción en transición**: `search_stock_voucher_lots` (selector de lotes) filtra por `user.branchId`. Todo lo demás (ingresos, salidas) sale de `MainBranchService`. Ver pendiente 26.
- **Errores:** en el MS siempre `RpcException(new XxxException(msg))`. Los controllers del MS envuelven con `try/catch` (o helper `run(name, fn)`): `RpcException` se relanza, `HttpException` se envuelve, lo demás es 500 genérico con log.
- **El MS revalida todo** (llega por RPC; no se confía en el gateway ni en el front). Incluye tipo, tamaño y cantidad de archivos.
- **Multi-empresa:** toda consulta filtra por `companyId`.
- **Sin FK hacia réplicas "vivas":** órdenes y usuarios son réplicas que pueden vaciarse o reconciliarse; las tablas de negocio guardan el id **sin FK** (y, si hace falta, un snapshot como `order_number`). Las FK sí existen hacia entidades propias (lotes, productos, vales) y hacia `CompanyReplica`.
- **Sucursal:** los ingresos y las salidas de vales usan la sucursal principal, resuelta por `MainBranchService.getMainBranchId(companyId, em?)` (solución temporal: sucursal activa cuyo nombre empieza con "Matriz"). Un retorno usa la sucursal del vale original. **Inconsistencia conocida:** el selector de lotes lista stock de la sucursal del usuario, pero `createOut` descuenta de la principal (pendiente 26).
- **Zona horaria de negocio:** `America/Guayaquil` (fechas por defecto, validación de "no futura" y filtros `from/to` del listado de vales).

### 1.1 S3 (`aws-s3/`)
`AwsS3Service` (módulo `AwsS3Module`, **verificar path/nombre al importarlo**; copiar el import de `ReceiptsModule`). Config por `ConfigService`: `AWS_REGION`, `AWS_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
- `uploadBuffer(buffer, originalName, mimeType, pathPrefix = '')` → devuelve la **key** `"{prefix}{uuid}-{originalName}"`. Lanza `InternalServerErrorException` si falla. Objeto privado (sin ACL pública).
- `getPresignedUrl(keyOrUrl, expiresIn = 1800)` → URL firmada **localmente** (30 min). Si falla **devuelve la entrada original** (no lanza): ojo, en ese caso el front recibiría la key cruda (el front debe comprobar que `url` empiece por `http`).
- `deleteObject(key)` → **no lanza** (loguea). Por eso se usa libremente en limpiezas.
- En BD solo se guarda la key. **Prefijos en uso:** `receipts/{companyId}/{receiptId}/` (documento, fotos y XML), `receipts/{companyId}/{receiptId}/payments/` (comprobantes), `stock-vouchers/{companyId}/{voucherId}/` (fotos de líneas de vales).

### 1.2 Archivos en el gateway (helpers en `gateway/src/common/helpers/`)
- `multipart-request.helper.ts`: `parseMultipartRequest(request)` → `{ files: ParsedFile[], formData }` (guarda `fieldname`; ignora archivos de 0 bytes). `processAndValidateFiles`, `serializeFilesForMicroservice` (buffer → base64) y `parseAndProcessMultipart` existen pero los controllers de ingresos/vales usan `parseMultipartRequest` + su helper propio. `DEFAULT_MAX_FILE_SIZE = 80 MB`.
  - **Deuda:** `ParsedFile` está declarada dos veces (se fusionan, sobra una) y hay muchos `console.log('[DEBUG] …')` que imprimen `formData` completo; quitarlos antes de producción.
- `process-file.helper.ts` (`processFileForUpload`): si es imagen → `sharp` `.rotate()` + resize máx. 1920 px sin ampliar + **WebP calidad 80**; el nombre cambia a `.webp`. No imagen → pasa igual. Si falla → 400.
- `process-pdf.helper.ts` (`processPdfForUpload`): Ghostscript opcional (requiere `gs` en la imagen del gateway).
- `parse-json-field.helper.ts`: `parseJsonField(DtoClass, raw)` parsea y valida el campo `data` de un multipart (`whitelist` + `forbidNonWhitelisted`, máx. 10 errores aplanados con `flattenValidationErrors`). Es el estándar para todo multipart nuevo (el controller de vales ya lo usa). Ingresos aún trae copias locales (`flatten`, `buildReceiptDto`, `buildDto`) que deben migrarse a este helper. **Ojo:** con `forbidNonWhitelisted`, todo campo que el DTO no declare responde 400 (ver pendiente 31).
- Helpers por módulo que separan y validan archivos por `fieldname`:
  - `receipts/helpers/receipt-attachments.helper.ts` → `prepareReceiptFiles(files, lineCount, paymentCount)` / tipo `ReceiptFilesPayload`. Campos: `document` (PDF o imagen, 1), `photos_<n>` (n = línea base 0, máx. 5 por línea, solo imágenes), `proof_<n>` (n = pago base 0, 1 por pago). Límites ya procesado: documento 10 MB, foto 5 MB, comprobante 5 MB, **25 MB en total** (viaja en base64 por RabbitMQ).
  - `receipts/helpers/receipt-payment-proof.helper.ts` → `preparePaymentProof(files)` (campo `proof`).
  - `stock-vouchers/helpers/stock-voucher-attachments.helper.ts` → `prepareStockVoucherFiles(files, lineCount)` **[ENTREGADO, SIN PROBAR]**: campos `photos_<n>` (n = línea base 0), solo imágenes, máx. 5 por línea, 5 MB c/u (tras WebP), **25 MB en total**. Cada foto serializada lleva `lineIndex`. Otro nombre de campo o un índice ≥ número de líneas → 400. Asume que `serializeFilesForMicroservice` devuelve un elemento por archivo y en el mismo orden.

## 1.3 Mapa del MS (`microservices/inventory-core/src/`)

```
app.module.ts                  raíz (ver 2.1)
audit-log/                     AuditLogService, entity, enum AuditAction
aws-s3/                        AwsS3Service (ver 1.1)
catalogs/                      CatalogsService: seeds (países, tipos de documento, motivos de movimiento)
common/
  enums/product-kind.enum.ts
  helpers/                     normalize-name.ts, search-sql.ts
  sequences/                   SequencesService (correlativos por empresa)
companies/                     CompanyReplica, BranchReplica, MainBranchService, listener Kafka
devices-replica/               marcas, modelos, códigos técnicos (réplica)
health/
interceptors/                  internal-auth.interceptor.ts
kafka/                         KafkaConsumerService, producer, orquestador de listeners
orders-relay/                  réplica REDUCIDA de órdenes + buscador (ver 4.1)
product-catalogs/              tipos, nombres, colores, calidades, usos (con seeds json)
products/                      productos (SKU), modelos compatibles, imágenes, usos
receipts/                      ingresos (cabecera, líneas, adjuntos, pagos, códigos de proveedor)
sri/                           consulta SRI por clave de acceso
stock/                         StockService + lotes, saldos, unidades, seriales, kardex
stock-vouchers/                movimientos manuales de stock (salidas y retornos, con fotos por línea)   [ENTREGADO, SIN PROBAR]
suppliers/
users-employees-events/        user_employee_cache + group_cache (réplica de usuarios) + selects de empleados
```

## 2. Infraestructura y arranque

### 2.1 `app.module.ts`
- `ConfigModule.forRoot({ isGlobal: true })`.
- `TypeOrmModule.forRootAsync`: Postgres con `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`, `autoLoadEntities: true` y **`synchronize: NODE_ENV !== 'production'`**. En producción **no hay synchronize**: hará falta migración/SQL manual cuando exista producción.
- Hay que importar `StockVouchersModule`. **(verificar)** En el `app.module.ts` compartido, `StockModule` aparece importado **dos veces** (duplicado → error de TypeScript); dejar solo uno.
- `autoLoadEntities` solo carga entidades que estén en algún `TypeOrmModule.forFeature(...)`.

### 2.2 Brokers
- **Kafka = tiempo real** (réplicas por evento). `KafkaConsumerService.registerHandler(topic, (eventType, data) => ...)`. Cada módulo con réplica expone un `*EventsListener.registerHandlers()` que debe llamarse desde `kafka/kafka-listeners.orchestrator.ts` **(verificar que `OrdersEventsListener` esté registrado ahí)**.
- **RabbitMQ = bulk, reconciliación inicial y manual.** Un `ClientProxy` por origen: `ORDERS_ASYNC` (queue `orders_queue_sync`), `USER_ASYNC` (queue `users_queue_sync`). Los comandos de sync llevan `internalToken: process.env.INTERNAL_SECRET`.
- **Sync inicial:** los controllers de réplica hacen el sync en `onModuleInit` (catálogos primero, luego datos).

### 2.3 Seeds al arrancar (`CatalogsService`)
- Implementa `OnApplicationBootstrap`: siembra países (global) y, para **todas** las empresas replicadas, tipos de documento (`ReceiptDocumentType`) y, desde los vales, motivos de movimiento (`StockMovementReason`).
- Patrón: transacción + `pg_advisory_xact_lock` (claves `730_100_2` tipos de documento, `730_100_3` motivos) + `insertMissing(...)` con `orIgnore()` en bloques de 500. **No pisa lo que un admin editó.**
- Para empresas nuevas hay un método individual por catálogo (`seedReceiptDocumentTypes(companyId)`, `seedStockMovementReasons(companyId)`) que debe llamarse **donde ya se llama la siembra de la empresa nueva** **(verificar dónde y que el de motivos esté enganchado)**.
- La entidad de motivos vive en `stock-vouchers/`, pero la siembra está en `CatalogsService` a propósito: evita dependencia circular entre módulos.

## 3. Convenciones de código

- **Dinero:** columnas `numeric`, en TypeORM viajan como **string**. Los cálculos se hacen en **enteros** (centavos; costo en 1/10 000) con helpers `toCents`, `fromCents`, `SCALE = 10_000` (`MONEY_SCALE` en vales). El front nunca calcula con ellos, solo muestra.
- **Totales los calcula el servidor**, el front solo los muestra como vista.
- **Reglas de negocio en el servidor, no en el front:** cuando el front necesita saber si una acción procede (p. ej. el botón de retorno), el servidor devuelve el booleano ya calculado (`canReturn` + `returnBlock`) con una **función única** compartida por listado y detalle (`returnState`). No se duplican reglas en el front.
- **Descuento** = monto TOTAL de la línea (no por unidad). **Costo del lote** = costo neto por unidad `(cantidad × costo − descuento) / cantidad`, 4 decimales, sin impuesto.
- **Idempotencia:** `clientRequestId` (UUID generado por el front al abrir el formulario) en ingresos, pagos sueltos y vales de stock. Mismo id + mismo contenido (hash SHA-256 del objeto normalizado sin el id) → `replayed: true`; mismo id + datos distintos → 409. Advisory lock por `(empresa, id)` y índice único como red final. Reglas front: generar una vez, reusar en reintentos, regenerar solo tras éxito, deshabilitar botón.
- **Hash de idempotencia:** el **orden de claves** del objeto que devuelve `normalizeInput` importa. Agregar campos nuevos **al final**. **Los archivos no entran al hash**: en un `replayed` los archivos del reintento se descartan (se borran de S3).
- **Correlativos:** `SequencesService.reserve(em, companyId, key, count)` (UPSERT atómico; claves `receipt_code`, `stock_voucher_code`). Se usa como `const code = await this.sequences.reserve(em, companyId, key)`. Los lotes y productos usan `MAX(code)+1` con `pg_advisory_xact_lock` (patrón existente en `StockService` y `ProductsService`).
- **Auditoría:** `AuditLogService.log(em, { companyId, entity, entityId, action, userId, before?, after?, changes? })` dentro de la transacción. `entity` se pasa como la **clase** (p. ej. `entity: Receipt`, `entity: StockVoucher`). `AuditAction`: `CREATED, UPDATED, SOFT_DELETED, RESTORED, DELETED` (no existe `VOIDED`; verificar/anular se registran como `UPDATED` con `status from/to`). Historial: `audit.history(companyId, Entity, id, page, limit)`.
- **Búsqueda por palabras:** `common/helpers/search-sql.ts` (`norm`, `stripAccents`, `escapeLike`, `toTokens`). Cada palabra debe coincidir (AND) en algún campo (OR), sin tildes ni mayúsculas, orden libre. Un entero puede coincidir con un `code` exacto. (El listado de vales aún **no** lo usa: ver 12.)
- **Buscadores para selects** (empleados, órdenes, lotes): arreglo plano, sin paginación, sin `{ items, meta }`. El de órdenes usa `ILIKE` directo (sensible a tildes), no `search-sql.ts` (pendiente 29).
- **Listados:** `page/limit/sortBy/sortDir`, respuesta `{ items, meta: { total, page, limit, totalPages } }`. Opcional `includeFilters=true` agrega `filters` (valor + etiqueta) solo en la primera carga. Con orden por expresión calculada se usa `offset/limit` (no `skip/take`).
- **Tipado de `Map`:** `new Map(arr.map(x => [k, v] as [string, T]))`. En `Promise.all` con ternarios tipar `Promise.resolve([] as T[])`.
- **Uniones entre réplica y tablas propias:** `orders_replica.company_id` es `varchar(64)` y `stock_vouchers.company_id` es `uuid`. Al unir **columna con columna** hay que castear: `o.company_id = v.company_id::text`. (Contra un parámetro no hace falta; por eso solo falla con joins.) Ver 10.
- **Transacciones y S3:** subir a S3 **antes** de la transacción (no retener locks), insertar los adjuntos **dentro**, y limpiar con `deleteObject` en el `catch` y en el `replay` (no dejar huérfanos). Si una subida falla, borrar las que sí subieron y lanzar 500.
- **Entidades con snake_case:** `OrderReplica` (`company_id`, `status_id`, `status_name`, `order_number`, `customer_name`, `device_*`, `order_type_*`) y `UserEmployeeCache` (`first_name`, `last_name`) usan propiedades en snake_case; el resto de entidades usa camelCase con `name:` de columna.
- **Registrar entidades:** toda entidad nueva debe estar en `forFeature` del módulo (error real: "no existe la relación company_sequences"). `synchronize` no aplica bien cambios de nulabilidad ni `CHECK` en tablas con datos, y **solo corre fuera de producción**.
- **Enums de Postgres (para producción):** agregar un valor a un enum de TypeORM requiere `ALTER TYPE ... ADD VALUE` (fuera de bloque transaccional; el valor nuevo no se puede usar en esa misma transacción). Verificar el nombre real del tipo con `\dT` (por defecto `<tabla>_<columna>_enum`).
- **Orden de rutas Nest:** declarar `@Get(':id')` después de rutas literales (`new-data`, `products/search`, `suppliers/search`, `lots/:lotId/units`, `orders/:orderId`).
- **Snapshots:** un documento que consume lotes (vale) copia costo, precio y banderas del lote en **su** línea. Lo costeado/cobrado no cambia si el lote se "regulariza" después.
- **Bloqueos de stock:** `SELECT ... FOR UPDATE` (`setLock('pessimistic_write')`) sobre saldos y unidades **ordenado por id** (`lot_id`, `u.id`) para que dos operaciones concurrentes no se crucen en deadlock. Validar disponibilidad en el servicio **antes** de que salten los `CHECK` de la BD (mensaje en español).
- **Controllers del MS de vales:** helper `run(name, fn)` + `ctx(data)` (valida `data.user.companyId/userId`) + `uuid(value, label)` para ids de ruta. El controller de ingresos usa `run` solo en parte de los handlers (el resto trae su propio try/catch; mismo efecto).
- **DTOs del gateway (estilo):** `@Type(() => Number)` para números; `@IsUUID('4', { message })`; mensajes en español; campos opcionales con `@IsOptional()`; condicionales con `@ValidateIf`. Bodies multipart: `parseJsonField(Dto, formData.data)`. Endpoints JSON: `@Body() dto` con el pipe global.
- **Gateway service:** una línea por método: `return this.inventoryClient.send('<cmd>', { ...ids, dto|query, files?, user })`. La firma del service debe coincidir con la llamada del controller (error real, ver 10).

## 4. Réplicas (datos que vienen de otros MS)

### 4.1 Órdenes — `orders-relay/` (réplica **reducida** en Postgres)  [ENTREGADO, SIN PROBAR]
Origen: ms **orders** (Mongo, réplica completa allí). Aquí solo se guarda lo necesario para validar, mostrar y buscar órdenes en los vales.

- **Tabla `orders_replica`** (entidad `OrderReplica`, **una sola tabla**): `id` (PK `int`, **el id del origen**, no autogenerado), `order_number`, `company_id` (**varchar 64**, NOT NULL; ojo: no es uuid), `status_id`, `status_name`, `customer_id`, `customer_name` (nombre + apellido), `source_created_at`, `source_updated_at` (fechas **del origen**, timestamptz). Índices por `order_number`, `company_id`, `(company_id, status_id)`, `status_id`, `customer_id`, `source_updated_at`.
  - **Tipo de orden** (nulables): `order_type_id`, `order_type_name`.
  - **Dispositivo** (nulables; una orden tiene **un** dispositivo): `device_id`, `device_brand` (`device.model.brand_name`), `device_model` (`device.model.models_name`), `device_type` (`device.type.name`), `device_serial`, `device_imeis` (todos los IMEI unidos por espacio, solo para búsqueda).
  - **No se replica** a propósito: `accounts` (trae contraseñas), `patron`, `password`, notas, pagos, hallazgos, técnicos, adjuntos.
- **Mapper** (`mappers/order-replica.mapper.ts`): único lugar que conoce el shape del evento (`data.id`, `order_number`, `company.id`, `currentStatus.{id,name}`, `customer.{id,firstName,lastName}`, `type.{id,name}`, `device`, `createdAt`, `updatedAt`). Exporta `toOrderReplica` y `toDeviceColumns` (esta última la reutiliza `applyUpdate('device_updated')`). Lanza `Error('Evento de orden incompleto')` si falta `id`, `company.id`, `currentStatus.id` o `customer.id` (columnas NOT NULL): en el bulk, `syncOrdersBulk` descarta solo esa orden y no tumba el lote. Los textos se recortan al largo de su columna. Campos nuevos del origen se ignoran.
- **Tiempo real (Kafka):** topics `ms.order.created` → `syncOrder` (upsert); `ms.order.updated` → `applyUpdate(orderId, scope, payload, updatedAt)`. **Solo** `status_changed`, `closed` (estado) y `device_updated` (dispositivo) actualizan; cualquier otro scope se ignora con log `debug` y **no** avanza `source_updated_at` (así el checkpoint nunca queda por encima de un cambio perdido).
- **Bulk (RabbitMQ):** comando `async_orders_start` con `{ internalToken, fromCache }` (cola `orders_queue_sync`, cliente `ORDERS_ASYNC`). `fromCache = MAX(source_updated_at)`; tabla vacía → `null` → el origen manda todo.
- **Upsert protegido por fecha:** `INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE existente IS NULL OR EXCLUDED IS NULL OR existente <= EXCLUDED`. Un evento atrasado no pisa uno más nuevo (Kafka y Rabbit escriben en paralelo). Requiere TypeORM ≥ 0.3.12 aprox. (`overwriteCondition`) **(verificar versión)**. **Toda columna nueva debe agregarse a `UPSERT_COLUMNS`**; si no, el `ON CONFLICT` no la actualiza y las órdenes ya replicadas quedan con ella vacía.
- **Bulk por lotes de 500** (17 columnas × 500 = 8 500 parámetros; límite PG 65 535), con **dedupe por id** antes de insertar (Postgres falla con "ON CONFLICT DO UPDATE command cannot affect row a second time").
- **Reconciliación forzada = vaciar la tabla y reiniciar el MS.** También es lo que hay que hacer tras agregar columnas nuevas: `synchronize` las crea vacías y el bulk las llena. Mientras la tabla se repuebla, las salidas con orden aparecen en el listado de vales con `canReturn: false` y `returnBlock: 'ORDER_UNKNOWN'`.
- Un `status_changed` o `device_updated` que llega antes de que exista la orden no hace nada (0 filas afectadas); la reconciliación lo repara.
- **Buscador** (`OrdersRelayService.search(companyId, search?)`, comando `search_orders`): ver 8.6. Límite fijo 20, orden `source_updated_at DESC NULLS LAST, id DESC`.
- **Qué se quitó respecto al MS orders:** normalizaciones (status/type), checksum por conteo, y `OrderValidationService` (el registro de validación al pasar a ENTREGADA **no** se replica aquí).
- **Uso desde otros módulos:** `StockVouchersService` lee `OrderReplica` para validar y mostrar (incluido el listado de vales, con `LEFT JOIN`). Es una **lectura de réplica**: puede ir unos instantes por detrás del origen (ver 12).

#### Estados de orden (datos reales de producción del ms orders)
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

Constantes en `stock-vouchers/enums/stock-voucher.enums.ts` (`ORDER_STATUSES_BLOCK_ISSUE = [8,9,10]`, `ORDER_STATUSES_BLOCK_RETURN = [8]`).

### 4.2 Usuarios — `users-employees-events/`
- Entidades `UserEmployeeCache` (`user_employee_cache`: `id` uuid, `username`, `first_name`, `last_name`, `dni`, `email`, `phone`, relación `company` → `CompanyReplica` con join column `company_id`, `groups`, `createdAt`, `updatedAt`) y `GroupCache` (`group_cache`). **Copiadas del MS orders** (mismo código y mismo origen). Cliente RMQ `USER_ASYNC` (cola `users_queue_sync`).
- Consulta por empresa: `where: { id, company: { id: companyId } }` (no hay columna `companyId` en la entidad). En consultas con `QueryBuilder` se une por `e.id = v.employee_id` y se filtra la empresa por el vale.
- Se usa para validar que el empleado existe en la empresa y para mostrar nombres (`first_name + ' ' + last_name`).
- Sin FK desde tablas de negocio (`created_by_id`, `employee_id`, etc. son uuid sueltos).
- **Selects de empleados** (comandos en `users-employees-events.controller.ts`):
  - `get_employees_basic` → `findAllEmployeesBasic(user)`: todos los empleados de la empresa como `{ id, username, name }`. **`name` usa solo el primer nombre y el primer apellido** (`firstToken`), así que dos empleados pueden verse iguales. Sin paginación.
  - `get_technicians` → `findTechniciansByOrderType(user, orderTypeId)`: empleados de los grupos de `ORDER_TYPE_GROUPS[orderTypeId]`, con `name` completo (`CONCAT`). Lanza `RpcException` si el tipo no tiene grupos.
  - Ambos filtran con `employee.company_id` en el QueryBuilder **(verificar)**: contradice la nota de que la entidad no tiene columna `companyId`; confirmar el nombre real de la propiedad.

### 4.3 Empresas y sucursales — `companies/`
`CompanyReplica`, `BranchReplica`, `MainBranchService`, listener Kafka. `CompaniesModule` exporta `MainBranchService`.

### 4.4 Dispositivos — `devices-replica/`
`brand`, `model`, `model_technical_code` (réplica) con sync de modelos y de códigos técnicos. Tablas usadas en consultas crudas: `brands (brands_id, brands_name)`, `models (models_id, models_name, models_brands_id)`, `model_technical_codes (mtc_models_id, mtc_code)`, `product_models (product_id, model_id)`.

## 5. Modelo de datos

### 5.1 Ingresos
| Entidad | Tabla | Notas clave |
|---|---|---|
| `Receipt` | `receipts` | Estados `REGISTERED / VERIFIED / VOIDED`; `source MANUAL / ACCESS_KEY`; `payment_status`, `paid_total` (CHECK `0 ≤ paid ≤ total`); `client_request_id`, `request_hash`; `access_key`, `authorization_number/date`, `xml_file_key`; trazabilidad `created/verified/voided_*`. Índices únicos: código (`uq_receipts_…`), `(empresa, proveedor, tipo, nº documento)` (`uq_receipts_supplier_document`), `(empresa, access_key)` (`uq_receipts_company_access_key`, excluye VOIDED) y `uq_receipts_company_client_request`. |
| `ReceiptLine` | `receipt_lines` | `affects_inventory`; `product_id`/`sale_price` nulos si no afecta inventario (CHECK `chk_receipt_lines_inventory`); lado compra (costo, descuento total, `purchase_tax_code/rate`); config del lote; `supplier_code/description/quantity` (lo que decía el documento); `supplier_product_code_id`; `lot_id`. Sin tabla de seriales. |
| `ReceiptAttachment` | `receipt_attachments` | `kind DOCUMENT / PHOTO`. `file_key` (S3), `original_name`, `mime_type`, `size_bytes`, `sort_order`, `created_by_id`, `company_id`. DOCUMENT: uno por ingreso (índice único parcial), sin línea. PHOTO: obligatoriamente ligada a una línea (`receipt_line_id`, CHECK `chk_receipt_attachments_line`). FK con `CASCADE`. |
| `ReceiptPayment` | `receipt_payments` | Pagos/cuotas: `amount > 0`, `paid_at`, `method`, `reference`, `note`, comprobante (`proof_key/name/mime/size`), `client_request_id` (`uq_receipt_payments_client_request`). **Nunca se borra, se anula** (`voided_at/by`, `void_reason`). |
| `SupplierProductCode` | `supplier_product_codes` | Código del proveedor → producto **o** `is_non_inventory`. Único `(empresa, proveedor, código)`. `unit_factor` = unidades nuestras por unidad del proveedor (se aprende solo). |
| `ReceiptDocumentType` | `receipt_document_types` | `forces_billable_lot`: fuerza `billableInSales = true` en todas las líneas. Seed: 01 FACTURA (fuerza), 03, 04, 05, 06, 07, S/N RECIBOS, S/NR DEVOLUCION DE PRODUCTOS. |
| `StockUnitSerial` | `stock_unit_serials` | Todos los IMEI/seriales de una unidad (posición 0 = principal, copiado a `stock_units.serial`). Único `(empresa, producto, valor)`. |

Eliminados: `ReceiptLineSerial`, `ReceiptPaymentEvent` (reemplazado por pagos reales).

### 5.2 Productos (`products`)
- Ficha de catálogo (SKU). **No guarda existencias, costos ni condiciones fiscales reales**: eso vive en lote, saldos y unidades.
- `code` (correlativo por empresa, inmutable), `sku` (`{KIND}-{TIPO}-{MARCA}-{code}`, inmutable), `upc`, `product_name_id` (relación `productName`), `kind` (`ProductKind`, debe coincidir con el tipo), `tracking_mode` (`QUANTITY` | `SERIAL`), `product_type_id`, `color_id`, `quality_id`, `min_stock`, usos (`usages`, mínimo uno), modelos compatibles, imágenes.
- CHECK: un `DEVICE` siempre es `SERIAL`.
- Valores por defecto (`warranty_days`, `base_price`, `has_tax`, `price_includes_tax`, `billable_in_sales`, `billable_in_repair_orders`) **solo precargan el ingreso**; el lote guarda su copia.
- Validaciones en servicio: al menos un uso; `kind` = `productType.kind`; un DEVICE tiene exactamente un modelo compatible; `billableInRepairOrders` exige `billableInSales`.

### 5.3 Stock (`stock/`)
| Entidad | Tabla | Notas clave |
|---|---|---|
| `Lot` | `lots` | Snapshot de las condiciones con que entró una cantidad: `code` (correlativo por empresa; lo que codifica el QR), `origin_type` (`LotOriginType`) + `origin_id` (= `receipt_lines.id`, sin FK), `quantity_received`, `unit_cost` (sin impuesto, 4 dec.), `sale_price`, `warranty_days`, `has_tax`, `price_includes_tax`, `billable_in_sales`, `billable_in_repair_orders`, `created_by_id`. **No guarda existencias.** CHECK: repair ⇒ sales; cantidad > 0; costo/precio/garantía ≥ 0. Un lote confirmado no se edita con CRUD (solo "regularizar", con auditoría, **pendiente**). |
| `StockBalance` | `stock_balances` | PK `(lot_id, branch_id)`. `on_hand`, `reserved` (hoy 0), `available = on_hand − reserved`. CHECK `on_hand ≥ 0` y `0 ≤ reserved ≤ on_hand`. Hoy una fila por lote (sucursal principal). Índices `(company_id, product_id, branch_id)` y `branch_id`. |
| `StockUnit` | `stock_units` | Unidad física de producto serializado. `serial` normalizado (trim + mayúsculas), `status` (`UnitStatus`), lote y sucursal. Único `(empresa, producto, serial)`. |
| `StockMovement` | `stock_movements` | **Kardex: solo se insertan filas**, nunca se editan ni se borran. `quantity` **con signo** (+ entra, − sale). En serializados hay **un movimiento por unidad** (`±1`, con `unit_id`). `unit_cost` = copia del costo del lote al momento. `reference_type` (varchar 30) + `reference_id` (**uuid**, sin FK) = documento origen. |

Enums (`stock/enums/stock.enums.ts`):
- `LotOriginType`: `RECEIPT, ADJUSTMENT, RETURN, OPENING`.
- `UnitStatus`: `AVAILABLE, RESERVED, SOLD, CONSUMED, RETURNED` + **`ISSUED`** (nuevo: en poder de un empleado por una salida manual). `CONSUMED` = usada en una orden de reparación (otro flujo); `RETURNED` existe pero **no** se usa en los vales **(verificar su significado original)**.
- `MovementType`: `RECEIPT_IN, RECEIPT_VOID, SALE_OUT, REPAIR_CONSUMPTION, TRANSFER_OUT, TRANSFER_IN, ADJUSTMENT, RETURN_IN` + **`INTERNAL_OUT`** (nuevo: salida manual sin orden).

`reference_id` es uuid: por eso el kardex de un vale apunta al **vale** (`reference_type = 'STOCK_VOUCHER'`), y la orden (id entero) vive en el vale.

### 5.4 Vales de movimiento manual (`stock-vouchers/`)  [ENTREGADO, SIN PROBAR]
| Entidad | Tabla | Notas clave |
|---|---|---|
| `StockMovementReason` | `stock_movement_reasons` | Catálogo **por empresa** (reemplaza `name_movement`/`name_movementtype` del legacy Mongo). `code`, `name`, `direction` (`OUT`/`IN`), `order_link` (`REQUIRED`/`FORBIDDEN`), `is_returnable`, `is_system`, `status`, `sort_order`. Único `(company_id, code)`. FK a `CompanyReplica` con CASCADE. |
| `StockVoucher` | `stock_vouchers` | Cabecera **inmutable**: `code` (correlativo `stock_voucher_code`, `update: false`), `direction`, `reason_id`, `branch_id`, `employee_id` (sin FK), `order_id` + `order_number` (sin FK; snapshot), `origin_voucher_id` (solo retornos), `note`, `client_request_id` + `request_hash`, `created_by_id`, `created_at` (timestamptz). Únicos `(company, code)` y `(company, client_request_id)`. CHECK: `(direction='IN') = (origin_voucher_id IS NOT NULL)` y `(order_id IS NULL) = (order_number IS NULL)`. |
| `StockVoucherLine` | `stock_voucher_lines` | `line_no`, `product_id`, `lot_id`, `quantity > 0`, **snapshot** del lote (`unit_cost`, `sale_price`, `billable_in_sales`, `billable_in_repair_orders`), `origin_line_id` (retornos). Único `(voucher_id, line_no)`. FK a voucher/producto/lote con RESTRICT. **(verificar)** índice en `origin_line_id` (lo usan el listado y `returnProgress`). |
| `StockVoucherLineUnit` | `stock_voucher_line_units` | PK `(line_id, unit_id)`: qué IMEI/seriales se movieron en cada línea serializada. |
| `StockVoucherAttachment` | `stock_voucher_attachments` | **[ENTREGADO, SIN PROBAR]** Fotos **por línea** del vale (estado del repuesto al salir o al regresar). `company_id`, `voucher_id` (FK RESTRICT, índice), **`line_id`** (FK a `stock_voucher_lines`, RESTRICT, índice, NOT NULL), `file_key` (S3), `original_name`, `mime_type`, `size_bytes`, `sort_order` (base 0, **dentro de su línea**), `created_by_id`, `created_at`. **Solo inserción** (el vale es inmutable). Antes eran por vale: al migrar una base de pruebas hay que vaciar la tabla (`TRUNCATE stock_voucher_attachments;`) porque `line_id` es NOT NULL. |

Motivos de sistema (seed; nombres según el legacy):
| code | nombre | dirección | orden | retornable |
|---|---|---|---|---|
| `REPARACION_DANO` | REPARACION DAÑO | OUT | REQUIRED | sí |
| `USO_LAB` | USO LAB | OUT | FORBIDDEN | sí |
| `REMANOFACTURAR` | REMANOFACTURAR | OUT | FORBIDDEN | no |
| `RECICLAJE` | RECICLAJE | OUT | FORBIDDEN | no |
| `NO_REQUERIDO` | NO REQUERIDO | IN | REQUIRED (solo sobre salidas con orden) | — |
| `DEVOLUCION` | DEVOLUCION | IN | FORBIDDEN (solo sobre salidas sin orden) | — |

Legacy: `id_type_movement` `657cb079…` = SALIDA, `658d863e…` = ENTRADA. **No se migra historial**: se empieza desde cero. `DEVOLUCION` es nuevo (contraparte sin orden de NO REQUERIDO).
`is_returnable = false` en REMANOFACTURAR y RECICLAJE es una **suposición** (editable en el seed o en la tabla).

## 6. Reglas de negocio

### 6.1 Ingresos
1. **Guardar un ingreso ya mueve stock** (lotes, saldos, unidades serializadas, kardex `RECEIPT_IN`). No hay borrador. "Verificar" (`VERIFIED`) solo significa que alguien lo revisó contra el documento; no toca stock. Un usuario distinto o el mismo pueden verificar.
2. **Anular** = movimientos contrarios (`RECEIPT_VOID`), nunca borrar. Debe exigir que el lote no se haya consumido y que `paid_total = 0` (o anular antes los pagos). **Pendiente.** "Lote sin consumir" = `on_hand = quantity_received` **y** sin unidades `ISSUED`: una salida manual pendiente de retorno bloquea la anulación.
3. **`forcesBillableLot`:** si el tipo de documento lo tiene, el servidor fuerza `billableInSales = true`. `billableInRepairOrders` exige `billableInSales`.
4. **El front manda** `salePrice` y `warrantyDays` (decide quien ingresa); las banderas son opcionales y se completan desde el producto.
5. **Seriales/IMEI:** productos `SERIAL` (todo `DEVICE`): `quantity` = número de equipos; cada equipo (`units[].serials`) trae 1–4 IMEI. No se repiten dentro del ingreso ni contra stock existente. Productos por cantidad no llevan seriales. Unicidad hoy por `(empresa, producto, valor)`; **decisión pendiente** de hacerla global por empresa.
6. **Línea sin inventario** (`affectsInventory: false`): transporte, servicios, etc. Sin producto, lote, precio ni garantía; exige `description`. **Sí suma** a subtotal/descuento/impuesto/total (el total debe cuadrar con el documento y con los pagos). El transporte no se prorratea al costo (no hay *landed cost*).
7. **Pagos:** el estado de pago se **calcula** (`0` → UNPAID, parcial → PARTIAL, `= total` → PAID), nunca se marca a mano. Cuotas ilimitadas (hasta 50 iniciales en `create`); la suma de pagos vigentes jamás supera el total (409 con saldo). Se bloquea la fila del ingreso al pagar. Comprobante opcional (PDF/imagen). Pagos iniciales pueden venir dentro de `POST /receipts` (`payments[]`, comprobantes `proof_<n>`), en la misma transacción. Límites: monto hasta 2 decimales, fecha no futura, referencia ≤ 100, nota ≤ 500.
8. **Archivos del ingreso:** fotos `photos_<n>` (n = índice de línea base 0), máx. 5 por línea; documento `document` (PDF o imagen, uno). Límites de servicio: documento 10 MB, foto 5 MB, comprobante 5 MB.
9. **Aprendizaje de códigos del proveedor:** al guardar, cada línea con `supplierCode` hace upsert `código → producto` (gana lo último; si cambia de destino se audita `before/after`). Si `supplierQuantity` difiere de `quantity`, se aprende `unitFactor = quantity / supplierQuantity` (cajas → unidades). Líneas sin inventario enseñan `is_non_inventory`. Mismo código con destinos distintos en el mismo ingreso → 400. Solo aprende si el ingreso se guarda (misma transacción).
10. **Clave de acceso es una ayuda, no una imposición:** nada de la factura se fuerza; el usuario edita cantidad, costo, proveedor, fecha. Si `accessKey` viene en `create`: `source = ACCESS_KEY`, se reconsulta al SRI, se guarda el XML en S3 + autorización. Si el SRI falla, el ingreso se guarda igual sin XML. Misma clave no se importa dos veces (índice único, excluye anulados).
11. **Auditoría del documento:** el XML guardado + `supplier_*` por línea permiten comparar después lo ingresado contra la factura real (comparador pendiente).

### 6.2 Movimientos manuales de stock (vales)
1. **Un vale es un documento inmutable** (cabecera + líneas + fotos). No se edita ni se borra. Un error se corrige con un **retorno**. El kardex también es solo-inserción.
2. **Dirección y reglas salen del motivo** (`StockMovementReason`): `direction` (OUT/IN) y `order_link`. Para OUT: `REQUIRED` exige `orderId`, `FORBIDDEN` lo prohíbe. Para IN: indica sobre qué salidas aplica (con o sin orden).
3. **Salida (OUT):**
   - Exige `employeeId` (debe existir en `user_employee_cache` de la empresa).
   - Con orden: la orden debe existir en `orders_replica` de la empresa y **no** estar en estados 8/9/10. Tipo de movimiento `REPAIR_CONSUMPTION`. Sin orden: `INTERNAL_OUT`.
   - **El lote lo elige el usuario** (`lotId` obligatorio por línea). No hay FIFO automático (los lotes tienen distinta facturabilidad en órdenes; un FIFO silencioso podría cobrar mal). El front recibe los lotes ordenados por antigüedad.
   - Un mismo lote no puede repetirse en dos líneas del mismo vale.
   - Sale de la sucursal principal (hoy; ver pendiente 26); valida `on_hand − reserved ≥ cantidad`; nunca deja stock negativo.
   - Productos `SERIAL`: `unitIds.length = quantity`, unidades `AVAILABLE` del lote y la sucursal; pasan a `ISSUED`. Productos por cantidad no llevan `unitIds`.
   - La línea guarda el **snapshot** del lote (costo, precio, banderas).
4. **Retorno (IN)** (caso típico: el repuesto no se ocupó en la orden):
   - Se crea con el mismo `POST /stock-vouchers` (no hay endpoint propio): el servidor lo trata como retorno porque el motivo es de dirección `IN`.
   - Referencia **un solo** vale de salida (`originVoucherId`) cuyo motivo sea `is_returnable`. Cada línea apunta a una línea de ese vale (`originLineId`).
   - **Hereda** del vale original: empleado, orden, sucursal y snapshot de costo/precio. Si el cliente envía empleado/orden distintos → 400; si envía `lotId` → 400.
   - Vuelve al **mismo lote y sucursal** (conserva el costo). Los seriales vuelven como la **misma unidad** (`ISSUED` → `AVAILABLE`); no se crea otra.
   - `devuelto ≤ sacado − ya devuelto` por línea; las líneas de origen se bloquean (`FOR UPDATE`) para serializar retornos concurrentes. En serializados, solo unidades de esa línea aún no retornadas (se verifica con las líneas de retorno que apuntan a la origen) y con estado `ISSUED`.
   - El motivo IN debe ser compatible: `REQUIRED` ⇒ la salida tenía orden (NO REQUERIDO); `FORBIDDEN` ⇒ no tenía (DEVOLUCION).
   - Si la orden está ENTREGADA (8) **no** admite retorno (inmutable). Si la orden no está en la réplica (p. ej. mientras se repuebla) se **rechaza** con mensaje de reintentar, en vez de dejar pasar el cambio.
   - **Decisiones tomadas:** (a) la pieza vuelve a la **sucursal del vale original**, aunque lo devuelva un usuario de otra sucursal (consistente con el kardex mientras no haya transferencias); (b) la pieza devuelta queda **siempre `AVAILABLE`**, sin condición "dañado" (la foto de retorno es la evidencia; ver pendiente 33); (c) **cualquier usuario autenticado** puede devolver cualquier salida, no solo el empleado que la recibió (permisos: pendiente 22); (d) "devolver todo lo pendiente" es solo un atajo del front (precarga líneas con `pending > 0` y unidades con `returned: false`), sin endpoint nuevo.
   - **Efecto en el costo:** el costo neto de la orden baja (salidas − retornos con costo congelado). Si la orden ya se facturó antes de pasar a 8, ese ajuste no se refleja en facturación (fuera de este módulo).
5. **Puede devolverse (`canReturn`):** lo calcula el servidor con `returnState(...)` (una sola función para listado y detalle). Es `true` solo si se cumplen todas: el vale es `OUT`; `reason.isReturnable`; queda algo pendiente (`pending > 0`); y, si tiene orden, la orden está en la réplica y su estado no es 8. Si no, `returnBlock` explica por qué: `IS_RETURN`, `NOT_RETURNABLE`, `FULLY_RETURNED`, `ORDER_DELIVERED` o `ORDER_UNKNOWN`. Es una **guía visual**: el servidor vuelve a validar todo al crear el retorno, y la réplica puede ir por detrás de la orden real (pendiente 11).
6. **Fotos del vale [ENTREGADO, SIN PROBAR]:** **por línea (por producto)**, siempre opcionales, en salidas **y** retornos. Hasta **5 imágenes por línea**, solo imágenes, 5 MB c/u ya en WebP, **25 MB en total por vale**. Campos multipart `photos_<n>` (n = índice de la línea en `lines`, base 0). En un retorno, `photos_0` es la primera línea del retorno. Casos de uso: foto del repuesto dañado al entregarlo al técnico y foto de cómo regresó la pieza. Se suben a S3 antes de la transacción; las filas se insertan dentro (`lineIndex` → id de la línea creada, `lineNo = índice + 1`); si el vale ya existía (`replayed`) o la transacción falla, se borran. No se pueden agregar después de creado el vale (inmutable). `summary` y `getDetail` devuelven las fotos en **`lines[].attachments[{ id, originalName, mimeType, sizeBytes, url }]`** (URL firmada, 30 min). **Ya no existe `attachments` en la raíz del vale** (cambio de contrato).
7. **Costo por orden** = `Σ(salidas) − Σ(retornos)` sobre las líneas de los vales de esa orden, con el costo congelado en cada línea. `netBillableAmount` solo suma líneas con `billable_in_repair_orders`, al precio congelado, sin impuesto.
8. **No existe "saldo por empleado" / custodia.** Lo que sale con una orden se **consume**, no queda en custodia, así que "pendiente por devolver" no tiene significado de negocio. El listado con filtro `employeeId` cubre la consulta.
9. **Todo con idempotencia (`clientRequestId`) y auditoría** (`CREATED`) en la misma transacción. El stock se mueve únicamente a través de `StockService`. Límites: 100 líneas por vale, nota ≤ 500.

## 7. `StockService` (única puerta al inventario)

Ningún otro módulo escribe en lotes, saldos, unidades ni movimientos.

| Método | Qué hace |
|---|---|
| `registerInbound(em, input)` | Crea lote por línea, saldo, unidades serializadas y kardex (`RECEIPT_IN` por defecto). Valida seriales (no repetidos en el ingreso ni en stock). Correlativo de lotes con `MAX(code)+1` + advisory lock. |
| `registerOutbound(em, input)` `[ENTREGADO]` | Saca stock de lotes concretos: bloquea saldos y unidades (orden estable), valida disponibilidad y estado, descuenta `on_hand`, marca unidades `ISSUED`, inserta kardex (`REPAIR_CONSUMPTION` o `INTERNAL_OUT`; −qty o −1 por unidad). Devuelve el snapshot del lote por línea (`OutboundLineResult`: `lineRef, productId, lotId, quantity, unitCost, salePrice, billable…`). |
| `registerReturn(em, input)` `[ENTREGADO]` | Regresa al mismo lote/sucursal: suma `on_hand`, unidades `ISSUED` → `AVAILABLE`, kardex `RETURN_IN` (+qty o +1 por unidad). **Quien llama valida que lo retornado no supere lo sacado.** |
| `availability(companyId, productIds, branchId?)` | Disponibilidad por producto, separando lo facturable en ventas y en órdenes. |
| `listLotsWithStock(companyId, productId, branchId?, filters?)` | Lotes con existencias (`on_hand > 0`), más antiguos primero (para elegir lote o resolver el QR). `filters` opcional: `{ billableInRepairOrders?, billableInSales? }`; cada filtro solo se aplica si no es `undefined`. |
| `listAvailableUnits(companyId, lotId, branchId?)` `[ENTREGADO]` | Unidades `AVAILABLE` de un lote con todos sus IMEI. |

Todas las operaciones de escritura reciben el `EntityManager` de quien confirma (van dentro de **su** transacción).

## 8. Endpoints y comandos

### 8.1 Gateway — ingresos (`/receipts`, o `/inventory-core/receipts` según RouterModule)

| Método y ruta | Comando MS | Descripción |
|---|---|---|
| `GET new-data` | `get_receipt_new_data` | Formulario: sucursal principal, tipos de documento (con `forcesBillableLot`), `paymentMethods`, fecha por defecto, enums. Proveedores y productos van por sus buscadores. |
| `GET products/search` | `search_products_for_receipt` | Buscador de productos para ingreso (`search`, `limit`, `kind`, `supplierId`). Cada item: datos, `models`, `defaults`, `lastReceipt` y `supplierCodes`. |
| `GET suppliers/search` | `search_suppliers` | Buscador de proveedores. |
| `POST /` | `create_receipt` | **multipart**: `data` (JSON), `document`, `photos_<n>`, `proof_<n>`. Crea ingreso + stock + pagos + adjuntos. |
| `GET /` | `list_receipts` | Listado: búsqueda por proveedor, nº/tipo de documento, producto (nombre, SKU, marca, modelo, código técnico, **descripción de línea**, incluye líneas sin inventario), código de ingreso, IMEI (≥6 chars). Filtros: fechas, `status`, `paymentStatus`, `documentTypeId`, `productId`, orden. **No existe filtro `supplierId`**. `includeFilters=true`. Cada item trae `paymentStatus`, `paidTotal`, `balance`. |
| `GET :id` | `get_receipt_detail` | Detalle completo (líneas con `product` nulo si no afecta inventario, lote, existencias, equipos con IMEI, pagos con comprobantes firmados, documento y fotos firmadas, auditoría, `source/accessKey/hasSourceXml`). |
| `GET :id/payments` | `list_receipt_payments` | Pagos + totales + `paymentMethods`. **(verificar)** El handler del MS existe; en el gateway pegado no aparece ni la ruta ni el método del service. |
| `POST :id/payments` | `add_receipt_payment` | **multipart**: `data` + `proof`. Idempotente por `clientRequestId`. El payload al MS lleva `file` (no `files`). |
| `PATCH :id/payments/:paymentId/void` | `void_receipt_payment` | Anular pago con `reason` (3–500). Recalcula estado. |

Eliminados: `PATCH :id/payment-status`, `GET :id/payment-history`, `GET filters`.
Los comandos `search_products_for_receipt` y `search_suppliers` no están en `receipts.controller.ts` del MS: viven en otros controllers **(verificar dónde)**.

### 8.2 Gateway — SRI (`POST /sri/access-key/preview`)

Valida la clave localmente (49 dígitos, módulo 11, fecha, tipo `01` factura), comprueba duplicado (`canImport`, `existingReceipt`), consulta al SRI (SOAP `AutorizacionComprobantesOffline`, 7 s × 2 intentos; ambiente TEST usa `celcer`), lee cabecera y líneas del XML. Respuesta:

- `supplier`: forma idéntica al item de `suppliers/search` si el RUC existe; si no, `null` + `supplierDraft` (RUC, razón social, nombre comercial, dirección, país Ecuador, `source: SRI|ACCESS_KEY`) + `supplierForm` (tipos de identificación y países) para el modal del front.
- `lines[]`: datos de la factura + `match.status`: `MAPPED` (con `product` **idéntico** a un item de `products/search` y `suggestion { quantity, unitCost }` convertidos por `unitFactor`), `UNMAPPED` (`reason`: `NO_MAPPING | NO_CODE | PRODUCT_INACTIVE`) o `NON_INVENTORY`.
- `documentTotals`, `sri { available, state, ... }`, `warnings`.
- SRI caído: no bloquea; `sri.available=false`, líneas vacías.

### 8.3 Gateway — productos

`GET products` (listado con `stock{onHand,reserved,available,billable...,status OUT|LOW|OK}`, `lastLot`, filtros `stockStatus/trackingMode/qualityId`, orden por stock, `includeFilters`). `GET products/:id` (ficha + `stock`, `lots` con ingreso de origen, `units` con IMEI, `movements` kardex, `history`).

### 8.4 Gateway — vales de stock (`/stock-vouchers`)  [ENTREGADO, SIN PROBAR]
Ubicación: `gateway/src/inventory-core/stock-vouchers/` (`stock-vouchers.controller.ts`, `stock-vouchers.service.ts`, `dto/create-stock-voucher-gateway.dto.ts`, `dto/list-stock-vouchers-query.dto.ts`, `helpers/stock-voucher-attachments.helper.ts`). Controller con `@Controller('stock-vouchers') @Auth()` y `ctx(user)` = `{ userId: user.sub, companyId: user.companyId, branchId: user.branchId }`. Hay que registrarlos en el módulo del gateway que agrupa `inventory-core` **(verificar)**. Contrato completo para el front: documento "Contrato de API — Movimientos manuales de stock (vales)" (**actualizar: multipart por línea, `lines[].attachments`, selector de lotes, listado enriquecido, `canReturn`**).

| Método y ruta | Comando MS | Payload al MS | Descripción |
|---|---|---|---|
| `GET new-data` | `get_stock_voucher_new_data` | `{ user }` | Motivos activos con sus reglas (`direction`, `orderLink`, `isReturnable`). |
| `GET products/:productId/lots` | `search_stock_voucher_lots` | `{ productId, user }` | Lotes con existencias del producto **en la sucursal del usuario** (`user.branchId`, obligatorio), más antiguos primero, solo `available > 0`, filtrados por `LOT_PICKER_FILTERS` (ver abajo). Cada lote trae `units[{ id, serials[] }]` (unidades `AVAILABLE` con todos sus IMEI; vacío en productos por cantidad). |
| `GET lots/:lotId/units` | `list_stock_voucher_lot_units` | `{ lotId, user }` | Unidades `AVAILABLE` del lote con todos sus IMEI (sucursal **principal**). Ya no lo necesita el modal de salida (los lotes traen `units`). |
| `GET orders/:orderId` | `get_order_stock_summary` | `{ orderId, user }` | Vales de la orden + `products[]` (`netQuantity`, `netCost`, `netBillableAmount`) + `totals`. `orderId` entero (`ParseIntPipe`). |
| `POST /` | `create_stock_voucher` | `{ dto, files, user }` | **multipart**: campo `data` (JSON del vale) + campos `photos_<n>` (0–5 imágenes por línea, n = índice de línea base 0). Crea una salida **o** un retorno según el motivo. Idempotente. Devuelve resumen con `lines[].attachments` y `replayed`. |
| `GET /` | `list_stock_vouchers` | `{ query, user }` | Listado enriquecido (ver abajo). Filtros `direction, reasonId, employeeId, orderId, from, to, search`, `page/limit/sortBy(createdAt\|code)/sortDir`, `includeFilters`. |
| `GET :id` | `get_stock_voucher_detail` | `{ id, user }` | Cabecera, motivo, empleado y creador **con nombre**, orden (con estado/cliente de la réplica), vale origen, retornos, `canReturn`/`returnBlock`, líneas (SKU, lote, snapshot, unidades con IMEI, `attachments` con URL firmada), `returned`/`pending` por línea en salidas. |

Rutas literales (`new-data`, `products/...`, `lots/...`, `orders/...`) van **antes** de `:id`.

**`LOT_PICKER_FILTERS`** (constante en `stock-vouchers.service.ts`): hoy `{}` (**PRUEBAS**: lista todos los lotes). **Antes de producción restaurar `{ billableInRepairOrders: true }`**; si no, se puede asignar a una orden un lote no facturable en órdenes (su costo sale del stock pero `netBillableAmount` lo ignora).

Payload `data` de `create_stock_voucher`: `{ clientRequestId, reasonId, employeeId?, orderId?, originVoucherId?, note?, lines[{ lotId?, originLineId?, quantity, unitIds? }] }`.
- Salida: `employeeId` obligatorio; `orderId` si el motivo lo exige; cada línea con `lotId`; `unitIds` solo en serializados.
- Retorno: `originVoucherId` obligatorio; cada línea con `originLineId`; **no** enviar lote, empleado ni orden.
- Fotos: campos `photos_<n>` (cualquier otro nombre → 400; índice ≥ número de líneas → 400), solo `image/*`.

**Listado `GET /stock-vouchers` — query** (todos opcionales): `page` (≥ 1, def. 1), `limit` (1–100, def. 20), `sortBy` (`createdAt`\|`code`), `sortDir` (`ASC`\|`DESC`, también minúsculas), `direction` (`OUT`\|`IN`), `reasonId` (uuid), `employeeId` (uuid), `orderId` (entero = **id interno** de la orden, no el número visible), `from`/`to` (`AAAA-MM-DD`, inclusivo, hora de Guayaquil), `search` (máx. 100: solo dígitos hasta 9 → código de vale **o** número de orden; otro texto → nombre del empleado **o nombre del cliente de la orden**, `ILIKE`, sensible a tildes), `includeFilters=true` (agrega `filters.reasons` solo en la primera carga).

**Listado — item** (los campos antiguos se conservan; se agregaron los marcados con +):
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
- Nuevos: `reason.code`, `reason.isReturnable`, `createdBy`, `orderStatus`, `customerName`, `originVoucher { id, code }`, `totalQuantity` (suma de unidades, no de líneas), `returnedQuantity`, `pendingQuantity`, `returnStatus` (`NONE`\|`PARTIAL`\|`FULL`), `returnCount`, `photoCount`, `canReturn`, `returnBlock`.
- En retornos (`IN`): `returnedQuantity`, `pendingQuantity` y `returnStatus` son `null`; `canReturn` es `false` con `returnBlock: 'IS_RETURN'`; `originVoucher` trae la salida.
- `orderStatus` y `customerName` son `null` si no hay orden o aún no se replicó. `employee.name` y `createdBy.name` pueden ser `null` si el usuario no está en la réplica.
- `returnBlock` ∈ `IS_RETURN`, `NOT_RETURNABLE`, `FULLY_RETURNED`, `ORDER_DELIVERED`, `ORDER_UNKNOWN`. El front solo necesita `canReturn`; `returnBlock` sirve para el tooltip.
- El listado une `orders_replica` con `LEFT JOIN ... AND o.company_id = v.company_id::text` (ver 3 y 10) y calcula seis subconsultas correlacionadas por fila (con `limit` ≤ 100 es aceptable).

**Detalle `GET /stock-vouchers/:id` — notas de contrato:** `reason` puede ser `null`; `order` es `null` sin orden (y `statusId/statusName/customerName` pueden ser `null` si no se replicó); `originVoucher { id, code }` solo en retornos; `returns[{ id, code, createdAt }]` solo en salidas; `canReturn`/`returnBlock` en la raíz; en cada línea `units[{ unitId, serials[], returned }]` (en retornos `returned` siempre es `false`), `attachments[]` con `url` firmada (30 min; no cachear; si no empieza por `http`, la firma falló), y `returned`/`pending` solo en salidas. Errores: `400` si `:id` no es UUID (mensaje de `ParseUUIDPipe` en inglés, pendiente 35), `404` "El vale no existe" (también si es de otra empresa).

**Flujo de retorno desde el front:** (1) desde el detalle o el listado de una **salida**, mostrar "Registrar retorno" si `canReturn`; (2) el motivo sale de `new-data` filtrando `direction === 'IN'` y, según la salida, `orderLink === 'REQUIRED'` si tiene orden o `'FORBIDDEN'` si no; (3) ofrecer solo líneas con `pending > 0` y, en serializados, las `units` con `returned === false`; (4) `POST /stock-vouchers` multipart con `data = { clientRequestId, reasonId, originVoucherId, note?, lines[{ originLineId, quantity, unitIds? }] }` y `photos_<n>` indexadas por línea **del retorno** (reindexar si se quitan líneas); (5) en la respuesta, `replayed: true` significa que ya existía (las fotos del reintento se descartan). Errores del retorno, todos 400 en español con número de línea: falta `originVoucherId`; la salida no existe; motivo no retornable; motivo incompatible con la orden; orden/empleado distintos; orden ENTREGADA; no se pudo verificar la orden; falta `originLineId`; se envió lote; líneas de origen repetidas; la línea no es del vale; unidades que no cuadran con la cantidad; unidad no pendiente; producto por cantidad con unidades; "solo quedan X por retornar de Y". `409` si el `clientRequestId` se reutilizó con datos distintos o colisiona el correlativo.

### 8.5 Microservicio — comandos
- **Vales** (`stock-vouchers.controller.ts`, `@Controller()` con `run` + `ctx` + `uuid`): `get_stock_voucher_new_data`, `create_stock_voucher` (pasa `data.files ?? {}`), `list_stock_vouchers`, `get_stock_voucher_detail`, `get_order_stock_summary`, `search_stock_voucher_lots` (exige `user.branchId` uuid; si falta, 400), `list_stock_voucher_lot_units`. Deben coincidir con el gateway. **Ojo:** el archivo original usaba `stock_vouchers.create|list|detail|order_summary|lots|lot_units` (no coincidían con el gateway); el parche de renombre está **entregado, sin aplicar/verificar**.
- **Empleados** (`users-employees-events.controller.ts`): `get_employees_basic`, `get_technicians`.
- **Órdenes** (`orders-relay.controller.ts`): `search_orders` (exige `user.companyId`).

### 8.6 Gateway — selects auxiliares para el modal de vales  [ENTREGADO, SIN PROBAR]
Un módulo por carpeta en `gateway/src/inventory-core/`, sin módulo propio (controller y service se declaran en el módulo del gateway que agrupa `inventory-core`).

**Empleados** (`employees/employees.controller.ts`, `employees.service.ts`): `GET /employees/basic` → `get_employees_basic` con `{ user }`. Sin parámetros ni paginación. Respuesta `[{ id, username, name }]` (`name` = primer nombre + primer apellido). El front usa `id` como `employeeId` del vale; si hay nombres repetidos, mostrar `name (username)`. Sin orden garantizado: ordenar en el front.

**Órdenes** (`orders/orders.controller.ts`, `orders.service.ts`, `dto/search-orders-query.dto.ts`): `GET /inventory-orders/search?search=` → `search_orders` con `{ search, user }`. Prefijo `inventory-orders` para no chocar con un posible controller `orders` del gateway.
- `search`: único parámetro, opcional, máx. 100 caracteres.
- `#123` → número de orden **exacto**, sin filtro de estado; `#abc` → 400 "Número de orden inválido. Use el formato #123.".
- Sin `#` → palabras (máx. 6) con AND; cada palabra coincide (OR) con cliente, marca o modelo y, si tiene ≥ 6 caracteres, también con serial o IMEI. `ILIKE` con `%`, `_` y `\` escapados. **Excluye estados 8, 9 y 10.**
- Vacío → las 20 más recientes admitidas. Límite fijo 20.
- Respuesta (arreglo plano):

```json
[{ "id": 4521, "orderNumber": 123, "customerName": "Juan Pérez", "device": "Samsung Galaxy A54",
   "deviceType": "CELULAR", "orderType": "REPARACION",
   "status": { "id": 6, "name": "EN REPARACION" }, "canIssue": true }]
```

- Con `#123` una orden en 8/9/10 se devuelve con `canIssue: false` (el front la muestra deshabilitada). El front envía `id` como `orderId` del vale (y como filtro `orderId` del listado). Los retornos no usan este buscador (heredan la orden del vale original). Usar debounce ~300 ms. En el listado de vales **no** se usa `#`: se envía el número sin numeral.

## 9. Módulos y archivos clave (MS)

- `receipts/` → `receipts.service.ts` (create, list, getDetail, getNewData, pagos, learnSupplierCodes, uploads, fetchSourceXml), `receipts.controller.ts` (comandos: `get_receipt_new_data`, `create_receipt`, `list_receipts`, `add_receipt_payment`, `void_receipt_payment`, `list_receipt_payments`, `get_receipt_detail`), entidades, `enums/receipt.enums.ts` (`ReceiptStatus`, `ReceiptSource`, `AttachmentKind`, `PaymentStatus`, `PaymentMethod`).
- `stock/stock.service.ts` → **única puerta de entrada al inventario** (ver sección 7).
- `stock-vouchers/` → `stock-vouchers.service.ts` (create/createOut/createIn, list, getDetail, getOrderSummary, searchLots, listLotUnits, getNewData, `uploadPhotos(companyId, voucherId, files, lineCount)`, `mapAttachments` (devuelve `Map<lineId, fotos[]>`), `returnProgress`, **`returnState`** (regla única de `canReturn`/`returnBlock`, usada por `list` y `getDetail`), `replay`, `summary`, `normalizeInput`), `stock-vouchers.controller.ts`, `stock-vouchers.module.ts`, `entities/` (5), `enums/stock-voucher.enums.ts` (`VoucherDirection`, `ReasonOrderLink`, constantes de estados de orden), `seeds/stock-movement-reasons.seed.ts`.
- `orders-relay/` → `orders-relay.service.ts` (upsert protegido por fecha, bulk, applyUpdate, `search`), `orders-relay.controller.ts` (sync inicial por RMQ y `search_orders`), `orders-events.listener.ts` (Kafka), `entities/order-replica.entity.ts`, `mappers/order-replica.mapper.ts` (`toOrderReplica`, `toDeviceColumns`).
- `catalogs/catalogs.service.ts` → seeds por empresa (tipos de documento, motivos de movimiento) y países globales.
- `common/sequences/` → `SequencesService.reserve`.
- `common/helpers/search-sql.ts` → helpers de búsqueda.
- `sri/` → `access-key.helper.ts`, `sri-client.service.ts` (fetch SOAP + `fast-xml-parser`, sin XXE), `invoice-parser.ts`, `sri.service.ts`, `sri.controller.ts`, `sri.module.ts`. `ReceiptsModule` importa `SriModule` (exporta `SriClientService`); `SriModule` importa `ProductsModule` (exporta `ProductsService`).
- `products/products.service.ts` → `receiptItemsQuery`, `mapReceiptItems`, `findReceiptItemsByIds`, `searchForReceipt`, `list`, `findOne`.
- `users-employees-events/` → `users-employees-events.service.ts` (`findAllEmployeesBasic`, `findTechniciansByOrderType`, sync de usuarios) y su controller (comandos `get_employees_basic`, `get_technicians`).
- **Gateway** (`gateway/src/inventory-core/`): `receipts/`, `stock-vouchers/`, `sri/`, `products/`, `employees/` (selector de empleados), `orders/` (buscador de órdenes), cada uno con `*.controller.ts`, `*.service.ts` y, si aplica, `dto/` y `helpers/`.
- Módulos a importar en `ReceiptsModule`: `CompaniesModule` (MainBranchService), `StockModule`, `SequencesModule`, `AuditLogModule`, `AwsS3Module`, `SriModule`.
- Módulos a importar en `StockVouchersModule`: `TypeOrmModule.forFeature([StockMovementReason, StockVoucher, StockVoucherLine, StockVoucherLineUnit, StockVoucherAttachment])`, `CompaniesModule`, `StockModule`, `SequencesModule`, `AuditLogModule`, **`AwsS3Module`** (nuevo). Lee `OrderReplica` y `UserEmployeeCache` por `EntityManager` (sus módulos ya registran las entidades vía `autoLoadEntities`). `StockVouchersService` inyecta: `DataSource, StockService, SequencesService, AuditLogService, MainBranchService, AwsS3Service`.

## 10. Errores y lecciones (no repetir)

- `data.files` no se pasaba al servicio en el controller del MS → adjuntos no se guardaban. El handler debe llamar `create(dto, companyId, userId, data.files ?? {})`. Lo mismo aplica a vales.
- **Nombres de comando desalineados** gateway ↔ MS de vales (`create_stock_voucher` vs `stock_vouchers.create`): el mensaje nunca llegaba al handler. Comprobar siempre ambos lados.
- Entidades nuevas sin registrar → "relación no existe".
- Firma del service del gateway desalineada (`create(dto, files, user)`) → error TS "esperaban 2 argumentos, se obtuvieron 3".
- `for (...) { /* igual */ }` dejó filtros UUID sin validar.
- `Map` con tuplas sin cast → error TS de sobrecarga.
- No loguear base64 completo; imprimir solo resumen (nombre, tamaño, índice). El `multipart-request.helper.ts` aún imprime `formData` completo.
- Si se cambian enums de BD (`status` del ingreso, `UnitStatus`, `MovementType`), limpiar el tipo anterior o migrar (`ALTER TYPE ... ADD VALUE` en producción).
- `StockModule` importado dos veces en `app.module.ts` → identificador duplicado.
- `reference_id` del kardex es **uuid**: no sirve para ids enteros (órdenes). Referenciar el documento propio (vale) y guardar la orden en él.
- Postgres: un `INSERT ... ON CONFLICT DO UPDATE` con el mismo id dos veces en el mismo statement falla → deduplicar antes (réplica de órdenes, bulk).
- Postgres limita a 65 535 parámetros por query → insertar por lotes (500–1000 filas).
- Validar stock en el servicio antes de que salten los `CHECK` de saldo (mensaje en español con número de línea y lote).
- Hay que comprobar el contrato de nombres de comandos contra el controller del MS cuando se agregue un módulo (el gateway usa string; el MS, `{ cmd }`).
- `getPresignedUrl` devuelve la key cruda si falla la firma: no confiar en que el valor sea siempre una URL.
- Cambiar la firma de un método del MS (`searchLots(companyId, productId)` → `(companyId, productId, branchId)`) obliga a buscar todos sus llamadores: TypeScript marca error en los que quedaron con los argumentos viejos.
- Al renombrar una constante exportada del gateway (`MAX_VOUCHER_PHOTOS` → `MAX_PHOTOS_PER_LINE`), buscar quién más la importaba.
- Al agregar columnas a una réplica, también hay que agregarlas a `UPSERT_COLUMNS` y vaciar la tabla para reconciliar; si no, el bulk no las llena.
- El filtro `LOT_PICKER_FILTERS = {}` es solo de pruebas; se olvida fácil al pasar a producción (ver 8.4).
- **Error real (listado de vales):** `QueryFailedError: el operador no existe: character varying = uuid` al unir `orders_replica` con `stock_vouchers` (`o.company_id = v.company_id`): `orders_replica.company_id` es `varchar(64)` y el del vale es `uuid`. Falla solo al comparar **columna con columna** (contra un parámetro no). Solución: `v.company_id::text`. Aparece primero en `getCount`, porque es la primera consulta que usa el join.
- (MS orders, Mongo, no este repo) en `OrdersRelayService.applyUpdate` el `default:` está **antes** de `priority_changed` y sin `break`: un scope desconocido cae en `priority_changed` y falla con `payload.priority.id`. Moverlo al final.

## 11. Estado de implementación y verificación

| Componente | Estado |
|---|---|
| Ingresos, pagos, SRI, productos, proveedores | Construido y en uso (según el historial previo). Búsqueda por descripción de línea (`lineProductSearchSql` con `LEFT JOIN`) ya aplicada. |
| `orders-relay` (Postgres) con tipo de orden y dispositivo | **ENTREGADO, SIN PROBAR.** Falta: confirmar versión de TypeORM (`overwriteCondition`), que `registerHandlers()` se llame en el orquestador, **vaciar `orders_replica` y reiniciar** para llenar las columnas nuevas, y comprobar que el evento `ms.order.created` trae `device.model.brand_name` y `type.name` (se asumió del schema de Mongo). |
| Buscador de órdenes (`search_orders`, gateway `inventory-orders/search`) | **ENTREGADO, SIN PROBAR.** Falta registrar controller y service en el módulo del gateway. |
| Selector de empleados (`get_employees_basic`, gateway `employees/basic`) | MS existente; gateway **ENTREGADO, SIN PROBAR**. Verificar `employee.company_id` en el QueryBuilder. |
| `stock-vouchers` (MS) | **ENTREGADO, SIN PROBAR.** Solo se verificó sintaxis (transpilación TS). No se ha corrido el type-check completo del repo ni ninguna prueba contra Postgres. |
| Selector de lotes (`search_stock_voucher_lots`: sucursal del usuario, `units` con IMEI, filtros) | **ENTREGADO, aplicado en el service, SIN PROBAR.** `LOT_PICKER_FILTERS = {}` (pruebas). Inconsistente con `createOut` (pendiente 26). |
| Fotos de vales **por línea** (entidad con `line_id`, helper `photos_<n>`, `create`/`uploadPhotos`/`mapAttachments`/`summary`/`getDetail`, controller gateway) | **ENTREGADO, SIN PROBAR.** Checklist: `TRUNCATE stock_voucher_attachments;`, registrar la entidad en `forFeature`, importar `AwsS3Module`, buscar usos de `MAX_VOUCHER_PHOTOS`, confirmar que `serializeFilesForMicroservice` devuelve un elemento por archivo y en el mismo orden. |
| Listado de vales enriquecido (`list` con `returnState`, join a `orders_replica`, subconsultas de cantidades) | **ENTREGADO; el primer arranque falló por el cast `varchar = uuid` y se corrigió con `::text` (corrección entregada, sin reconfirmar).** Falta probar el listado completo. |
| `canReturn`/`returnBlock` en `getDetail` (cambio con `returnState`, dos inserciones) | **ENTREGADO, SIN PROBAR.** **(verificar)** que se aplicó: antes de esto el detalle no devolvía `canReturn`. |
| Flujo de retorno (backend `createIn`/`registerReturn`; contrato para el front) | Lógica **ENTREGADA, SIN PROBAR**; contrato documentado en 8.4. **(verificar)** que `CreateStockVoucherGatewayDto` acepta `originVoucherId` y `lines[].originLineId` (pendiente 31). |
| Renombre de comandos del controller del MS de vales | **ENTREGADO, sin aplicar.** |
| `parse-json-field.helper.ts` + migrar ingresos a usarlo | **ENTREGADO, sin aplicar en ingresos.** (El controller de vales ya lo usa.) |
| `StockService`: `registerOutbound`, `registerReturn`, `listAvailableUnits`; `listLotsWithStock` con filtros | **ENTREGADO como parche.** **(verificar)** que se pegó y que `Product` está importado. |
| Enums `UnitStatus.ISSUED`, `MovementType.INTERNAL_OUT` | **Pendiente de aplicar** (en pruebas basta con `synchronize`; ver nota de enums si algún día hay datos). |
| Seed de motivos en `CatalogsService` | **ENTREGADO como parche.** Falta enganchar `seedStockMovementReasons(companyId)` al flujo de empresa nueva. |
| Gateway `stock-vouchers` | **ENTREGADO, SIN PROBAR.** Falta registrarlo en el módulo del gateway (y RouterModule si aplica). |
| Migraciones | **No aplican por ahora** (entorno de pruebas con `synchronize`). Se generarán antes del primer despliegue a producción. |

Primera prueba recomendada: una **salida serializada** completa (con orden, fotos en `photos_0` y `photos_1`) seguida de un **retorno parcial** (con foto) y luego del resto; ahí se cruzan bloqueos, unidades `ISSUED`, pendiente por línea, snapshot y adjuntos. Verificar en el listado que `canReturn` pase de `true` a `false` con `returnBlock: 'FULLY_RETURNED'` al devolver todo. Antes, probar los selectores: buscar `#123` y por texto, listar lotes con un usuario de la sucursal principal y con uno de otra (este debería ver la lista vacía). Después: salida sin orden (USO LAB), orden en estado 8/9/10 (el listado debe mostrar `ORDER_DELIVERED` en 8), listado con `orders_replica` vacía (`ORDER_UNKNOWN`), doble envío con el mismo `clientRequestId` (verificar que las fotos del reintento se borren de S3), una foto que no es imagen, 6 fotos en una línea, fotos con índice de línea inexistente, y dos salidas concurrentes del mismo lote.

## 12. Pendiente / siguientes pasos

### Ingresos
1. **Comparador de auditoría** `GET receipts/:id/source-document`: leer XML de S3 y comparar línea a línea (cantidad, costo, descuento, impuesto) contra lo ingresado.
2. **Verificar** (`REGISTERED → VERIFIED`) y **anular** ingreso (`RECEIPT_VOID`, exige lote sin consumir —`on_hand = quantity_received` y sin unidades `ISSUED`— y pagos en cero), auditados.
3. Edición de ingreso (solo si el lote no se ha movido) — delicado, no iniciado.
4. Subir XML manualmente (reusa el parser) y crear proveedor desde la importación (el modal es del front; endpoint de proveedores existente).
5. Sugerencias por similitud para líneas `UNMAPPED`; aprender por descripción cuando no hay código.
6. Confirmar ruta/método gateway de `GET :id/payments` (`list_receipt_payments`).

### Stock y vales
7. **Aplicar y probar** todo lo marcado SIN PROBAR (sección 11).
8. **Buscador de productos con existencias** para vales (hoy el front reutiliza `GET receipts/products/search` y luego pide lotes; un producto sin stock devuelve lista vacía). Requiere ver `ProductsService`.
9. **Nombre del producto** en el detalle/resumen/listado de vales (hoy solo `sku`); requiere la entidad `ProductName`. Con ella el listado podría mostrar el primer producto y "+N más".
10. **Búsqueda por palabras** en el listado de vales con `search-sql.ts` (hoy: número = código/orden; texto = nombre del empleado o del cliente de la orden con `ILIKE`, sensible a tildes).
11. **Carrera orden→ENTREGADA:** si la orden pasa a 8 justo cuando alguien saca un repuesto (o lo devuelve) y Kafka aún no replicó el cambio, el vale pasa; y `canReturn` puede ir desfasado. Un bloqueo definitivo exigiría una consulta síncrona al MS de órdenes.
12. **Regularizar lote** (editar banderas de un lote confirmado, con auditoría) — mencionado en la entidad `Lot`, no construido.
13. Decidir si `REMANOFACTURAR` debe **producir** una pieza nueva (hoy solo saca stock) y si RECICLAJE/REMANOFACTURAR deben admitir retorno.
14. Decidir si el consumo de repuestos de una reparación desde el **MS de órdenes** debe pasar por `StockService`/vales (hoy no existe ese camino; si aparece, debe usar `StockService` y quedar ligado a la orden).
15. Decidir unicidad de IMEI global por empresa (hoy por producto).
16. Reservas de stock (`reserved`) dependen de ventas/órdenes, hoy en 0.
17. Stock por sucursal (`byBranch`) cuando existan transferencias.
18. Aprobación de salidas (`requires_approval`) no existe; las salidas descuentan stock de inmediato, sin custodia ni estado intermedio.
19. **Fotos de vales:** endpoint aparte para agregar fotos a un vale ya creado (hoy no se puede); barrer huérfanos de `stock-vouchers/…` junto con los de `receipts/…`. (Ya resuelto: las fotos van por línea.)
20. Actualizar el documento "Contrato de API — Movimientos manuales de stock" con multipart por línea (`photos_<n>`), `lines[].attachments`, el selector de lotes con `units`, el listado enriquecido y `canReturn`/`returnBlock`.
26. **Sucursal de las salidas:** el selector de lotes usa `user.branchId` pero `createOut` sigue usando `MainBranchService`. Opción recomendada: `createOut` recibe `branchId` desde `data.user.branchId`, lo pasa a `registerOutbound` y valida que el saldo exista en esa sucursal; los retornos no cambian (usan la del vale original). Hoy los saldos existen solo en la sucursal principal (los ingresos también usan `MainBranchService`), así que un usuario de otra sucursal verá la lista vacía hasta que haya transferencias o ingresos hacia su sucursal.
27. **Restaurar `LOT_PICKER_FILTERS = { billableInRepairOrders: true }`** antes de producción.
31. **Verificar el DTO de creación** (`create-stock-voucher-gateway.dto.ts`, no revisado): debe declarar `originVoucherId` y `lines[].originLineId`; con `forbidNonWhitelisted` los rechazaría con 400 antes de llegar al MS y los retornos no funcionarían.
32. **Validar fechas y rango en `list`:** `from=2026-02-31` o `2026-13-01` pasan el `Matches` del DTO y el `DATE_RE` del MS pero Postgres falla al convertir a `date` y responde **500** en vez de 400; y `from > to` devuelve lista vacía sin avisar. Corregir con validación de fecha real y de rango (400 en español).
33. **Condición de la pieza devuelta** (opción B del retorno): hoy siempre vuelve `AVAILABLE`. Si en la práctica llegan piezas dañadas, agregar condición `GOOD`/`DAMAGED` al retorno y un estado de unidad o lote aparte para lo dañado (tocaría `registerReturn` y `UnitStatus`).
34. **Filtro "pendientes de retorno" en el listado** (p. ej. `returnStatus=PENDING`): requiere parámetro nuevo en el DTO y condición en el `where`. Además **verificar índices** en `stock_voucher_lines(origin_line_id)` y `stock_vouchers(origin_voucher_id)`, que usan las subconsultas del listado (el de `stock_voucher_attachments(voucher_id)` ya existe).

### Transversal
21. Resolver **nombres de usuario** con `user_employee_cache` en **ingresos** (listado, detalle, pagos e historial); en vales ya se devuelven nombres.
22. Roles/permisos: quién registra o anula pagos, verifica o anula ingresos, **registra salidas/retornos de stock** (hoy cualquier usuario autenticado puede devolver cualquier salida). Hoy `@Auth()` solo exige sesión.
23. Rendimiento: índices `pg_trgm` en búsquedas `LIKE '%x%'` si crecen los datos; barrer archivos huérfanos de S3 (`receipts/{companyId}/...` y `stock-vouchers/{companyId}/...` vs tablas).
24. **Antes del primer despliegue a producción:** generar migraciones reales (tablas de vales y adjuntos, `orders_replica` con sus columnas de tipo y dispositivo, índices, `CHECK`, `ALTER TYPE` de enums); `synchronize` está apagado en producción.
25. Limpieza del gateway: quitar `[DEBUG]` de `multipart-request.helper.ts`, eliminar la interfaz `ParsedFile` duplicada y migrar `receipts.controller.ts` a `parseJsonField`.
28. **Nombre completo en el select de empleados:** `get_employees_basic` devuelve solo primer nombre y primer apellido, y puede mostrar duplicados. Evaluar cambiar a nombre completo (como `get_technicians`) o a `name (username)` en el front.
29. **Búsqueda sin tildes en órdenes:** `search_orders` usa `ILIKE` ("Pérez" no coincide con "perez"). Opciones: reutilizar `search-sql.ts` (hay que ver su firma) o la extensión `unaccent` de Postgres. Con `pg_trgm` se resuelven rendimiento y tildes (ver 23).
30. **Réplica de órdenes:** confirmar el payload real de `ms.order.created` (`device.model.brand_name`, `type.name`) y qué `changed_scope` emite el origen al editar el dispositivo (se asumió `device_updated`).
35. **Mensajes de validación en inglés:** `ParseUUIDPipe` y `ParseIntPipe` responden en inglés ("Validation failed (uuid is expected)"), contra la convención. Pasar `exceptionFactory` con mensaje en español (p. ej. `new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('El vale no es válido') })`).

## 13. Guía rápida para un agente

- Antes de tocar ingresos: leer `receipt.entity.ts`, `receipt-line.entity.ts`, `receipts.service.ts` y `stock.service.ts`.
- Antes de tocar vales: leer `stock-vouchers.service.ts` (`create`/`createOut`/`createIn`/`list`/`returnState`), `stock.service.ts` (`registerOutbound`/`registerReturn`) y `stock-voucher.enums.ts`.
- Antes de tocar la réplica de órdenes: leer `order-replica.entity.ts`, `order-replica.mapper.ts` y `orders-relay.service.ts` (`UPSERT_COLUMNS`, `applyUpdate`, `search`).
- Toda escritura de inventario pasa por `StockService`. Toda escritura multi-tabla va en una transacción con `audit.log`.
- Mantener el **orden de claves** del objeto normalizado en `normalizeInput` (alimenta el hash de idempotencia); añadir campos nuevos al final. Los archivos no entran al hash.
- Cualquier endpoint nuevo: DTO en gateway → service gateway (`send`, comando `snake_case`) → handler MS con `@MessagePattern({ cmd })` **idéntico** → service MS con validación propia → contrato documentado para el front.
- Endpoint con archivos: gateway `parseMultipartRequest` + `parseJsonField` + helper de archivos del módulo (por `fieldname`) → `files` en base64 al MS → el MS revalida, sube a S3 **antes** de la transacción, inserta adjuntos dentro y limpia en `catch`/`replay`.
- Selects de modal (sin paginación): arreglo plano, límite fijo en el MS, un módulo por carpeta en el gateway.
- Si el front necesita saber si una acción procede, el servidor devuelve el booleano calculado (con su motivo de bloqueo) desde una función única; el front no replica reglas.
- Al unir `orders_replica` (company_id `varchar`) con tablas propias (company_id `uuid`) por columnas: `::text`.
- No usar FK hacia órdenes ni usuarios (réplicas que se pueden vaciar): guardar el id y un snapshot si hace falta mostrarlo.
- Una columna nueva en una réplica: entidad + mapper + `UPSERT_COLUMNS` + (si aplica) `applyUpdate`, y luego vaciar la tabla y reiniciar el MS.
- Una entidad nueva: `forFeature` en su módulo (en producción, además, migración con `CHECK` e índices).
- Un valor nuevo en un enum de Postgres: `ALTER TYPE ... ADD VALUE` en producción.
- Lo que consume lotes copia el snapshot del lote en su línea; los retornos copian el snapshot de la línea de origen.
- Mensajes de error en español, claros, con el número de línea cuando aplique ("Línea 2: …").
- Al terminar un cambio, actualizar este documento (secciones 1, 3–8, 10–12).