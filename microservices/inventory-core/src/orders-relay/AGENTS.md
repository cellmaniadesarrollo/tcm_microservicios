# AGENTS.md — orders-relay (réplica reducida de órdenes + buscador)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**
> (`microservices/inventory-core/AGENTS.md`). No se duplican aquí.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual; los
> marcadores `[ENTREGADO, SIN PROBAR]` y `(verificar)` se quitan solo con
> código visto o prueba ejecutada.

Origen: ms **orders** (Mongo, réplica completa allí). Aquí solo se guarda lo
necesario para validar, mostrar y buscar órdenes en los vales.
**[ENTREGADO, SIN PROBAR]**

## 1. Archivos clave

- `orders-relay.service.ts`: upsert protegido por fecha, bulk, `applyUpdate`,
  `search`, `syncOrder`, `syncOrdersBulk`.
- `orders-relay.controller.ts`: sync inicial por RMQ y comando `search_orders`
  (exige `user.companyId`).
- `orders-events.listener.ts`: Kafka (`OrdersEventsListener.registerHandlers()`).
- `entities/order-replica.entity.ts`.
- `mappers/order-replica.mapper.ts`: `toOrderReplica`, `toDeviceColumns`.

## 2. Modelo: tabla `orders_replica` (entidad `OrderReplica`, una sola tabla)

- `id` (PK `int`, **el id del origen**, no autogenerado), `order_number`,
  `company_id` (**varchar 64**, NOT NULL; ojo: no es uuid), `status_id`,
  `status_name`, `customer_id`, `customer_name` (nombre + apellido),
  `source_created_at`, `source_updated_at` (fechas **del origen**,
  timestamptz).
- Índices por `order_number`, `company_id`, `(company_id, status_id)`,
  `status_id`, `customer_id`, `source_updated_at`.
- **Tipo de orden** (nulables): `order_type_id`, `order_type_name`.
- **Dispositivo** (nulables; una orden tiene **un** dispositivo): `device_id`,
  `device_brand` (`device.model.brand_name`), `device_model`
  (`device.model.models_name`), `device_type` (`device.type.name`),
  `device_serial`, `device_imeis` (todos los IMEI unidos por espacio, solo para
  búsqueda).
- **No se replica** a propósito: `accounts` (trae contraseñas), `patron`,
  `password`, notas, pagos, hallazgos, técnicos, adjuntos.
- Propiedades en **snake_case** en la entidad (excepción a la convención).

## 3. Mapper (`mappers/order-replica.mapper.ts`)

- Único lugar que conoce el shape del evento: `data.id`, `order_number`,
  `company.id`, `currentStatus.{id,name}`, `customer.{id,firstName,lastName}`,
  `type.{id,name}`, `device`, `createdAt`, `updatedAt`.
- Exporta `toOrderReplica` y `toDeviceColumns` (esta última la reutiliza
  `applyUpdate('device_updated')`).
- Lanza `Error('Evento de orden incompleto')` si falta `id`, `company.id`,
  `currentStatus.id` o `customer.id` (columnas NOT NULL): en el bulk,
  `syncOrdersBulk` descarta solo esa orden y no tumba el lote.
- Los textos se recortan al largo de su columna. Campos nuevos del origen se
  ignoran.

## 4. Sincronización

- **Tiempo real (Kafka):** `ms.order.created` → `syncOrder` (upsert);
  `ms.order.updated` → `applyUpdate(orderId, scope, payload, updatedAt)`.
  **Solo** `status_changed`, `closed` (estado) y `device_updated`
  (dispositivo) actualizan; cualquier otro scope se ignora con log `debug` y
  **no** avanza `source_updated_at` (así el checkpoint nunca queda por encima
  de un cambio perdido).
- **Bulk (RabbitMQ):** comando `async_orders_start` con
  `{ internalToken, fromCache }` (cola `orders_queue_sync`, cliente
  `ORDERS_ASYNC`). `fromCache = MAX(source_updated_at)`; tabla vacía → `null` →
  el origen manda todo.
- **Upsert protegido por fecha:** `INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE existente IS NULL OR EXCLUDED IS NULL OR existente <= EXCLUDED`.
  Un evento atrasado no pisa uno más nuevo (Kafka y Rabbit escriben en
  paralelo). Requiere TypeORM ≥ 0.3.12 aprox. (`overwriteCondition`)
  **(verificar versión)**.
- **`UPSERT_COLUMNS`:** toda columna nueva debe agregarse ahí; si no, el
  `ON CONFLICT` no la actualiza y las órdenes ya replicadas quedan con ella
  vacía.
- **Bulk por lotes de 500** (17 columnas × 500 = 8 500 parámetros; límite PG
  65 535), con **dedupe por id** antes de insertar (Postgres falla con
  "ON CONFLICT DO UPDATE command cannot affect row a second time").
- **Reconciliación forzada = vaciar la tabla y reiniciar el MS.** También es lo
  que hay que hacer tras agregar columnas nuevas: `synchronize` las crea vacías
  y el bulk las llena. Mientras la tabla se repuebla, las salidas con orden
  aparecen en el listado de vales con `canReturn: false` y
  `returnBlock: 'ORDER_UNKNOWN'`.
- Un `status_changed` o `device_updated` que llega antes de que exista la
  orden no hace nada (0 filas afectadas); la reconciliación lo repara.
- **Qué se quitó respecto al MS orders:** normalizaciones (status/type),
  checksum por conteo y `OrderValidationService` (el registro de validación al
  pasar a ENTREGADA **no** se replica aquí).
- **Uso desde otros módulos:** `StockVouchersService` lee `OrderReplica` para
  validar y mostrar (incluido el listado de vales, con `LEFT JOIN`). Es una
  **lectura de réplica**: puede ir unos instantes por detrás del origen (ver
  pendiente 11 en `stock-vouchers/`).
- **Cast obligatorio** al unir con tablas propias por columnas:
  `o.company_id = v.company_id::text` (ver raíz sección 4).

Estados de orden y su efecto en inventario: ver `stock-vouchers/AGENTS.md`
sección 4.

## 5. Buscador de órdenes  [ENTREGADO, SIN PROBAR]

`OrdersRelayService.search(companyId, search?)`, comando `search_orders`.
Límite fijo **20**, orden `source_updated_at DESC NULLS LAST, id DESC`.
Usa `ILIKE` directo (sensible a tildes), no `search-sql.ts` (pendiente 29).

### Gateway (repo aparte)
Ubicación: `gateway/src/inventory-core/orders/` (`orders.controller.ts`,
`orders.service.ts`, `dto/search-orders-query.dto.ts`), sin módulo propio
(declarados en el módulo del gateway que agrupa `inventory-core`; **falta
registrarlos**).

`GET /inventory-orders/search?search=` → `search_orders` con
`{ search, user }`. Prefijo `inventory-orders` para no chocar con un posible
controller `orders` del gateway.

- `search`: único parámetro, opcional, máx. 100 caracteres.
- `#123` → número de orden **exacto**, sin filtro de estado; `#abc` → 400
  "Número de orden inválido. Use el formato #123.".
- Sin `#` → palabras (máx. 6) con AND; cada palabra coincide (OR) con cliente,
  marca o modelo y, si tiene ≥ 6 caracteres, también con serial o IMEI.
  `ILIKE` con `%`, `_` y `\` escapados. **Excluye estados 8, 9 y 10.**
- Vacío → las 20 más recientes admitidas.
- Respuesta (arreglo plano, sin paginación):

```json
[{ "id": 4521, "orderNumber": 123, "customerName": "Juan Pérez", "device": "Samsung Galaxy A54",
   "deviceType": "CELULAR", "orderType": "REPARACION",
   "status": { "id": 6, "name": "EN REPARACION" }, "canIssue": true }]
```

- Con `#123` una orden en 8/9/10 se devuelve con `canIssue: false` (el front
  la muestra deshabilitada).
- El front envía `id` como `orderId` del vale (y como filtro `orderId` del
  listado). Los retornos no usan este buscador (heredan la orden del vale
  original).
- Usar debounce ~300 ms. En el listado de vales **no** se usa `#`: se envía el
  número sin numeral.

## 6. Estado

| Componente | Estado |
|---|---|
| `orders-relay` (Postgres) con tipo de orden y dispositivo | **ENTREGADO, SIN PROBAR.** Falta: confirmar versión de TypeORM (`overwriteCondition`), que `registerHandlers()` se llame en el orquestador (`kafka/kafka-listeners.orchestrator.ts`), **vaciar `orders_replica` y reiniciar** para llenar las columnas nuevas, y comprobar que `ms.order.created` trae `device.model.brand_name` y `type.name` (se asumió del schema de Mongo). |
| Buscador (`search_orders`, gateway `inventory-orders/search`) | **ENTREGADO, SIN PROBAR.** Falta registrar controller y service en el módulo del gateway. |

## 7. Pendientes (numeración conservada)

11. **Carrera orden→ENTREGADA** (réplica por detrás del origen): ver
    `stock-vouchers/AGENTS.md`, pendiente 11.
29. **Búsqueda sin tildes en órdenes:** `search_orders` usa `ILIKE` ("Pérez" no
    coincide con "perez"). Opciones: reutilizar `search-sql.ts` (hay que ver su
    firma) o la extensión `unaccent` de Postgres. Con `pg_trgm` se resuelven
    rendimiento y tildes (raíz 23).
30. **Confirmar el payload real de `ms.order.created`**
    (`device.model.brand_name`, `type.name`) y qué `changed_scope` emite el
    origen al editar el dispositivo (se asumió `device_updated`).

## 8. Errores y lecciones propios del módulo

- Postgres: `INSERT ... ON CONFLICT DO UPDATE` con el mismo id dos veces en el
  mismo statement falla → deduplicar antes (bulk).
- Límite de 65 535 parámetros por query → lotes de 500.
- Al agregar columnas a la réplica: también a `UPSERT_COLUMNS` y vaciar la
  tabla para reconciliar; si no, el bulk no las llena.
- `character varying = uuid` al unir con tablas propias: castear `::text`.
- (MS orders, Mongo, **no este repo**) en `OrdersRelayService.applyUpdate` del
  MS orders el `default:` está **antes** de `priority_changed` y sin `break`: un
  scope desconocido cae en `priority_changed` y falla con `payload.priority.id`.
  Mover el `default:` al final.

## 9. Cómo actualizar este archivo
Al agregar una columna, scope o comando de la réplica: actualizar las
secciones 2–5 y, si cambia el listado de vales, `stock-vouchers/AGENTS.md`.
Reglas completas en la sección 0 de la raíz.