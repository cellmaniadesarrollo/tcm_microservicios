# Docker Cheatsheet - Teamcellmania Backend (Desarrollo 2026)

**Proyecto**: Microservicios NestJS + RabbitMQ + PostgreSQL/MySQL  
**Estructura**: Multi-compose por capa (infra / core / services / gateway)  
**Carpeta clave**: `D:\Teamcellmania_backend\docker`  
**Entorno**: Desarrollo con hot-reload / watch mode en algunos servicios  
**Objetivo**: Evitar rebuilds innecesarios, levantar solo la capa que se necesita  

Última actualización: Abril 2026

---

## Estructura de carpetas

```
docker/
  .env                        ← variables compartidas (nunca mover)
  infra/
    docker-compose.yml        ← rabbitmq, kafka, redis
  core/
    docker-compose.yml        ← companies
  services/
    docker-compose.yml        ← clients, users, subscriptions, orders
  gateway/
    docker-compose.yml        ← gateway, realtime
```

### Orden de arranque obligatorio
```
infra → core → services → gateway
```
No hay `depends_on` entre archivos, así que el orden lo manejas tú (o con `ms-up-all`).

### Red externa compartida (crear una sola vez)
```powershell
docker network create backend
```

---

## 1. Aliases PowerShell

Abrir el perfil:
```powershell
notepad $PROFILE
```

Pegar el contenido del archivo `powershell_profile_aliases.ps1` y luego recargar:
```powershell
. $PROFILE
```

---

## 2. Comandos por capa

> **Nota**: Todos los comandos usan `--env-file ../.env` automáticamente vía el helper `_dc`.  
> Si corres `docker compose` directo desde una subcarpeta, agrega `--env-file ../.env` manualmente.

### Levantar / Bajar

```powershell
# Todo de una (en orden correcto)
ms-up-all
ms-down-all

# Por capa individual
ms-up-infra
ms-up-core
ms-up-svc
ms-up-gat

ms-down-infra
ms-down-core
ms-down-svc
ms-down-gat
```

### Equivalente manual (desde la carpeta de la capa)
```powershell
cd D:\Teamcellmania_backend\docker\services
docker compose --env-file ../.env up -d
```

---

## 3. Logs por servicio

```powershell
# Infra
ms-log-rabbit
ms-log-kafka
ms-log-redis

# Core
ms-log-com          # companies

# Services
ms-log-cli          # clients
ms-log-use          # users
ms-log-sub          # subscriptions
ms-log-ord          # orders

# Gateway
ms-log-gw           # gateway
ms-log-rt           # realtime

# Capa completa (todos los servicios del grupo)
ms-log-infra
ms-log-svc
ms-log-gat
```

---

## 4. Rebuilds

### Por capa (con caché — el más común)
```powershell
ms-rb-infra
ms-rb-core
ms-rb-svc
ms-rb-gat
```

### Limpio por capa (down --rmi local + build desde cero)
```powershell
ms-rbfull-infra
ms-rbfull-core
ms-rbfull-svc
ms-rbfull-gat
```

### Por servicio individual
```powershell
# Infra
ms-rb-rabbit
ms-rb-kafka
ms-rb-redis

# Core
ms-rb-com

# Services
ms-rb-cli
ms-rb-use
ms-rb-sub
ms-rb-ord

# Gateway
ms-rb-gw
ms-rb-rt
```

---

## 5. Force Recreate

Usar cuando cambias el `command` de un servicio (ej: `start` ↔ `start:dev`) sin necesitar rebuild.

```powershell
# Por capa completa
ms-re-infra
ms-re-core
ms-re-svc
ms-re-gat

# Por servicio individual (pasar nombre como argumento)
ms-re-svc users
ms-re-gat realtime
```

---

## 6. Restart

```powershell
ms-rst-infra
ms-rst-core
ms-rst-svc
ms-rst-gat

# Servicio individual
ms-rst-svc users
ms-rst-gat gateway
```

---

## 7. Limpieza de disco

```powershell
msclean    # prune images + builder cache (conserva 15GB)

# CUIDADO: borra bases de datos
# docker volume prune -f

# WSL (liberar memoria)
# wsl --shutdown
```

---

## 8. Flujo típico de desarrollo

### Solo trabajando en `users`
```powershell
ms-up-infra      # rabbitmq, kafka, redis
ms-up-core       # companies (dep. de users)
ms-up-svc users  # solo users
ms-log-use       # seguir logs
```

### Aplicar cambio de código (hot-reload activo → nada que hacer)
Si el servicio corre con `start:dev`, los cambios se aplican solos.

### Cambiar de `start` a `start:dev` en un servicio
1. Editar el `command` en el `docker-compose.yml` correspondiente
2. `ms-re-svc users`  ← recreate sin rebuild

### Rebuild después de cambio en `package.json` o `Dockerfile`
```powershell
ms-rb-use        # rebuild solo users con caché
# o si algo raro pasa:
ms-rbfull-svc    # rebuild limpio de toda la capa services
```

---

## 9. Referencia de servicios por capa

| Capa | Servicios | Comando de logs |
|---|---|---|
| infra | rabbitmq, kafka, redis | `ms-log-rabbit` `ms-log-kafka` `ms-log-redis` |
| core | companies | `ms-log-com` |
| services | clients, users, subscriptions, orders | `ms-log-cli` `ms-log-use` `ms-log-sub` `ms-log-ord` |
| gateway | gateway, realtime | `ms-log-gw` `ms-log-rt` |

---

## 10. Recordatorio rápido

```powershell
mshelp    # imprime todos los comandos disponibles
```
