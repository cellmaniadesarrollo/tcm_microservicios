Necesito crear un endpoint siguiendo mi arquitectura NestJS con gateway + microservicio.

## Arquitectura general
- El gateway recibe las requests HTTP y las reenvía al microservicio via RabbitMQ usando `ClientProxy.send()`
- El microservicio recibe los mensajes con `@MessagePattern`
- El gateway incluye siempre `internalToken: process.env.INTERNAL_SECRET` en el payload — el MS lo valida mediante un interceptor (no lo implementes, solo inclúyelo en el objeto enviado)
- Los errores en el MS se lanzan como `RpcException` wrapeando excepciones HTTP (`NotFoundException`, `ForbiddenException`, etc.)
- El gateway tiene un interceptor global que convierte los `RpcException` a respuestas HTTP correctas (no lo implementes, solo lanza `RpcException` en el MS)
- La autenticación usa `@Auth()` + `@Features('nombre-modulo')` a nivel de controller en el gateway
- El usuario autenticado se obtiene con `@User() user: any` → `user.sub`, `user.companyId`, `user.branchId`

## Decoradores de autorización en el gateway controller

### @Public()
- Saltea completamente la autenticación y los grupos
- Usar en rutas que no requieren token

### @Groups() — reglas
| Uso | Quién accede |
|---|---|
| Sin `@Groups()` | Ruta pública, sin validación |
| `@Groups()` vacío | Solo COMPANY_ADMIN y ADMINS |
| `@Groups('CASHIERS')` | CASHIERS + COMPANY_ADMIN + ADMINS |
| `@Groups('CASHIERS', 'SUPPORT')` | CASHIERS + SUPPORT + COMPANY_ADMIN + ADMINS |
| `@Groups('COMPANY_ADMIN')` | SOLO COMPANY_ADMIN (otros admins NO) |
| `@Groups('COMPANY_ADMIN', 'ADMINS')` | SOLO los admins listados |

**Regla clave:** los admins siempre pasan, EXCEPTO cuando un admin está listado
explícitamente en `@Groups()` — en ese caso solo acceden los admins indicados.

## DTOs del microservicio
- Todos los campos deben tener decoradores de `class-validator`
- Campos opcionales usan `@IsOptional()` + su decorador de tipo
- Campos requeridos usan `@IsNotEmpty()` + su decorador de tipo

## Lo que necesito
[DESCRIBE AQUÍ TU ENDPOINT: qué hace, qué recibe, qué devuelve, qué grupo requiere]

## Dame estos archivos
1. DTO del gateway (con decoradores class-validator)
2. DTO del microservicio (con decoradores class-validator)
3. Método en el gateway controller (con decoradores correctos: @Groups, @Public si aplica)
4. @MessagePattern en el MS controller
5. Método en el MS service