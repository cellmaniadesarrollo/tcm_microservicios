# Configuración de Túnel Inverso SSH para Conectar MySQL Local a Microservicios en EC2 (Docker)

Este documento resume el proceso completo para exponer una base de datos
MySQL que corre en una máquina local (servelocal) hacia una instancia
EC2 en AWS, de forma que los microservicios en contenedores Docker
(NestJS) puedan conectarse sin exponer el puerto públicamente.

**Fecha aproximada:** Febrero 2026\
**Entorno:**\
- Máquina local: Ubuntu (servelocal) con MySQL Server\
- Instancia EC2: Ubuntu 24.04 (ip-172-31-29-154)\
- Túnel: SSH inverso (reverse tunnel) usando autossh\
- Aplicación: Microservicio `ms-orders` en Docker Compose (NestJS +
mysql2)

------------------------------------------------------------------------

## Problema original

-   MySQL corre en máquina local (puerto 3306).\
-   Se necesitaba conectar desde contenedores Docker en EC2
    (especialmente `ms-orders`).\
-   Error típico: `ECONNREFUSED 172.17.0.1:3308` desde el contenedor.\
-   Causa principal: El túnel bindaba solo en `127.0.0.1:3308` en la EC2
    → inaccesible desde Docker (que usa el gateway 172.17.0.1).

------------------------------------------------------------------------

# ✅ Pasos completos que funcionaron

## 1️⃣ Instalación del cliente MySQL en la EC2 (imprescindible)

Aunque el servidor MySQL está en la máquina local, **el cliente** es
necesario para pruebas manuales y para que algunas apps lo usen.

``` bash
# En la EC2
sudo apt update
sudo apt install mysql-client-core-8.0   # ~30-40 MB, cliente oficial MySQL
# Alternativa ligera:
sudo apt install mariadb-client-core
```

Prueba básica (antes del túnel):

``` bash
mysql -h 127.0.0.1 -P 3308 -u root -p
# Nota: nunca uses -h localhost aquí (intenta socket Unix y falla)
```

------------------------------------------------------------------------

## 2️⃣ Túnel inverso SSH configurado en máquina local

Archivo: `/etc/systemd/system/mysql-tunnel-ms.service`

``` ini
[Unit]
Description=Túnel SSH inverso para MySQL hacia instancia MICRO SERVICIOS (EC2 ms)
After=network.target

[Service]
User=admin01
Environment="AUTOSSH_POLL=30"
Environment="AUTOSSH_GATETIME=0"
ExecStartPre=/usr/local/bin/clean-mysql-tunnel-ms.sh
ExecStart=/usr/bin/autossh -M 0 -N -o "StrictHostKeyChecking=no" -o "ServerAliveInterval=30" -o "ServerAliveCountMax=3" -R :3308:localhost:3306 -i /home/admin01/proyects/LlaveTeamcellmaniaUS.pem ubuntu@100.25.213.68
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 🔑 Clave del éxito:

    -R :3308:localhost:3306

El `:` al inicio indica wildcard (bind en todas las interfaces) cuando
se combina con `GatewayPorts clientspecified`.

------------------------------------------------------------------------

## 3️⃣ Cambio crítico en la EC2: Habilitar binding wildcard

Editar:

``` bash
sudo nano /etc/ssh/sshd_config
```

Agregar o modificar:

    GatewayPorts clientspecified

Reiniciar SSH:

``` bash
sudo systemctl restart ssh
```

------------------------------------------------------------------------

## 4️⃣ Verificación del binding correcto en EC2

``` bash
sudo ss -ltnp | grep 3308
```

Resultado esperado:

    tcp   LISTEN 0 128 0.0.0.0:3308 0.0.0.0:*   users:(("sshd",...

Si aparece solo `127.0.0.1:3308`, el túnel no está bindeando
correctamente.

------------------------------------------------------------------------

## 5️⃣ Configuración en Docker Compose

Archivo: `compose.prod.yml`

``` yaml
services:
  orders:
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - MYSQL_DB_HOST1=host.docker.internal
      - MYSQL_DB_PORT=3308
      - MYSQL_DB_USER=root
      - MYSQL_DB_PASSWORD=Teamcellmania13.
      - MYSQL_DB_NAME=tecnicos_db
```

### 🔎 ¿Por qué funciona?

-   `host.docker.internal` → resuelve dentro del contenedor a la IP del
    gateway del host (\~172.17.0.1 en Linux).
-   El túnel ahora escucha en `0.0.0.0:3308` → incluye la interfaz
    bridge Docker.
-   Flujo final:

```{=html}
<!-- -->
```
    Contenedor → Gateway (172.17.0.1) → sshd EC2 → túnel SSH → MySQL local

------------------------------------------------------------------------

## 6️⃣ Redeploy y verificación final

``` bash
docker compose -f compose.prod.yml up -d --force-recreate orders
docker compose -f compose.prod.yml logs -f orders
```

------------------------------------------------------------------------

# 🎯 Resultado Final

Los microservicios Docker en EC2 pueden conectarse al MySQL que corre en
la máquina local **sin exponer el puerto públicamente**, usando túnel
SSH inverso persistente con autossh y systemd.

------------------------------------------------------------------------

**Documento técnico generado para referencia interna --- Teamcellmania
2026**
