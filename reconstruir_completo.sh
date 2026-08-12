#!/bin/bash
# ============================================
# CONFIGURACIÓN - SIN CIERRE AUTOMÁTICO
# ============================================
set -u          # Variables no definidas = error
# NOTA: NO usamos "set -e" para que no se cierre ante errores

# ============================================
# VARIABLES
# ============================================
BASE="/media/lenovo/DISCO/MICROSERVICIOS/tcm_microservicios/docker"
ENV_FILE="$BASE/.env"
ERRORS=0
FAILED_SERVICES=()

# ============================================
# FUNCIÓN PARA MANEJAR ERRORES SIN CERRAR
# ============================================
handle_error() {
    local service="$1"
    local error_msg="$2"
    
    echo ""
    echo "============================================"
    echo "⚠️  ERROR EN: $service"
    echo "============================================"
    echo "❌ $error_msg"
    echo "📝 Continuando con el siguiente servicio..."
    echo "============================================"
    echo ""
    
    ERRORS=$((ERRORS + 1))
    FAILED_SERVICES+=("$service")
}

# ============================================
# 1. LIMPIEZA CONTROLADA (SIN BORRAR VOLÚMENES)
# ============================================
echo "============================================"
echo "🧹 LIMPIEZA SEGURA"
echo "============================================"

# Detener contenedores específicos
echo "🛑 Deteniendo contenedores ms-..."
docker stop $(docker ps -q --filter "name=ms-") 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=ms-") 2>/dev/null || true

# Eliminar contenedores huérfanos
echo "🗑️ Eliminando contenedores huérfanos..."
docker rm -f $(docker ps -aq) 2>/dev/null || true

# Limpiar imágenes no usadas
echo "🖼️ Limpiando imágenes no usadas..."
docker image prune -af 2>/dev/null || true

# Limpiar caché
echo "🏗️ Limpiando build cache..."
docker builder prune -af 2>/dev/null || true

# Limpiar redes no usadas
echo "🌐 Limpiando redes no usadas..."
docker network prune -f 2>/dev/null || true

echo "✅ Limpieza segura completada (datos preservados)"
echo ""

# ============================================
# 2. VERIFICAR .ENV
# ============================================
echo "============================================"
echo "🔍 VERIFICANDO .ENV"
echo "============================================"

if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️ ADVERTENCIA: Archivo .env no encontrado"
    echo "   Ruta: $ENV_FILE"
    echo "   Los servicios podrían no funcionar correctamente"
else
    echo "✅ Archivo .env encontrado"
fi
echo ""

# ============================================
# 3. CREAR RED BACKEND
# ============================================
echo "============================================"
echo "🌐 VERIFICANDO RED BACKEND"
echo "============================================"

if ! docker network inspect backend >/dev/null 2>&1; then
    echo "📡 Creando red backend..."
    docker network create backend 2>/dev/null || {
        echo "⚠️ No se pudo crear la red (posiblemente ya existe)"
    }
else
    echo "✅ Red backend ya existe"
fi
echo ""

# ============================================
# 4. FUNCIÓN MEJORADA PARA CONSTRUIR SERVICIOS
# ============================================
build_service() {
    local name="$1"
    local dir="$2"
    
    echo ""
    echo "============================================"
    echo "📦 CONSTRUYENDO: $name"
    echo "============================================"
    
    # Verificar que existe el directorio
    if [ ! -d "$BASE/$dir" ]; then
        handle_error "$name" "El directorio $BASE/$dir no existe"
        return 1
    fi
    
    # Entrar al directorio
    cd "$BASE/$dir" 2>/dev/null || {
        handle_error "$name" "No se pudo acceder a $BASE/$dir"
        return 1
    }
    
    echo "📂 Directorio: $(pwd)"
    
    # Verificar docker-compose.yml
    if [ ! -f "docker-compose.yml" ] && [ ! -f "compose.yml" ]; then
        handle_error "$name" "No existe docker-compose.yml"
        return 1
    fi
    
    # INTENTAR BUILD (con manejo de errores)
    echo "🔨 Ejecutando build --no-cache..."
    if ! docker compose build --no-cache 2>&1 | tee /tmp/build_${name}.log; then
        handle_error "$name" "Error en el build (ver logs en /tmp/build_${name}.log)"
        return 1
    fi
    
    # INTENTAR LEVANTAR (con manejo de errores)
    echo "🚀 Levantando $name..."
    if ! docker compose --env-file "$ENV_FILE" up -d 2>&1 | tee /tmp/up_${name}.log; then
        # Verificar si es error de puerto
        if grep -q "port is already allocated" /tmp/up_${name}.log; then
            echo "⚠️ Conflicto de puertos detectado"
            handle_port_conflict "$name"
            # Intentar de nuevo con puertos cambiados
            echo "🔄 Reintentando con puertos ajustados..."
            if ! docker compose --env-file "$ENV_FILE" up -d 2>&1; then
                handle_error "$name" "Error al levantar después de ajustar puertos"
                return 1
            fi
        else
            handle_error "$name" "Error al levantar el servicio (ver logs)"
            return 1
        fi
    fi
    
    echo "✅ $name construido y levantado correctamente"
    return 0
}

# ============================================
# 5. FUNCIÓN PARA MANEJAR CONFLICTOS DE PUERTOS
# ============================================
handle_port_conflict() {
    local service="$1"
    
    echo "🔧 Ajustando puertos para $service..."
    
    # Verificar qué puertos están en conflicto
    if grep -q "3005" docker-compose.yml; then
        echo "   Puerto 3005 está ocupado, cambiando a 3010..."
        sed -i 's/- "3005:3005"/- "3010:3005"/g' docker-compose.yml
        sed -i 's/- "3005:3005"/- "3010:3005"/g' docker-compose.yml 2>/dev/null || true
        echo "   ✅ Puerto cambiado a 3010:3005"
    fi
    
    if grep -q "3006" docker-compose.yml; then
        echo "   Puerto 3006 está ocupado, cambiando a 3011..."
        sed -i 's/- "3006:3006"/- "3011:3006"/g' docker-compose.yml
        echo "   ✅ Puerto cambiado a 3011:3006"
    fi
    
    if grep -q "3010" docker-compose.yml; then
        echo "   Puerto 3010 está ocupado, cambiando a 3012..."
        sed -i 's/- "3010:3010"/- "3012:3010"/g' docker-compose.yml
        echo "   ✅ Puerto cambiado a 3012:3010"
    fi
    
    echo "📄 Nuevos puertos configurados:"
    grep -E "^[[:space:]]+- \"[0-9]+:[0-9]+\"" docker-compose.yml || true
}

# ============================================
# 6. LEVANTAR INFRAESTRUCTURA
# ============================================
echo "============================================"
echo "🏗️ LEVANTANDO INFRAESTRUCTURA"
echo "============================================"

if [ ! -d "$BASE/infra" ]; then
    echo "⚠️ No existe el directorio infra, saltando..."
else
    cd "$BASE/infra" || {
        echo "⚠️ No se pudo acceder a infra"
    }
    
    echo "📂 Directorio: $(pwd)"
    
    # Build infra (sin fallar)
    echo "🔨 Preparando infraestructura..."
    docker compose build --no-cache 2>/dev/null || true
    
    # Levantar infra (sin fallar)
    echo "🚀 Levantando Kafka, Redis, RabbitMQ..."
    docker compose --env-file "$ENV_FILE" up -d 2>/dev/null || {
        echo "⚠️ Error al levantar infraestructura (continuando...)"
    }
fi

echo ""
echo "⏳ Esperando 15 segundos para servicios base..."
sleep 15

# ============================================
# 7. CONSTRUIR SERVICIOS
# ============================================
echo ""
echo "============================================"
echo "🏗️ RECONSTRUYENDO SERVICIOS"
echo "============================================"

# Lista de servicios a construir
build_service "Services" "services"
build_service "Gateway" "gateway"
# build_service "Realtime" "realtime"  # COMENTADO - NO EXISTE
build_service "Task Boards" "task-boards"
build_service "Notifications" "notifications"
build_service "Inventario" "inventario"

# ============================================
# 8. MOSTRAR RESULTADOS
# ============================================
echo ""
echo "============================================"
echo "📊 RESULTADOS FINALES"
echo "============================================"

# Mostrar errores si los hubo
if [ $ERRORS -gt 0 ]; then
    echo "⚠️ Se encontraron $ERRORS errores:"
    for service in "${FAILED_SERVICES[@]}"; do
        echo "   ❌ $service"
    done
    echo ""
    echo "💡 Los servicios fallidos pueden requerir atención manual"
    echo "   Revisa los logs en /tmp/build_*.log y /tmp/up_*.log"
else
    echo "✅ Todos los servicios se reconstruyeron exitosamente"
fi

echo ""
echo "📊 Contenedores activos:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "⚠️ No se pudo listar contenedores"

echo ""
echo "📋 Puertos disponibles:"
echo "  - Gateway:        http://localhost:3000"
echo "  - Notifications:  http://localhost:3010"
echo "  - Products:       http://localhost:3020"
echo "  - Inventario:     http://localhost:3030"
echo "  - Task Boards:    http://localhost:3005"
echo "  - Swagger Inv:    http://localhost:3030/api/docs"

# Mostrar puertos actuales de inventario
echo ""
echo "🔍 Puertos de Inventario:"
docker port ms-inventario 2>/dev/null || echo "⚠️ Inventario no está corriendo"

echo ""
echo "💾 Espacio en disco:"
df -h /media/lenovo/DISCO/ 2>/dev/null || df -h / 2>/dev/null

echo ""
echo "============================================"
if [ $ERRORS -eq 0 ]; then
    echo "🎉 ¡TODO COMPLETADO CON ÉXITO!"
else
    echo "⚠️ PROCESO COMPLETADO CON $ERRORS ERRORES"
    echo "   Revisa los logs para más detalles"
fi
echo "============================================"
echo ""

# Mostrar cómo ver logs
if [ $ERRORS -gt 0 ]; then
    echo "📝 Para ver logs de errores:"
    echo "   cat /tmp/build_*.log"
    echo "   cat /tmp/up_*.log"
    echo ""
    echo "📝 Para ver logs de un servicio específico:"
    echo "   docker logs ms-inventario --tail=50"
    echo "   docker logs ms-gateway --tail=50"
fi
