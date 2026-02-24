# Docker Cheatsheet - Teamcellmania Backend (Desarrollo 2026)

**Proyecto**: Microservicios NestJS + RabbitMQ + PostgreSQL/MySQL  
**Archivo principal**: `docker-compose.dev.yml`  
**Carpeta clave**: `D:\Teamcellmania_backend\docker`  
**Entorno**: Desarrollo con hot-reload / watch mode en algunos servicios  
**Objetivo**: Evitar rebuilds innecesarios y no llenar el disco con imágenes  

Última actualización: Febrero 2026

---

## 1. Ir rápido a la carpeta docker

### PowerShell / CMD
```powershell
cd D:\Teamcellmania_backend\docker
```

### Alias permanente (recomendado)

**PowerShell**
```powershell
notepad $PROFILE
```
Agregar:
```powershell  
# ─── Docker Teamcellmania - Comandos rápidos (msdc + 3/4 letras) ──────────────
# Última actualización: Febrero 2026

$composeFile = "D:\Teamcellmania_backend\docker\docker-compose.dev.yml"
$dockerFolder = "D:\Teamcellmania_backend\docker"

# ── Navegación rápida ──
function msdc { 
    Set-Location $dockerFolder 
    Write-Host "→ Cambiado a: $dockerFolder" -ForegroundColor Green
}

# ── Logs (msdc + lo + 3 letras del servicio) ──
function msdclog { docker compose -f $composeFile logs -f @args }           # genérico: msdclog users
function msdcgat { docker compose -f $composeFile logs -f gateway }
function msdcuse { docker compose -f $composeFile logs -f users }
function msdcord { docker compose -f $composeFile logs -f orders }
function msdcc li { docker compose -f $composeFile logs -f clients }       # cli → c li (evita conflicto)
function msdccom { docker compose -f $composeFile logs -f companies }
function msdcsub { docker compose -f $composeFile logs -f subscriptions }
function msdcdes { docker compose -f $composeFile logs -f desguace }
function msdcrab { docker compose -f $composeFile logs -f rabbitmq }

# Nuevos atajos para logs (más cortos y consistentes)
function msdclogat { msdcgat }
function msdclouse { msdcuse }
function msdcloord { msdcord }
function msdclocli { msdcc li }
function msdclocom { msdccom }
function msdclosub { msdcsub }
function msdclodes { msdcdes }
function msdclorab { msdcrab }

# ── Up / Start ──
function msup    { docker compose -f $composeFile up -d @args }
function msupfr  { docker compose -f $composeFile up -d --force-recreate @args }
function msupb   { docker compose -f $composeFile up -d --build @args }           # rebuild normal (caché)
function msupbf  { docker compose -f $composeFile up -d --build --force-recreate @args }

# ── Rebuilds completos ──
function msdcrbfull { 
    Write-Host "→ Rebuild completo (borra imágenes locales + build)" -ForegroundColor Yellow
    docker compose -f $composeFile down --rmi local
    docker compose -f $composeFile up -d --build 
}

function msdcrb { 
    Write-Host "→ Rebuild normal (usa caché cuando pueda)" -ForegroundColor Cyan
    docker compose -f $composeFile up -d --build 
}

# Rebuild por servicio (ej: msdcrbuse users)
function msdcrbuse { docker compose -f $composeFile up -d --build users @args }
function msdcrbord { docker compose -f $composeFile up -d --build orders @args }
function msdcrbgat { docker compose -f $composeFile up -d --build gateway @args }
function msdcrbcli { docker compose -f $composeFile up -d --build clients @args }
function msdcrbcom { docker compose -f $composeFile up -d --build companies @args }
function msdcrbsub { docker compose -f $composeFile up -d --build subscriptions @args }
function msdcrbdes { docker compose -f $composeFile up -d --build desguace @args }

# ── Reinicios y recreaciones ──
function msrst   { docker compose -f $composeFile restart @args }
function msrstuse{ docker compose -f $composeFile restart users }
function msrstall{ docker compose -f $composeFile restart }

function msdcre { docker compose -f $composeFile up -d --force-recreate @args }   # force recreate sin build
function msdcreuse { docker compose -f $composeFile up -d --force-recreate users }

# ── Comandos genéricos útiles ──
function msdc { docker compose -f $composeFile @args }      # dc ultra corto: msdc logs -f users
function msdw   { docker compose -f $composeFile down @args }
function msdwvol { docker compose -f $composeFile down -v }   # ↓ con volúmenes (cuidado)
function msclean { 
    docker image prune -f
    docker builder prune --keep-storage 15GB -f
    Write-Host "→ Imágenes y build cache limpiados (15GB reservados)" -ForegroundColor Green
}

# ── Recordatorio rápido (mshelp) ──
function mshelp {
    Write-Host "`nComandos más usados (Teamcellmania 2026):`n" -ForegroundColor Magenta
    Write-Host "  msdc          → Ir a la carpeta docker"
    Write-Host "  msup          → up -d"
    Write-Host "  msupb         → up -d --build"
    Write-Host "  msdcrbfull    → down --rmi local + build"
    Write-Host "  msdcrbuse     → rebuild solo users"
    Write-Host "  msdcuse / msdclouse → logs users"
    Write-Host "  msdcreuse     → force recreate users"
    Write-Host "  msclean       → prune images + builder cache`n"
}
```
Luego:
```powershell
. $PROFILE
```

**Git Bash**
```bash
nano ~/.bash_profile
```
Agregar:
```bash
alias dock='cd /d/Teamcellmania_backend/docker'
```
Luego:
```bash
source ~/.bash_profile
```

Uso:
```bash
dock
```

---

## 2. Comandos Globales (todos los servicios)

```bash
# Levantar todo (sin rebuild)
docker compose -f docker-compose.dev.yml up -d

# Ver logs de todos
docker compose -f docker-compose.dev.yml logs -f

# Reiniciar todos
docker compose -f docker-compose.dev.yml restart

# Parar todo
docker compose -f docker-compose.dev.yml stop

# Parar y borrar contenedores
docker compose -f docker-compose.dev.yml down

# Rebuild necesario
docker compose -f docker-compose.dev.yml up -d --build

# Rebuild limpio total
docker compose -f docker-compose.dev.yml down --rmi local
docker compose -f docker-compose.dev.yml up -d --build
```

---

## 3. Logs por Microservicio

```bash
docker compose -f docker-compose.dev.yml logs -f gateway
docker compose -f docker-compose.dev.yml logs -f users
docker compose -f docker-compose.dev.yml logs -f orders
docker compose -f docker-compose.dev.yml logs -f clients
docker compose -f docker-compose.dev.yml logs -f companies
docker compose -f docker-compose.dev.yml logs -f subscriptions
docker compose -f docker-compose.dev.yml logs -f desguace
docker compose -f docker-compose.dev.yml logs -f rabbitmq
```


---

## 3.5. Cambio de modo watch/normal en un MS (start:dev ↔ start)

Cuando cambias el `command` en `docker-compose.dev.yml` de un microservicio  
(ej: de `["npm", "run", "start"]` a `["npm", "run", "start:dev"]` o viceversa),  
usa este comando para aplicar el cambio **sin rebuild innecesario**.

### Comando base (reemplaza `<servicio>`)
```bash
docker compose -f docker-compose.dev.yml up -d --force-recreate <servicio>
```

### Pre-hechos por microservicio (copy-paste)

```bash
# Gateway – cambio a/desde watch
docker compose -f docker-compose.dev.yml up -d --force-recreate gateway

# Users – cambio a/desde watch
docker compose -f docker-compose.dev.yml up -d --force-recreate users

# Orders – cambio a/desde watch
docker compose -f docker-compose.dev.yml up -d --force-recreate orders

# Clients – cambio a/desde watch
docker compose -f docker-compose.dev.yml up -d --force-recreate clients

# Companies – cambio a/desde watch
docker compose -f docker-compose.dev.yml up -d --force-recreate companies

# Subscriptions – cambio a/desde watch
docker compose -f docker-compose.dev.yml up -d --force-recreate subscriptions

# Desguace – cambio a/desde watch
docker compose -f docker-compose.dev.yml up -d --force-recreate desguace

# RabbitMQ (rara vez necesario)
docker compose -f docker-compose.dev.yml up -d --force-recreate rabbitmq
```

### Si cambiaste varios MS al mismo tiempo
```bash
docker compose -f docker-compose.dev.yml up -d --force-recreate
```

---

## 4. Comandos por Microservicio

```bash
# Reiniciar
docker compose -f docker-compose.dev.yml restart <servicio>

# Force recreate
docker compose -f docker-compose.dev.yml up -d --force-recreate <servicio>

# Build servicio
docker compose -f docker-compose.dev.yml up -d --build <servicio>

# Build + recreate
docker compose -f docker-compose.dev.yml up -d --build --force-recreate <servicio>

# Parar uno
docker compose -f docker-compose.dev.yml stop <servicio>
```

Servicios:
`gateway, users, orders, clients, companies, subscriptions, desguace, rabbitmq`

---

## 5. Limpieza de Disco

```bash
docker image prune -f
docker builder prune --keep-storage 15GB -f

# CUIDADO (borra DBs)
# docker volume prune -f

# WSL
# wsl --shutdown
```
