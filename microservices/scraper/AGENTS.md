# AGENTS.md: microservicio `scraper` (GSMArena)

> Este archivo solo contiene lo que se vio en el código, los logs y el compose compartidos.
> Lo que no se conoce está marcado como **PENDIENTE DE REVISIÓN**. No se debe rellenar con suposiciones.

## 1. Qué es

Microservicio en Go que hace scraping de GSMArena y guarda marcas, modelos y fichas técnicas en MongoDB.
También publica eventos a Kafka y escucha una cola de RabbitMQ.

- Ruta local del código: `D:\Teamcellmania_backend\microservices\scraper`
- Módulo Go (según los imports): `github.com/tu-org/tcm-scraper`
  - **PENDIENTE DE REVISIÓN:** confirmar si es el nombre real o un placeholder.
- Versión de Go, dependencias de `go.mod` y tests: **PENDIENTE DE REVISIÓN** (no se vieron).

## 2. Estructura

```
cmd/scraper/main.go          arranque, wiring, apagado ordenado
internal/config/config.go    variables de entorno y valores por defecto
internal/events/publisher.go publisher Kafka
internal/gsmarena/           cliente HTTP y parseo de GSMArena (client, debug, helpers, parse, specs)
internal/ingest/crawl.go     lógica del crawl (listado, modelos nuevos, fichas)
internal/ingest/schedule.go  scheduler (despierta a medianoche)
internal/messaging/          consumer RabbitMQ y handlers
internal/store/              Mongo (gsmarena, models_sync, mongo, state, technical_models)
Dockerfile, Dockerfile.dev, .air.toml
```

**Archivos vistos completos:** `main.go`, `config.go`, `crawl.go`, `schedule.go`, `state.go`.
**Archivos NO vistos (PENDIENTE DE REVISIÓN):** todo `internal/gsmarena/*`, `internal/events/publisher.go`, `internal/messaging/*`, `internal/store/{gsmarena,models_sync,mongo,technical_models}.go`, `Dockerfile`, `Dockerfile.dev`, `.air.toml`.

## 3. Cómo funciona el crawl (según `crawl.go` y `schedule.go`)

### Scheduler
- `Schedule` despierta cada medianoche en la zona `SCHEDULE_TZ` (default `America/Guayaquil`) y llama a `Run`.
- Si hay un bloqueo (`blocked`) que vence antes de la medianoche, despierta cuando vence.
- Al arrancar ejecuta solo si `RunOnStart` es true, o si el estado previo era `running` o `paused` con `last_error = "interrumpido"`. Si sigue en enfriamiento, no ejecuta.
- Los logs están en UTC. 00:00 de Guayaquil equivale a 05:00Z.

### `Run` (un candado en memoria impide ejecuciones simultáneas)
Estado guardado en la colección `crawl_state` (`status`: `running | paused | blocked | done`).

1. Carga el estado. Si no existe, o está `done` de un día anterior, crea un ciclo nuevo. Conserva `ListingDone`, `ListingDoneAt`, `NewCheckDay` y `SeenCounts` si el listado ya estaba completo.
2. Si el estado es `blocked` y `BlockedUntil` no venció, no hace nada.
3. Si el listado está completo y pasó `ListingRefresh`, lo reinicia desde la primera marca.
4. Fase 1, `crawlListing`: recorre marcas y páginas de modelos (se omite si `ListingDone`).
5. Fase 1b, `syncNewModels`: solo si el listado ya estaba completo y pasaron `NewCheckDays` (default 7) desde `NewCheckDay`. Compara el total por marca del sitio con lo guardado y recorre solo las marcas con diferencia.
6. Fase 2, `crawlSpecs`: pide la ficha de los modelos que no la tienen, en lotes de `Batch` (default 100).
7. `finish` fija el estado final:
   - sin error: `done`
   - presupuesto agotado o límite de páginas: `paused`, no es error
   - contexto cancelado: `paused` con `last_error = "interrumpido"`
   - cualquier otro error (bloqueo, fallos seguidos): `blocked` con enfriamiento creciente

### Límites y bloqueos
- Tope real por ejecución: `MaxRequests` (se cuenta con `r.c.Requests()`).
- `MaxConsecFails` (default 3) fallos seguidos de ficha disparan `ErrSoftBlock`.
- 404 y 410 no cuentan como bloqueo.
- Enfriamiento: `CooldownBase << min(BlockCount-1, 5)`, con tope `CooldownMax`. Si el error trae `RetryAfter` mayor, se usa ese (máximo 24h).
- Una ejecución que se corta por presupuesto resetea `BlockCount`.

## 4. Configuración (`config.go`)

Variables de entorno leídas: `APP_ENV`, `HTTP_PORT`, `MONGO_URI`, `MONGO_DB`, `RABBIT_URL`, `RABBIT_QUEUE`, `INTERNAL_SECRET`, `SCHEDULE_TZ`, `KAFKA_BOOTSTRAP_SERVERS`.
Solo en producción se leen además `SCRAPE_DELAY` y `MAX_REQUESTS`. El resto de los valores está fijo en código.

| Valor | production | development |
|---|---|---|
| RunOnStart | false | true |
| ScrapeDelay | `SCRAPE_DELAY`, default 20s (comentario: 20–40 s con jitter) | 4s |
| MaxRequests | `MAX_REQUESTS`, default 25 | 2000 |
| MaxPages / MaxSpecs | 0 / 1500 | 0 / 0 |
| RefreshDays | 3650 | 30 |
| ListingRefreshDays | 180 | 30 |
| NewCheckDays | 7 | 7 |
| CooldownBase / Max | 60h / 96h | 10min / 1h |

El comentario del código dice que "el ban real dura ~60h". **PENDIENTE DE REVISIÓN:** la fuente de ese dato no está documentada.

### Configuración que hoy no tiene efecto (observado en el código visto)
- `MaxPages` y `MaxSpecs` se calculan en `config.go` pero **no se pasan** a `ingest.Options` en `main.go`.
- `errSpecsLimit` existe pero ningún código lo devuelve.
- Ojo: `RefreshDays = 3650` equivale a no refrescar fichas ya descargadas.
- **PENDIENTE DE REVISIÓN:** el significado exacto de los parámetros de `DevicesNeedingSpecs(staleBefore, now-24h, batch)`. Está en `store/`, no visto.

## 5. Infraestructura y despliegue

- Compose de producción (servidor): `/home/ubuntu/proyects/tcm_microservicios/docker/compose.prod.yml`
- Servicio `scraper`, contenedor `ms-scraper`, imagen `ghcr.io/cellmaniadesarrollo/tcm-scraper:${SCRAPER_TAG:-latest}`.
- **Una sola instancia**: el candado es en memoria (comentario del compose).
- `mem_limit: 256m`, `stop_grace_period: 20s`, healthcheck `GET http://127.0.0.1:8080/health`, `depends_on: init-kafka` (service_completed_successfully), red `backend`.
- Variables del servicio en producción: `APP_ENV=production`, `HTTP_PORT=8080`, `MONGO_URI=${MONGODB_URI_REPORTS}`, `MONGO_DB=${MONGODB_DB_SCRAPER:-tcm_scraping}`, `SCHEDULE_TZ=${SCRAPER_TZ:-America/Guayaquil}`, `RABBIT_URL=amqp://guest:guest@rabbitmq:5672/`, `INTERNAL_SECRET`, `KAFKA_BOOTSTRAP_SERVERS=${KAFKA_BOOTSTRAP_SERVERS}` (viene del `.env`), `MAX_REQUESTS=${SCRAPER_MAX_REQUESTS:-300}`, `SCRAPE_DELAY=${SCRAPER_DELAY:-20s}`.
- Kafka en los logs: `brokers: kafka:9092`.
- Cola RabbitMQ: `scraper_models_queue_sync`. Handlers registrados: `sync_technical_models`, `sync_models`.
- MongoDB: base `tcm_scraping`, colección de control `crawl_state`.
- Los WARN de `REDIS_PASSWORD`, `CORS_ORIGIN`, `INCOME_BACKEND_URL` y `REFERRAL_BASE_URL` vienen de otros servicios del mismo compose, no del scraper.

Comandos usados en el servidor:
```bash
cd /home/ubuntu/proyects/tcm_microservicios/docker
docker compose -f compose.prod.yml up -d scraper
docker compose -f compose.prod.yml logs -f scraper
```

**PENDIENTE DE REVISIÓN:**
- Cómo se construye y publica la imagen en `ghcr.io` (CI, comandos, tags).
- Cómo se corre en desarrollo (`.air.toml` y `Dockerfile.dev` no se vieron).
- Comandos de build y test de Go.

## 6. Kafka

- El publisher se crea siempre en `main.go`. Con `KAFKA_BOOTSTRAP_SERVERS` vacío se loguea "kafka desactivado".
- Eventos que publica el crawler: `MODEL_CREATED` (modelos recién insertados) y `MODEL_TECHNICAL_UPDATED` (códigos de modelo técnico dentro de la ficha, tipo SM-S918B; no se publica si la ficha no los trae).
- Los modelos ya existentes en Mongo no se republican.
- **PENDIENTE DE REVISIÓN:**
  - Nombres reales de los topics (en el código aparecen como `events.TopicModelCreated` y `events.TopicModelTechnicalUp`).
  - Quién consume los eventos.
  - Si `Publish` tolera un publisher nulo o desactivado. `crawl.go` lo llama sin comprobación de nil.
  - El scraper no loguea cada publicación, así que no está confirmado que los mensajes lleguen al tópico.

## 7. Estado observado (logs del 10 al 16/11/2026)

- Backlog de fichas: 16114 modelos en total y 2633 fichas guardadas al 16/11. Faltan unas 13.480 (el contador `fichas` es acumulado).
- Con `MAX_REQUESTS=300` cada corrida dura unas 2h32m (05:00Z a 07:32Z) y baja 300 fichas. `fallidas: 0` en todas las corridas vistas.
- Con el default anterior (25) solo se bajaban ~25 fichas por corrida.
- Estimación: unos 45 días para terminar a este ritmo (cálculo, no medición).
- La revisión de modelos nuevos (`syncNewModels`) corrió el 14/11 (11 modelos nuevos, de 16103 a 16114). Por `NewCheckDays = 7`, la próxima sería en la corrida del 21/11. **PENDIENTE DE REVISIÓN:** confirmar el valor de `new_check_day` en Mongo.
- Causa del ban original: **desconocida**. Los logs vistos solo muestran el estado `blocked` ya existente. El detalle podría estar en `last_error` y `block_count` de `crawl_state`, si siguen guardados.
- Hecho observado sobre los totales: algunas marcas tienen más modelos en el sitio que guardados (ej. Samsung 1472 vs 1451). `SeenCounts` evita recorrerlas de nuevo mientras el total del sitio no cambie.

## 8. Cambios propuestos y NO aplicados

- Scheduler semanal vía `SCHEDULE_WEEKDAY` (`config.go`, `crawl.go`, `main.go`, `schedule.go`): propuesto pero **no aplicado**. Hoy el scheduler es diario. Solo tiene sentido cuando el backlog termine.

## 9. Reglas para agentes

Criterios acordados durante la operación del servicio:

1. No aumentar `MAX_REQUESTS` ni bajar `SCRAPE_DELAY` de golpe. Subir en pasos y revisar que `fallidas` siga en 0 y que no aparezca `crawl pausado` (recomendación, no regla técnica verificada).
2. No tocar `crawl_state` en Mongo sin confirmar con el responsable.
3. No agregar una segunda instancia del scraper: el candado es en memoria.
4. Mantener el estilo existente: logs JSON con `slog` en español, comentarios en español.
5. Si falta información para una tarea, anotarlo como "PENDIENTE DE REVISIÓN" en lugar de suponerlo.
