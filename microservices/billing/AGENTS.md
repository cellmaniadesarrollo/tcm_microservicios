# AGENTS.md — ms-billing (raíz)

Facturación. Idioma del producto: español (mensajes de error y etiquetas).

Este archivo tiene lo transversal y el índice. Lo específico de cada módulo
está en `src/<módulo>/AGENTS.md`. El gateway es un repo aparte y no tiene
AGENTS.md: su contrato se documenta en el módulo dueño de cada endpoint.

## 0. Cómo mantener este archivo (leer primero)

Estos archivos se documentaron sobre la marcha, así que **pueden estar
incompletos**. Que algo no aparezca aquí NO significa que no exista en el
código. Fuente de verdad: el código real; este archivo es su mapa.

Estructura: este AGENTS.md (raíz del MS) tiene lo transversal y el índice.
Cada `src/<módulo>/AGENTS.md` tiene lo específico del módulo. Cada archivo de
módulo empieza apuntando a esta sección; las reglas no se duplican.

### Reglas

1. **Solo se corrige lo verificado.** Se cambia una línea únicamente si en el
   hilo se vio: el código real (archivo pegado o leído), un error o log real,
   o el contrato del gateway entregado por el usuario. Lo que no se vio, no se
   toca ni se da por correcto o incorrecto.
2. **Lo no verificado se conserva tal cual.** No borrar, reescribir ni
   "mejorar" líneas sobre archivos que no se vieron. Ante la duda, dejar el
   texto original.
3. **No inventar.** Prohibido suponer nombres de archivos, métodos, comandos,
   columnas, valores de enums, límites o versiones. Si falta un dato, se pide
   el archivo o se anota como `(asumido)` o `(sin confirmar)` en los
   pendientes del módulo.
4. **El código manda sobre el texto.** Si el código visto contradice el
   archivo, se corrige el archivo y se avisa de la diferencia. Si lo que
   contradice es una decisión del usuario, se pregunta antes.
5. **Gateway, billing e inventory-core se verifican por separado.** Si un
   cambio toca el nombre de un comando, un payload, un topic o una respuesta,
   hay que ver ambos lados (`send({ cmd })` ↔ `@MessagePattern({ cmd })`;
   evento emitido ↔ listener). Lo que solo se vio de un lado se anota con
   "(lado X sin ver)".
6. **Marcadores de estado** (se conservan hasta que se demuestre lo contrario):
   - `[ENTREGADO, SIN PROBAR]`: escrito y revisado, no ejecutado.
   - `(verificar)`: deducción hecha sin ver el archivo real.
   - `(asumido)` / `(sin confirmar)`: dato supuesto.
   Un marcador se quita solo si en el hilo se vio el código aplicado o la
   prueba ejecutada. **Excepción:** cuando el usuario pide actualizar los
   AGENTS.md, eso se toma como confirmación de que lo entregado quedó probado:
   no se escribe `[ENTREGADO, SIN PROBAR]` y se quitan los `(verificar)` que
   una prueba exitosa habría descubierto (imports, compilación, registro de
   módulos). Siguen `(asumido)` y `(sin confirmar)` para datos externos o
   reglas que la prueba no demuestra. Si el usuario avisa que algo no se
   probó, ese punto conserva su marcador.
7. **Pendientes.** Se quita uno solo si el código visto demuestra que está
   resuelto. Los nuevos se agregan al módulo dueño, sin duplicar. Los que
   cruzan módulos viven en el módulo dueño del problema y los demás lo
   enlazan. Los números existentes se conservan para no romper referencias;
   los nuevos continúan la numeración de su módulo.
8. **Errores y lecciones.** Al ver código que antes faltaba, se quita de la
   lista de "no verificado". Al tocar algo que no se pudo ver, se agrega.
9. **Dónde se anota un cambio.** Un cambio en un módulo se anota en el
   AGENTS.md de ese módulo. Si cambia una convención, un contrato entre
   módulos o la infraestructura, se anota en esta raíz. Una regla general vive
   solo aquí, no se repite en los módulos.
10. **Formato de entrega.**
    - Cambio pequeño: entregar solo los bloques modificados, con archivo y
      sección.
    - Archivo completo solo si el usuario lo pide, en partes cortas.
    - Cerrar con: "Verificado con: …" y "No verificado, sin cambios: …".
11. **La documentación se entrega bajo demanda.** Al terminar una tarea de
    código NO se proponen ni se entregan cambios a los AGENTS.md. El agente
    lleva en el hilo una lista interna de lo que quedó sin documentar. Cuando
    el usuario pida "actualiza agents" (o algo equivalente, por módulo o
    completo), entrega los bloques consolidados desde la última actualización,
    aplicando las reglas 1 a 10. Si el usuario pregunta "qué falta
    documentar", responde con esa lista. Un módulo documentado así queda con
    estado "Probado" y fecha; no se vuelve a marcar `SIN PROBAR` salvo que el
    usuario lo diga.

### Entorno
El proyecto está **en pruebas, no en producción**. `synchronize` crea y ajusta
tablas fuera de producción, así que por ahora **no se escriben migraciones**
(ver pendiente B6).

### Aviso sobre snippets del historial
Los snippets se entregan por partes (chat). Los comentarios `/* igual */` o
`// ...` en respuestas son abreviaciones, **nunca** código válido. Antes de
asumir que algo existe, verificar en el código real.

## 1. Arquitectura

```
Front ──HTTP──> gateway ──RabbitMQ──> ms-billing (Nest + Fastify, TypeORM + Postgres)
                                          ▲                 │
                  Kafka (réplicas, tiempo real)             │ RabbitMQ (bulk al arrancar y cron diario)
                                          │                 ▼
                                   inventory-core   (dueño de productos, lotes y stock)
```

- `main.ts`: NestJS + Fastify. Colas RMQ propias `billing_core_queue`
  (durable false) y `billing_core_queue_sync` (durable true).
  `InternalAuthInterceptor` global: toda petición RPC debe traer
  `internalToken` = `INTERNAL_SECRET` (el interceptor lo valida solo; los
  controllers no hacen nada).
- `app.module.ts`: `ConfigModule` global, `TypeOrmModule.forRootAsync`
  (Postgres, `DB_*`, `autoLoadEntities`, `synchronize` solo en pruebas),
  `ScheduleModule.forRoot()`.
- Módulos copiados de inventory-core (mismo patrón): `health`, `kafka`,
  `aws-s3`, `audit-log`, `companies`, `users-employees-events`,
  `devices-replica`.
- Módulos propios de réplica: `products-replica/`, `lots-replica/`.

## 2. Reglas transversales

- **Billing no es dueño de productos, lotes ni stock.** Solo réplicas de
  lectura. Nunca se escribe sobre una réplica desde la lógica de negocio.
- **Réplicas sin FK.** Solo `company_id` y demás ids como uuid plano. Así se
  puede `TRUNCATE` la tabla y reiniciar el MS: el bulk la reconstruye.
- **Los documentos de billing guardan snapshot, no relación.** Una factura
  guarda `product_id`, `lot_id`, `lot_code`, nombre, SKU, precio y banderas de
  IVA **copiados, sin FK** hacia las réplicas. Así las facturas históricas no
  se rompen si una réplica se trunca.
- **Dos caminos de sincronización por réplica:**
  1. Kafka, tiempo real (`*EventsListener.registerHandlers()` registrado en
     `kafka/kafka-listeners.orchestrator.ts`).
  2. RabbitMQ, bulk paginado por cursor contra `inventory_core_queue_sync`
     (al arrancar en segundo plano con reintentos, y cron diario).
- **Idempotencia:** todo upsert de réplica es idempotente (la entrega es al
  menos una vez). El consumer reintenta 3 veces y luego manda a la DLQ; el
  cron diario recupera lo perdido.
- **Kafka `.env`:** NO copiar `KAFKA_GROUP_ID` ni `KAFKA_DLQ_TOPIC` de otro MS.
  Defaults de billing: grupo `ms-billing-consumer-group`, DLQ `billing.dlq`.
  Un grupo compartido reparte los mensajes entre MS y cada uno recibiría solo
  una parte.
- **Kafka, `fromBeginning: false`:** un grupo nuevo solo ve eventos desde que
  arranca; lo anterior llega por el bulk.
- **Cliente RMQ `INVENTORY_SYNC`:** `ClientsModule.register` es por módulo;
  cada módulo de réplica lo registra con la misma cola
  `inventory_core_queue_sync`.
- **Cron:** zona `America/Guayaquil`. Un `pg_try_advisory_lock` por réplica
  evita que dos instancias, o el arranque y el cron, se solapen. El lock es de
  sesión: se toma y se suelta en la **misma conexión** (`QueryRunner`).
  Claves: productos `7302001`, lotes `7303001`. Horas: productos 03:00, lotes
  03:15.
- **Cursor de bulk:** `"ISO|uuid"` ordenado por `(fecha, id)`, con
  `date_trunc('milliseconds', ...)` en origen (Postgres guarda microsegundos,
  JS milisegundos).
- **Stock y descuentos NO se replican.** Disponibilidad y descuento de stock se
  harán por RabbitMQ síncrono contra inventory-core (ver sección 4).
- **Errores:** siempre `RpcException(new XxxException(msg))`, mensajes en
  español. `RpcException` se relanza, `HttpException` se envuelve, lo demás es
  500 genérico con log.
- **Nombres de comandos:** verbo en `snake_case` (`get_products_sync`). No usar
  `modulo.accion`.
- **Dinero:** columnas `numeric`, en TypeORM viajan como **string**; los
  cálculos se hacen en enteros (centavos). Los totales los calcula el
  servidor.
- **Postgres:** `INSERT ... ON CONFLICT DO UPDATE` con el mismo id dos veces en
  el mismo statement falla (deduplicar antes). Límite de 65 535 parámetros por
  query (insertar en bloques de 500).
- **Entidades nuevas:** toda entidad debe estar en `forFeature` de su módulo
  ("no existe la relación …" si falta).
- **Efectos externos tras el commit:** lo que llama a servicios de red va
  después de la transacción y captura sus propios errores; un fallo externo no
  deshace un documento ya guardado.

## 3. Mapa del MS

```
src/
  companies/              réplica de empresas y sucursales      → companies/AGENTS.md
  users-employees-events/ réplica de usuarios
  devices-replica/        marcas y modelos
  kafka/                  consumer, producer, orquestador de listeners
  products-replica/       réplica de productos                  → products-replica/AGENTS.md
  lots-replica/           réplica de lotes (sin saldos)         → lots-replica/AGENTS.md
  health/  aws-s3/  audit-log/  interceptors/
```

## 4. Decisiones tomadas

1. **Productos y lotes se replican; el stock no.** El stock cambia con cada
   movimiento y una réplica siempre va atrasada: dos ventas podrían tomar la
   misma pieza, y una factura emitida tiene valor legal ante el SRI.
2. **La venta descuenta stock por comando RabbitMQ síncrono** a inventory-core
   (sin construir): billing genera `clientRequestId` al abrir la venta, envía
   el comando, inventory valida con `FOR UPDATE`, descuenta y responde con el
   snapshot; solo entonces billing guarda la factura. Sin respuesta, billing no
   asume éxito ni fracaso: reintenta con el mismo id. Billing depende de
   inventory únicamente en ese momento.
3. **Anular una factura** devuelve el stock al mismo lote con un comando de
   retorno a inventory.
4. **Sucursal:** billing vende siempre de la sucursal principal.
5. **Serializados:** el IMEI/unidad lo elige el front (manual, o automático si
   viene por QR); billing envía `unitIds`.
6. **IVA y banderas:** viajan informativos (`defaults` en productos;
   `has_tax` y `price_includes_tax` en lotes). La decisión de cómo se usan
   queda para después (B4).
7. **Evidencia de la salida en inventory:** el kardex de inventory-core con
   `reference_id` = id de la venta de billing. No se replican facturas en
   inventory.
8. **`MovementType.SALE_OUT` ya existe** en inventory-core: no hace falta
   `ALTER TYPE`.
9. **Reservas de stock** (proformas): lógica futura, hoy no existen.

## 5. Pendientes

B1. Flujo de venta: `list_sale_lots`, `create_sale_outbound`,
    `return_sale_outbound` en inventory-core y cliente RPC en billing (sin
    construir).
B2. Reconciliación de descuentos huérfanos (inventory descontó y billing cayó
    antes de guardar la factura): consulta por rango y retorno automático tras
    X minutos sin factura.
B3. Reservas de stock (proformas).
B4. Decidir el uso de `defaults` (IVA y banderas) de productos y lotes.
B5. Gateway de billing: sin construir.
B6. Producción: `synchronize` apagado; hará falta migración de
    `products_replica` y `lots_replica` con sus índices.

## 6. Estado

| Componente | Estado |
|---|---|
| Réplica de productos (Kafka + bulk + cron) | **Probado** (2026-11-12) |
| Réplica de lotes (Kafka + bulk + cron) | **Probado** (2026-11-12) |
| Flujo de venta con confirmación por RabbitMQ | **No construido** |
| Facturas, clientes, SRI | **No construido** |

## 7. Errores y lecciones transversales

- KafkaJS responde "does not host this topic-partition" / "not the leader" solo
  la primera vez que se publica a un topic nuevo; reintenta y entra. No es un
  error.
- `QueryDeepPartialEntity` no acepta `Record<string, unknown>` en columnas
  `jsonb`: tipar el payload como `any`.
- Un cambio de nombre de comando, topic o payload exige revisar ambos lados.
- No loguear payloads grandes; imprimir solo resumen.

## 8. Cómo actualizar este archivo
Si cambia una convención, un contrato entre módulos o la infraestructura:
actualizar las secciones 1, 2 y 4. Si cambia un módulo, su AGENTS.md. Reglas
completas en la sección 0.