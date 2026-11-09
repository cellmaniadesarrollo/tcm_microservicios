# AGENTS.md — ms inventory-core (raíz)

Inventario, ingresos y movimientos de stock. Idioma del producto: español
(mensajes de error y etiquetas en español).

Este archivo tiene lo transversal y el índice. Lo específico de cada módulo está
en `src/<módulo>/AGENTS.md`. El gateway es un repo aparte y no tiene AGENTS.md:
sus convenciones están en la sección 5 y el contrato de cada endpoint, en el
módulo dueño.

## 0. Cómo mantener este archivo (leer primero)

Este proyecto se documentó sobre la marcha, así que **estos archivos están
incompletos**. Que algo no aparezca aquí NO significa que no exista en el
código. Fuente de verdad: el código real; este archivo es su mapa.

Estructura: este AGENTS.md (raíz del MS) tiene lo transversal y el índice.
Cada `src/<módulo>/AGENTS.md` tiene lo específico del módulo. Cada archivo de
módulo empieza con 3 líneas que apuntan a esta sección; las reglas no se
duplican.

### Reglas

1. **Solo se corrige lo verificado.** Se cambia una línea únicamente si en este
   hilo se vio: el código real (archivo pegado o leído), un error/log real, o el
   contrato del gateway entregado por el usuario. Lo que no se vio, no se toca ni
   se da por correcto o incorrecto.
2. **Lo no verificado se conserva tal cual.** No borrar, reescribir ni "mejorar"
   líneas sobre archivos que no se vieron. Ante la duda, dejar el texto original.
3. **No inventar.** Prohibido suponer nombres de archivos, métodos, comandos,
   columnas, valores de enums, límites o versiones. Si falta un dato, se pide el
   archivo o se anota como "(asumido)" o "(sin confirmar)" en los pendientes del
   módulo.
4. **El código manda sobre el texto.** Si el código visto contradice el archivo,
   se corrige el archivo y se avisa de la diferencia. Si lo que contradice es una
   decisión del usuario, se pregunta antes.
5. **Gateway y MS se verifican por separado.** El gateway es un repo aparte. Si un
   cambio toca el nombre de un comando, un payload o una respuesta, hay que ver
   ambos lados (`send('<cmd>')` ↔ `@MessagePattern({ cmd })`). Lo que solo se vio
   de un lado se anota con "(lado gateway sin ver)" o "(lado MS sin ver)".
6. **Marcadores de estado** (se conservan hasta que se demuestre lo contrario):
   - `[ENTREGADO, SIN PROBAR]`: escrito y revisado, no ejecutado contra BD ni
     type-check completo.
   - `(verificar)`: deducción hecha sin ver el archivo real.
   - `(asumido)` / `(sin confirmar)`: dato supuesto.
   Un marcador se quita solo si en el hilo se vio el código aplicado o la prueba
   ejecutada. **Excepción:** cuando el usuario pide actualizar los AGENTS.md, eso se
   toma como confirmación de que lo entregado en ese hilo quedó probado: no se
   escribe `[ENTREGADO, SIN PROBAR]` y se quitan los `(verificar)` que una prueba
   exitosa habría descubierto (imports, compilación, registro de módulos). Siguen
   `(asumido)` y `(sin confirmar)` para datos externos o reglas que la prueba no
   demuestra. Si el usuario avisa que algo no se probó, ese punto conserva su marcador.
7. **Pendientes.** Se quita uno solo si el código visto demuestra que está
   resuelto. Los nuevos se agregan al módulo dueño, sin duplicar. Los pendientes
   que cruzan módulos viven en el módulo dueño del problema y los demás lo
   enlazan. Los números existentes (26, 27, 31…) se conservan para no romper
   referencias; los nuevos continúan la numeración de su módulo.
8. **Errores y lecciones.** Al ver código que antes faltaba, se quita de la lista.
   Al tocar algo que no se pudo ver, se agrega.
9. **Dónde se anota un cambio.** Un cambio en un módulo se anota en el AGENTS.md
   de ese módulo. Si cambia una convención, un contrato entre módulos o la
   infraestructura, se anota en la raíz.
10. **Formato de entrega.**
    - Cambio pequeño: entregar solo los bloques modificados, con archivo y
      sección.
    - Archivo completo solo si el usuario lo pide, en partes cortas.
    - Cerrar con: "Verificado con: …" y "No verificado, sin cambios: …".
11. **La documentación se entrega bajo demanda.** Al terminar una tarea de código
    NO se proponen ni se entregan cambios a los AGENTS.md. El agente lleva en el
    hilo una lista interna de lo que quedó sin documentar. Cuando el usuario pida
    "actualiza agents" (o algo equivalente, por módulo o completo), entrega los
    bloques consolidados desde la última actualización, aplicando las reglas 1 a 10.
    Si el usuario pregunta "qué falta documentar", responde con esa lista.
    Un módulo documentado así queda con estado "Probado" y fecha; no se vuelve a
    marcar `SIN PROBAR` salvo que el usuario lo diga.

### Entorno
El proyecto está **en pruebas, no en producción**. `synchronize` crea/ajusta
tablas fuera de producción, así que por ahora **no se escriben migraciones**.
Las notas sobre `ALTER TYPE`/migraciones se conservan para el primer despliegue
real (ver pendiente 24).

### Aviso sobre snippets del historial
Los snippets se entregaron por partes (chat). Los comentarios `/* igual */` o
`// ...` que aparecieron en respuestas eran abreviaciones, **nunca** código
válido (ya causaron un bug: validación de UUID vacía en `list`). Antes de asumir
que algo existe, verificar en el código real.

## 1. Arquitectura

```
Front ──HTTP──> gateway (Nest + Fastify) ──RabbitMQ──> ms inventory-core (Nest microservice, TypeORM + Postgres)
                                                          ▲            ▲
                                       Kafka (tiempo real)┘            └ RabbitMQ (bulk / reconciliación)
                                       réplicas: órdenes, usuarios, empresas, dispositivos
```

- **Gateway** (repo aparte): valida con class-validator (DTOs) y envía con
  `this.inventoryClient.send('<cmd>', payload)` (comando como **string**). El MS
  lo recibe como `@MessagePattern({ cmd: '<cmd>' })`.
- **Microservicio:** `src/<módulo>/`, handlers con `@MessagePattern({ cmd })`.
- **Contexto de usuario:** el gateway arma `ctx(user)` =
  `{ userId: user.sub, companyId: user.companyId, branchId: user.branchId }`.
  Payload al MS: `{ dto|query, user, files?, file?, ...ids }`. El MS valida
  `data.user.companyId` / `data.user.userId`.
- **`user.branchId`:** el MS lo ignora, con **una excepción en transición**:
  `search_stock_voucher_lots` lo usa. Todo lo demás sale de `MainBranchService`
  (ver `stock-vouchers/` pendiente 26).
- **El MS revalida todo** (llega por RPC; no se confía en el gateway ni en el
  front). Incluye tipo, tamaño y cantidad de archivos.
- **Multi-empresa:** toda consulta filtra por `companyId`.
- **Sin FK hacia réplicas "vivas":** órdenes y usuarios son réplicas que pueden
  vaciarse o reconciliarse; las tablas de negocio guardan el id **sin FK** (y, si
  hace falta, un snapshot como `order_number`). Las FK sí existen hacia
  entidades propias (lotes, productos, vales) y hacia `CompanyReplica`.
- **Sucursal:** ingresos y salidas de vales usan la sucursal principal, resuelta
  por `MainBranchService.getMainBranchId(companyId, em?)` (solución temporal:
  sucursal activa cuyo nombre empieza con "Matriz"). Un retorno usa la del vale
  original.
- **Zona horaria de negocio:** `America/Guayaquil` (fechas por defecto,
  validación de "no futura" y filtros `from/to` del listado de vales).
- **Errores:** en el MS siempre `RpcException(new XxxException(msg))`. Los
  controllers del MS envuelven con `try/catch` (o helper `run(name, fn)`):
  `RpcException` se relanza, `HttpException` se envuelve, lo demás es 500
  genérico con log.
- **Nombres de comandos:** verbo en `snake_case` (`get_receipt_detail`,
  `create_receipt`, `list_receipts`, `create_stock_voucher`, `search_orders`,
  `get_employees_basic`). **No** usar `modulo.accion` (`stock_vouchers.create`):
  ya causó un desajuste.

## 2. Mapa del MS e índice

```
src/
  app.module.ts                raíz (ver 3.1)
  audit-log/                   AuditLogService, entity, enum AuditAction
  aws-s3/                      AwsS3Service                          → aws-s3/AGENTS.md
  catalogs/                    seeds (países, tipos de documento, motivos) → catalogs/AGENTS.md
  common/                      enums, helpers (normalize-name, search-sql), sequences → common/AGENTS.md
  companies/                   CompanyReplica, BranchReplica, MainBranchService → companies/AGENTS.md
  devices-replica/             marcas, modelos, códigos técnicos      → devices-replica/AGENTS.md
  health/
  interceptors/                internal-auth.interceptor.ts
  kafka/                       KafkaConsumerService, producer, orquestador de listeners
  labels/                      impresión de etiquetas de lote (Dymo/Zebra) → labels/AGENTS.md
  orders-relay/                réplica REDUCIDA de órdenes + buscador → orders-relay/AGENTS.md
  product-catalogs/            tipos, nombres, colores, calidades, usos (seeds json)
  products/                    productos (SKU), modelos, imágenes, usos → products/AGENTS.md
  receipts/                    ingresos                                → receipts/AGENTS.md
  sri/                         consulta SRI por clave de acceso        → sri/AGENTS.md
  stock/                       StockService, lotes, saldos, unidades, kardex → stock/AGENTS.md
  stock-vouchers/              salidas y retornos manuales, fotos por línea → stock-vouchers/AGENTS.md
  suppliers/
  users-employees-events/      réplica de usuarios + selects de empleados → users-employees-events/AGENTS.md
```

**Qué leer antes de tocar cada área:** ver la sección 6 (checklist) y el
AGENTS.md del módulo.
## 3. Infraestructura y arranque

### 3.1 `app.module.ts`
- `ConfigModule.forRoot({ isGlobal: true })`.
- `TypeOrmModule.forRootAsync`: Postgres con `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`,
  `autoLoadEntities: true` y **`synchronize: NODE_ENV !== 'production'`**. En
  producción **no hay synchronize**: hará falta migración/SQL manual.
- Hay que importar `StockVouchersModule`. **(verificar)** En el `app.module.ts`
  compartido, `StockModule` aparece importado **dos veces** (duplicado → error
  de TypeScript); dejar solo uno.
- `autoLoadEntities` solo carga entidades que estén en algún
  `TypeOrmModule.forFeature(...)`.

### 3.2 Brokers
- **Kafka = tiempo real** (réplicas por evento).
  `KafkaConsumerService.registerHandler(topic, (eventType, data) => ...)`. Cada
  módulo con réplica expone un `*EventsListener.registerHandlers()` que debe
  llamarse desde `kafka/kafka-listeners.orchestrator.ts` **(verificar que
  `OrdersEventsListener` esté registrado ahí)**.
- **RabbitMQ = bulk, reconciliación inicial y manual.** Un `ClientProxy` por
  origen: `ORDERS_ASYNC` (queue `orders_queue_sync`), `USER_ASYNC` (queue
  `users_queue_sync`). Los comandos de sync llevan
  `internalToken: process.env.INTERNAL_SECRET`.
- **Sync inicial:** los controllers de réplica hacen el sync en `onModuleInit`
  (catálogos primero, luego datos).

### 3.3 Seeds al arrancar
Ver `catalogs/AGENTS.md`.

### 3.4 Servicios HTTP salientes
- **Impresión de etiquetas:** servidores de impresión externos (Dymo por POST, Zebra por GET con
  token). Variables: `LABEL_DYMO_URL`, `LABEL_ZEBRA_URL`, `LABEL_ZEBRA_KEY`,
  `LABEL_PRINT_TIMEOUT_MS`. Sin `axios`: se usa `fetch` nativo con `AbortController`.
  Ver `labels/AGENTS.md`.

## 4. Convenciones de código del MS

- **Dinero:** columnas `numeric`, en TypeORM viajan como **string**. Los
  cálculos se hacen en **enteros** (centavos; costo en 1/10 000) con helpers
  `toCents`, `fromCents`, `SCALE = 10_000` (`MONEY_SCALE` en vales). El front
  nunca calcula con ellos, solo muestra.
- **Totales los calcula el servidor**; el front solo los muestra.
- **Reglas de negocio en el servidor, no en el front:** si el front necesita
  saber si una acción procede (p. ej. botón de retorno), el servidor devuelve el
  booleano ya calculado (`canReturn` + `returnBlock`) con una **función única**
  compartida por listado y detalle (`returnState`).
- **Descuento** = monto TOTAL de la línea (no por unidad). **Costo del lote** =
  costo neto por unidad `(cantidad × costo − descuento) / cantidad`, 4
  decimales, sin impuesto.
- **Idempotencia:** `clientRequestId` (UUID generado por el front al abrir el
  formulario) en ingresos, pagos sueltos y vales de stock. Mismo id + mismo
  contenido (hash SHA-256 del objeto normalizado sin el id) → `replayed: true`;
  mismo id + datos distintos → 409. Advisory lock por `(empresa, id)` e índice
  único como red final. Reglas front: generar una vez, reusar en reintentos,
  regenerar solo tras éxito, deshabilitar botón.
- **Hash de idempotencia:** el **orden de claves** del objeto que devuelve
  `normalizeInput` importa. Agregar campos nuevos **al final**. **Los archivos
  no entran al hash**: en un `replayed` los archivos del reintento se descartan
  (se borran de S3).
- **Correlativos:** `SequencesService.reserve(em, companyId, key, count)`
  (UPSERT atómico; claves `receipt_code`, `stock_voucher_code`). Uso:
  `const code = await this.sequences.reserve(em, companyId, key)`. Lotes y
  productos usan `MAX(code)+1` con `pg_advisory_xact_lock` (patrón en
  `StockService` y `ProductsService`).
- **Auditoría:** `AuditLogService.log(em, { companyId, entity, entityId, action, userId, before?, after?, changes? })`
  dentro de la transacción. `entity` se pasa como la **clase** (`entity: Receipt`,
  `entity: StockVoucher`). `AuditAction`: `CREATED, UPDATED, SOFT_DELETED,
  RESTORED, DELETED` (no existe `VOIDED`; verificar/anular se registran como
  `UPDATED` con `status from/to`). Historial:
  `audit.history(companyId, Entity, id, page, limit)`.
- **Búsqueda por palabras:** `common/helpers/search-sql.ts` (`norm`,
  `stripAccents`, `escapeLike`, `toTokens`). Cada palabra debe coincidir (AND)
  en algún campo (OR), sin tildes ni mayúsculas, orden libre. Un entero puede
  coincidir con un `code` exacto.
- **Buscadores para selects** (empleados, órdenes, lotes): arreglo plano, sin
  paginación, sin `{ items, meta }`.
- **Listados:** `page/limit/sortBy/sortDir`, respuesta
  `{ items, meta: { total, page, limit, totalPages } }`. Opcional
  `includeFilters=true` agrega `filters` (valor + etiqueta) solo en la primera
  carga. Con orden por expresión calculada se usa `offset/limit` (no
  `skip/take`).
- **Tipado de `Map`:** `new Map(arr.map(x => [k, v] as [string, T]))`. En
  `Promise.all` con ternarios tipar `Promise.resolve([] as T[])`.
- **Uniones réplica ↔ tablas propias:** `orders_replica.company_id` es
  `varchar(64)` y `stock_vouchers.company_id` es `uuid`. Al unir **columna con
  columna** hay que castear: `o.company_id = v.company_id::text`. Contra un
  parámetro no hace falta; por eso solo falla con joins.
- **Transacciones y S3:** subir a S3 **antes** de la transacción (no retener
  locks), insertar los adjuntos **dentro**, y limpiar con `deleteObject` en el
  `catch` y en el `replay` (no dejar huérfanos). Si una subida falla, borrar las
  que sí subieron y lanzar 500.
- **Entidades con snake_case:** `OrderReplica` (`company_id`, `status_id`,
  `status_name`, `order_number`, `customer_name`, `device_*`, `order_type_*`) y
  `UserEmployeeCache` (`first_name`, `last_name`) usan propiedades en
  snake_case; el resto usa camelCase con `name:` de columna.
- **Registrar entidades:** toda entidad nueva debe estar en `forFeature` del
  módulo (error real: "no existe la relación company_sequences"). `synchronize`
  no aplica bien cambios de nulabilidad ni `CHECK` en tablas con datos, y
  **solo corre fuera de producción**.
- **Enums de Postgres (para producción):** agregar un valor requiere
  `ALTER TYPE ... ADD VALUE` (fuera de bloque transaccional; el valor nuevo no
  se puede usar en esa misma transacción). Verificar el nombre real del tipo
  con `\dT` (por defecto `<tabla>_<columna>_enum`).
- **Snapshots:** un documento que consume lotes (vale) copia costo, precio y
  banderas del lote en **su** línea. Lo costeado/cobrado no cambia si el lote se
  "regulariza" después.
- **Bloqueos de stock:** `SELECT ... FOR UPDATE`
  (`setLock('pessimistic_write')`) sobre saldos y unidades **ordenado por id**
  (`lot_id`, `u.id`) para evitar deadlocks. Validar disponibilidad en el
  servicio **antes** de que salten los `CHECK` de la BD (mensaje en español).
- **Controllers del MS de vales:** helper `run(name, fn)` + `ctx(data)` (valida
  `data.user.companyId/userId`) + `uuid(value, label)` para ids de ruta. El
  controller de ingresos usa `run` solo en parte de los handlers (el resto trae
  su propio try/catch; mismo efecto).
- **Mensajes de error:** en español, claros, con el número de línea cuando
  aplique ("Línea 2: …").
- **Efectos externos tras el commit:** lo que llama a servicios de red (impresión, etc.) va
  después de la transacción y **fuera del `try` cuyo `catch` limpia S3**, capturando sus
  propios errores. Un fallo externo no deshace un documento ya guardado. Ejemplo:
  `ReceiptsService.printAfterCreate`.

## 5. Convenciones del gateway (repo aparte, sin AGENTS.md)

El contrato de cada endpoint vive en el módulo dueño, bajo "Gateway (repo
aparte)". Aquí solo lo general.

### 5.1 Estructura
- Ubicación: `gateway/src/inventory-core/<módulo>/` con `*.controller.ts`,
  `*.service.ts`, `dto/`, `helpers/`.
- Decoradores: `@Auth()` y `@User()` (`../../common/auth/decorators/`).
- Cliente: `InventoryCoreServiceClient`
  (`../../common/microservices/inventory-core-service-client`), inyectado como
  `inventoryClient`.
- Los módulos auxiliares (`employees/`, `orders/`) no tienen módulo propio:
  controller y service se declaran en el módulo del gateway que agrupa
  `inventory-core`. **(verificar)** Todo controller/service nuevo debe
  registrarse ahí (y en RouterModule si aplica).

### 5.2 DTOs y services
- **DTOs (estilo):** `@Type(() => Number)` para números;
  `@IsUUID('4', { message })`; mensajes en español; opcionales con
  `@IsOptional()`; condicionales con `@ValidateIf`. Endpoints JSON:
  `@Body() dto` con el pipe global.
- **Bodies multipart:** `parseJsonField(Dto, formData.data)`.
- **Service del gateway:** una línea por método:
  `return this.inventoryClient.send('<cmd>', { ...ids, dto|query, files?, user })`.
  La firma del service debe coincidir con la llamada del controller (error
  real, ver sección 8).
- **Orden de rutas Nest:** declarar `@Get(':id')` después de rutas literales
  (`new-data`, `products/search`, `suppliers/search`, `lots/:lotId/units`,
  `orders/:orderId`).

### 5.3 Archivos (helpers en `gateway/src/common/helpers/`)
- `multipart-request.helper.ts`: `parseMultipartRequest(request)` →
  `{ files: ParsedFile[], formData }` (guarda `fieldname`; ignora archivos de 0
  bytes). `processAndValidateFiles`, `serializeFilesForMicroservice` (buffer →
  base64) y `parseAndProcessMultipart` existen, pero los controllers de
  ingresos/vales usan `parseMultipartRequest` + su helper propio.
  `DEFAULT_MAX_FILE_SIZE = 80 MB`.
  - **Deuda:** `ParsedFile` está declarada dos veces (se fusionan, sobra una) y
    hay muchos `console.log('[DEBUG] …')` que imprimen `formData` completo;
    quitarlos antes de producción (pendiente 25).
- `process-file.helper.ts` (`processFileForUpload`): si es imagen → `sharp`
  `.rotate()` + resize máx. 1920 px sin ampliar + **WebP calidad 80**; el
  nombre cambia a `.webp`. No imagen → pasa igual. Si falla → 400.
- `process-pdf.helper.ts` (`processPdfForUpload`): Ghostscript opcional
  (requiere `gs` en la imagen del gateway).
- `parse-json-field.helper.ts`: `parseJsonField(DtoClass, raw)` parsea y valida
  el campo `data` de un multipart (`whitelist` + `forbidNonWhitelisted`, máx. 10
  errores aplanados con `flattenValidationErrors`). Estándar para todo
  multipart nuevo (vales ya lo usa). Ingresos aún trae copias locales
  (`flatten`, `buildReceiptDto`, `buildDto`) que deben migrarse. **Ojo:** con
  `forbidNonWhitelisted`, todo campo que el DTO no declare responde 400 (ver
  `stock-vouchers/` pendiente 31).
- Helpers por módulo que separan y validan archivos por `fieldname`: ver
  `receipts/AGENTS.md` y `stock-vouchers/AGENTS.md`.
- **Límite de tamaño:** los archivos viajan en base64 por RabbitMQ; por eso
  cada módulo fija un total máximo (25 MB en ingresos y vales).

## 6. Checklist y guía rápida para un agente

**Antes de tocar un área, leer:**
- Ingresos: `receipt.entity.ts`, `receipt-line.entity.ts`,
  `receipts.service.ts` y `stock.service.ts`.
- Vales: `stock-vouchers.service.ts` (`create`/`createOut`/`createIn`/`list`/
  `returnState`), `stock.service.ts` (`registerOutbound`/`registerReturn`) y
  `stock-voucher.enums.ts`.
- Réplica de órdenes: `order-replica.entity.ts`, `order-replica.mapper.ts` y
  `orders-relay.service.ts` (`UPSERT_COLUMNS`, `applyUpdate`, `search`).

**Reglas de trabajo:**
- Toda escritura de inventario pasa por `StockService`. Toda escritura
  multi-tabla va en una transacción con `audit.log`.
- Mantener el **orden de claves** del objeto normalizado en `normalizeInput`
  (alimenta el hash de idempotencia); campos nuevos al final. Los archivos no
  entran al hash.
- **Endpoint nuevo:** DTO en gateway → service gateway (`send`, comando
  `snake_case`) → handler MS con `@MessagePattern({ cmd })` **idéntico** →
  service MS con validación propia → contrato documentado en el AGENTS.md del
  módulo dueño.
- **Endpoint con archivos:** gateway `parseMultipartRequest` + `parseJsonField`
  + helper de archivos del módulo (por `fieldname`) → `files` en base64 al MS →
  el MS revalida, sube a S3 **antes** de la transacción, inserta adjuntos dentro
  y limpia en `catch`/`replay`.
- **Selects de modal** (sin paginación): arreglo plano, límite fijo en el MS,
  un módulo por carpeta en el gateway.
- Si el front necesita saber si una acción procede, el servidor devuelve el
  booleano calculado (con su motivo de bloqueo) desde una función única.
- Al unir `orders_replica` (company_id `varchar`) con tablas propias
  (company_id `uuid`) por columnas: `::text`.
- No usar FK hacia órdenes ni usuarios: guardar el id y un snapshot si hace
  falta mostrarlo.
- **Columna nueva en una réplica:** entidad + mapper + `UPSERT_COLUMNS` +
  (si aplica) `applyUpdate`; luego vaciar la tabla y reiniciar el MS.
- **Entidad nueva:** `forFeature` en su módulo (en producción, además,
  migración con `CHECK` e índices).
- **Valor nuevo en un enum de Postgres:** `ALTER TYPE ... ADD VALUE` en
  producción.
- Lo que consume lotes copia el snapshot del lote en su línea; los retornos
  copian el snapshot de la línea de origen.
- La documentación se actualiza bajo demanda (ver regla 11 de la sección 0).

## 7. Pendientes transversales

Los pendientes de cada módulo viven en su AGENTS.md. Numeración conservada.

22. **Roles/permisos:** quién registra o anula pagos, verifica o anula
    ingresos, **registra salidas/retornos de stock** (hoy cualquier usuario
    autenticado puede devolver cualquier salida). Hoy `@Auth()` solo exige
    sesión.
23. **Rendimiento:** índices `pg_trgm` en búsquedas `LIKE '%x%'` si crecen los
    datos; barrer archivos huérfanos de S3 (`receipts/{companyId}/...` y
    `stock-vouchers/{companyId}/...` vs tablas).
24. **Antes del primer despliegue a producción:** generar migraciones reales
    (tablas de vales y adjuntos, `orders_replica` con sus columnas de tipo y
    dispositivo, índices, `CHECK`, `ALTER TYPE` de enums); `synchronize` está
    apagado en producción.
25. **Limpieza del gateway:** quitar `[DEBUG]` de `multipart-request.helper.ts`,
    eliminar la interfaz `ParsedFile` duplicada y migrar `receipts.controller.ts`
    a `parseJsonField`.
35. **Mensajes de validación en inglés:** `ParseUUIDPipe` y `ParseIntPipe`
    responden en inglés ("Validation failed (uuid is expected)"), contra la
    convención. Pasar `exceptionFactory` con mensaje en español (p. ej.
    `new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('El vale no es válido') })`).

### Pendientes repartidos (dónde buscarlos)
| Números | Módulo |
|---|---|
| 1–6 | `receipts/` |
| 7–14, 18–20, 26, 27, 31–34 | `stock-vouchers/` |
| 15–17 | `stock/` |
| 11, 30 | `orders-relay/` |
| 21 | `receipts/` (resolver nombres con `user_employee_cache`) |
| 28 | `users-employees-events/` |
| 29 | `orders-relay/` (búsqueda sin tildes) |
| L1–L11 | `labels/` |
## 8. Errores y lecciones transversales

Los específicos de un módulo van en su AGENTS.md.

- Entidades nuevas sin registrar → "relación no existe".
- `StockModule` importado dos veces en `app.module.ts` → identificador
  duplicado.
- **Nombres de comando desalineados** gateway ↔ MS: el mensaje nunca llega al
  handler. Comprobar siempre ambos lados (el gateway usa string; el MS,
  `{ cmd }`).
- **Firma del service del gateway desalineada** (`create(dto, files, user)`) →
  error TS "esperaban 2 argumentos, se obtuvieron 3".
- `for (...) { /* igual */ }` dejó filtros UUID sin validar (ver aviso en la
  sección 0).
- `Map` con tuplas sin cast → error TS de sobrecarga.
- No loguear base64 completo; imprimir solo resumen (nombre, tamaño, índice).
  `multipart-request.helper.ts` aún imprime `formData` completo.
- Si se cambian enums de BD (`status` del ingreso, `UnitStatus`,
  `MovementType`), limpiar el tipo anterior o migrar (`ALTER TYPE ... ADD VALUE`
  en producción).
- `reference_id` del kardex es **uuid**: no sirve para ids enteros (órdenes).
  Referenciar el documento propio (vale) y guardar la orden en él.
- Postgres: `INSERT ... ON CONFLICT DO UPDATE` con el mismo id dos veces en el
  mismo statement falla → deduplicar antes.
- Postgres limita a 65 535 parámetros por query → insertar por lotes
  (500–1000 filas).
- Validar stock en el servicio antes de que salten los `CHECK` de saldo
  (mensaje en español con número de línea y lote).
- `getPresignedUrl` devuelve la key cruda si falla la firma: no confiar en que
  el valor sea siempre una URL.
- Cambiar la firma de un método del MS obliga a buscar todos sus llamadores
  (ej. `searchLots(companyId, productId)` → `(companyId, productId, branchId)`).
- Al renombrar una constante exportada del gateway
  (`MAX_VOUCHER_PHOTOS` → `MAX_PHOTOS_PER_LINE`), buscar quién más la importaba.
- `QueryFailedError: character varying = uuid` al unir réplica con tabla
  propia: ver cast `::text` en la sección 4.
- (MS orders, Mongo, no este repo) en `OrdersRelayService.applyUpdate` el
  `default:` está **antes** de `priority_changed` y sin `break`: un scope
  desconocido cae en `priority_changed` y falla con `payload.priority.id`. Mover
  el `default:` al final.
- Código que puede lanzar dentro del `try` de `ReceiptsService.create()` activa `cleanupAll()` y
  borra adjuntos de S3 de un ingreso ya confirmado. Todo lo posterior al commit debe capturar
  sus errores (impresión: `printAfterCreate`).
- Un campo nuevo en el JSON `data` de un multipart debe declararse en el DTO del gateway:
  `parseJsonField` usa `forbidNonWhitelisted` y respondería 400.

## 9. Estado de implementación (resumen)

El detalle por componente está en el AGENTS.md de cada módulo, bajo "Estado".

| Componente                                                                     | Estado                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Ingresos, pagos, SRI, productos, proveedores                                   | Construido y en uso (según el historial previo)        |
| `orders-relay`, buscador de órdenes, selector de empleados                     | **ENTREGADO, SIN PROBAR**                              |
| `stock-vouchers` (MS + gateway), fotos por línea, listado enriquecido, retorno | **ENTREGADO, SIN PROBAR**                              |
| `StockService` (`registerOutbound`, `registerReturn`, `listAvailableUnits`)    | **ENTREGADO como parche**; **(verificar)** que se pegó |
| Migraciones                                                                    | **No aplican por ahora** (pruebas con `synchronize`)   |
| `labels` (MS + gateway): imprimir por lote y desde la lista de ingresos        | **Probado**                                            |
| Etiquetas al registrar un ingreso (`labels` en `create_receipt`)               | **Probado**                                            |

**Primera prueba recomendada:** ver `stock-vouchers/AGENTS.md`, sección
"Estado".