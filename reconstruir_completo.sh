#!/usr/bin/env bash
# ============================================================
# TCM microservicios - levantar / reconstruir stack de Docker
#
# Uso:
#   ./start-all.sh                  # levanta todo (sin reconstruir imágenes)
#   ./start-all.sh --build          # reconstruye (con caché) y levanta
#   ./start-all.sh --build --no-cache
#   ./start-all.sh --restart        # detiene contenedores ms-* antes de levantar
#   ./start-all.sh --prune          # además limpia imágenes/caché huérfanas (dangling)
#   ./start-all.sh gateway inventario   # solo esos stacks
#   ./start-all.sh --down           # detiene todos los stacks (conserva volúmenes)
# ============================================================
set -u   # sin "set -e": un fallo no debe cortar el resto

BASE="${BASE:-/media/lenovo/DISCO/MICROSERVICIOS/tcm_microservicios/docker}"
ENV_FILE="$BASE/.env"
LOG_DIR="/tmp/tcm-logs"
mkdir -p "$LOG_DIR"

# Orden de arranque (carpeta dentro de $BASE). Gateway va al final
# porque depende del resto (incluye también "realtime").
ALL_STACKS=(infra notifications services inventario task-boards gateway)
# Stacks opcionales existentes en tu carpeta (descomenta si los usas):
# ALL_STACKS+=(core notification-dispatcher reports scraping)

BUILD=0; NO_CACHE=0; RESTART=0; PRUNE=0; DOWN=0
SELECTED=()

for arg in "$@"; do
  case "$arg" in
    --build)    BUILD=1 ;;
    --no-cache) NO_CACHE=1; BUILD=1 ;;
    --restart)  RESTART=1 ;;
    --prune)    PRUNE=1 ;;
    --down)     DOWN=1 ;;
    -h|--help)  sed -n '2,13p' "$0"; exit 0 ;;
    *)          SELECTED+=("$arg") ;;
  esac
done
[ ${#SELECTED[@]} -eq 0 ] && SELECTED=("${ALL_STACKS[@]}")

FAILED=()

log()  { echo -e "\n=== $* ==="; }
fail() { echo "❌ $1: $2"; FAILED+=("$1"); }

compose() {  # compose <dir> <args...>
  local dir="$1"; shift
  ( cd "$BASE/$dir" && docker compose --env-file "$ENV_FILE" "$@" )
}

# Espera a que un contenedor esté healthy (o running si no tiene healthcheck)
wait_healthy() {
  local container="$1" timeout="${2:-120}" waited=0 status
  while [ $waited -lt "$timeout" ]; do
    status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || echo "missing")
    case "$status" in healthy|running) echo "✅ $container: $status"; return 0 ;; esac
    sleep 3; waited=$((waited + 3))
  done
  echo "⚠️  $container no quedó healthy en ${timeout}s (estado: $status)"
  return 1
}

# ---------- Pre-chequeos ----------
[ -f "$ENV_FILE" ] || echo "⚠️  No existe $ENV_FILE; los servicios podrían fallar."
docker info >/dev/null 2>&1 || { echo "❌ Docker no está disponible."; exit 1; }

# ---------- Apagar ----------
if [ $DOWN -eq 1 ]; then
  log "Deteniendo stacks (volúmenes conservados)"
  for (( i=${#SELECTED[@]}-1; i>=0; i-- )); do
    s="${SELECTED[$i]}"
    [ -d "$BASE/$s" ] && compose "$s" down --remove-orphans
  done
  exit 0
fi

# ---------- Limpieza opcional ----------
if [ $RESTART -eq 1 ]; then
  log "Deteniendo contenedores del proyecto"
  for s in "${SELECTED[@]}"; do
    [ -d "$BASE/$s" ] && compose "$s" down --remove-orphans 2>/dev/null
  done
fi

if [ $PRUNE -eq 1 ]; then
  log "Limpieza de imágenes/caché huérfanas (dangling)"
  docker image prune -f
  docker builder prune -f
fi

# ---------- Red ----------
docker network inspect backend >/dev/null 2>&1 || {
  log "Creando red backend"; docker network create backend
}

# ---------- Levantar ----------
for s in "${SELECTED[@]}"; do
  log "Stack: $s"
  if [ ! -f "$BASE/$s/docker-compose.yml" ] && [ ! -f "$BASE/$s/compose.yml" ]; then
    fail "$s" "no existe docker-compose.yml en $BASE/$s"; continue
  fi

  if [ $BUILD -eq 1 ]; then
    flags=(); [ $NO_CACHE -eq 1 ] && flags=(--no-cache)
    echo "🔨 build ${flags[*]:-}"
    # Build secuencial (evita cortes de red por descargas npm en paralelo) y hasta 3 intentos
    ok=0
    for attempt in 1 2 3; do
      COMPOSE_PARALLEL_LIMIT=1 compose "$s" build "${flags[@]}" 2>&1 | tee "$LOG_DIR/build_$s.log"
      if [ "${PIPESTATUS[0]}" -eq 0 ]; then ok=1; break; fi
      echo "⚠️  Build de $s falló (intento $attempt/3), reintentando en 5s..."
      sleep 5
    done
    [ $ok -eq 0 ] && { fail "$s" "falló el build tras 3 intentos (ver $LOG_DIR/build_$s.log)"; continue; }
  fi

  echo "🚀 up -d"
  compose "$s" up -d 2>&1 | tee "$LOG_DIR/up_$s.log"
  if [ "${PIPESTATUS[0]}" -ne 0 ]; then
    if grep -qi "port is already allocated" "$LOG_DIR/up_$s.log"; then
      fail "$s" "puerto ocupado (revisa 'docker ps' / 'ss -ltnp'); no se modifican los compose"
    else
      fail "$s" "falló el arranque (ver $LOG_DIR/up_$s.log)"
    fi
    continue
  fi

  # Esperas específicas para dependencias base
  case "$s" in
    infra)
      wait_healthy rabbitmq 120
      wait_healthy kafka 120
      wait_healthy redis-realtime 60
      ;;
    notifications)
      wait_healthy ms-notifications-rabbitmq 90
      wait_healthy ms-notifications-mongodb 90
      ;;
  esac
done

# ---------- Resumen ----------
log "Resumen"
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "⚠️  Stacks con error: ${FAILED[*]}"
  echo "   Logs: $LOG_DIR/"
else
  echo "✅ Todo levantado correctamente"
fi

echo
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

cat <<'EOF'

Puertos (host):
  Gateway            http://localhost:3000
  Realtime           http://localhost:3002
  Notifications      http://localhost:3010   (RPC 3003)
  Task Board         http://localhost:3005   -> contenedor 3001
  Inventario         http://localhost:3030   (docs: /api/docs)
  RabbitMQ (infra)   http://localhost:15672
  RabbitMQ (notif.)  http://localhost:15673
  Mongo Express      http://localhost:8081
  Kafka 9092/9094 · Redis 6379

Logs de un servicio:  docker logs -f ms-gateway --tail=50
EOF

[ ${#FAILED[@]} -eq 0 ]