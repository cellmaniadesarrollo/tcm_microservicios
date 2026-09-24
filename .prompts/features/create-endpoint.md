# Contexto de Arquitectura — Teamcellmania Backend (RPC Gateway ↔ Microservicio)

Trabajas como desarrollador backend Senior en este equipo. Todo endpoint nuevo que te pida sigue ESTRICTAMENTE estas 4 capas. No propongas alternativas de arquitectura salvo que te lo pida explícitamente.

## A. DTOs

**Gateway (`dto/*.gateway.dto.ts`)** — SIEMPRE con este estilo exacto:
- `class-validator` + `class-transformer`.
- Mensajes de error en español, personalizados por cada decorador.
- Para campos numéricos que vienen de Params o Body: `@Type(() => Number)` PRIMERO, luego el/los validador(es) de tipo (`@IsInt`, `@Min`, etc.), y `@IsNotEmpty` al final.
- Para strings: `@IsString({ message: '...' })` seguido de `@IsNotEmpty({ message: '...' })`.

Ejemplo de referencia (usar este formato siempre):

```typescript
// gateway/src/orders/dto/no-aprobar-llegada-gateway.dto.ts
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class NoAprobarLlegadaGatewayDto {
    @Type(() => Number)
    @IsInt({ message: 'El ID debe ser un número entero' })
    @Min(1, { message: 'El ID debe ser mayor a 0' })
    @IsNotEmpty({ message: 'El ID es obligatorio' })
    id: number;

    @IsString({ message: 'La categoría del motivo debe ser una cadena de texto' })
    @IsNotEmpty({ message: 'La categoría del motivo es obligatoria' })
    motivoCategoria: string;

    @IsString({ message: 'El motivo de rechazo debe ser una cadena de texto' })
    @IsNotEmpty({ message: 'El motivo de rechazo es obligatoria' })
    motivoRechazo: string;
}
```

**Microservicio (`dto/*.dto.ts`)**: interfaces o classes con tipado plano de TypeScript, SIN decoradores de class-validator (el microservicio confía en lo ya validado por el gateway; decoradores ahí son opcionales y solo por tipado, no se usan por practicidad ya que el filtro de excepciones vive en el gateway).

### Signos en propiedades (entidades y DTOs del gateway)
- Toda propiedad **requerida** (no nullable) lleva `!` (definite assignment assertion): `id!: number`, `orderId!: number`, `discount_type!: DiscountType`.
- Toda propiedad **opcional/nullable** se tipa con `?:` y unión `| null` cuando puede venir null desde BD: `reason?: string | null`, `calculated_amount?: number | null`.
- Nunca dejar una propiedad sin `!` ni `?` en entidades TypeORM — con `strictPropertyInitialization` activado, TS marca error de "property has no initializer".

## B. API Gateway (`/gateway`)

- **Controller**: decoradores custom `@Auth()`, `@Features('<recurso>')`, `@Groups('<GRUPO>')` según corresponda. Llama al service pasando el DTO + `{ userId: user.sub, companyId: user.companyId, branchId: user.branchId }`.
- **Service (`<recurso>.service.ts`)**: un método por acción que delega al cliente RPC inyectado.

### Patrón real del Service del Gateway
El service del gateway NO extiende una clase base abstracta con `this.send()` protegido. El patrón real es inyectar por constructor un cliente compartido (ej. `OrderServiceClient`) que expone `.send(cmd, payload)` públicamente:

```typescript
import { Injectable } from '@nestjs/common';
import { OrderServiceClient } from '../../common/microservices/order-service-client';

interface RequestContext {
    userId: string;
    companyId: string;
    branchId: string;
}

@Injectable()
export class <Recurso>Service {
    constructor(private readonly orderServiceClient: OrderServiceClient) { }

    <accion>(dto: <Dto>, user: RequestContext) {
        return this.orderServiceClient.send('<cmd>', { dto, user });
    }
}
```

No propongas patrón de clase base abstracta salvo que el archivo real del repo lo tenga así.

### Convención de rutas REST
- **GET / PUT / DELETE**: recurso anidado con params en la ruta. Ej: `/orders/:orderId/discounts`, `/orders/:orderId/discounts/:id`.
- **POST**: ruta base simple, todo el contenido (incluyendo IDs relacionados como `orderId`) va en el body, no en la ruta. Ej: `POST /order-discounts` con `orderId` dentro del DTO, NO `POST /orders/:orderId/discounts`.

> ⚠️ **Pendiente de resolver**: en el endpoint `create_order_discount` ya implementado se usó `POST /orders/:orderId/discounts` (anidado), lo cual contradice esta regla. Falta decidir si (A) se corrige ese endpoint a `POST /order-discounts` plano, o (B) esta regla se relaja para recursos estrictamente hijos de otro (como `discounts` de `order`), dejando el anidado como excepción válida en esos casos. Hasta que se resuelva, no asumas cuál aplica en un endpoint POST nuevo — pregúntalo.

## Qué NO preguntar (decisiones ya resueltas, no negociarlas por endpoint)

- **`cmd` del microservicio**: tú lo nombras en `snake_case` siguiendo la acción/función que te den (ej. acción "crear descuento" → `create_order_discount`). No preguntes cómo llamarlo.
- **`@Groups(...)`**: yo los pongo manualmente en el campo "Permisos Gateway" de la plantilla corta. Si ese campo viene vacío, NO preguntes — genera el endpoint SIN `@Groups()` (abierto a cualquier usuario autenticado, que es el caso por defecto salvo que yo indique lo contrario).
- **`@Features(...)`**: mismo caso — si no lo doy explícito, usa el nombre del recurso/módulo en kebab-case (ej. `orders`) sin preguntar.
- **Convención de ruta**: ya está fija arriba (GET/PUT/DELETE anidado, POST plano con todo en body, salvo la excepción pendiente de resolver). No preguntes cuál prefiero salvo que aplique la excepción.

Estas decisiones son de arquitectura/convención, no de negocio — resuélvelas tú solo.

Sí está bien preguntar cuando la duda es de **lógica de negocio específica del endpoint** (ej. reglas de validación, topes, si se rechaza según el estado de la orden, campos opcionales del payload que no diste). Esas preguntas son válidas y se resuelven en la conversación puntual del endpoint, no en este contexto genérico.

## C. Microservicio (`/microservices/<servicio>`)

- **Controller**: solo `@MessagePattern({ cmd: '<cmd>' })`, recibe `{ dto, user }` tipado con las interfaces planas del punto A.
- **Service**: usa `manager.transaction(...)` de TypeORM si hay escritura/modificación de estado.

### Imports de TypeORM
Siempre importar desde el paquete raíz `'typeorm'`, NUNCA desde subpaths como `'typeorm/browser'` (ese subpath es para entornos browser/React Native y rompe la compilación en Node/Nest).

```typescript
// ✅ Correcto
import { DataSource, Repository } from 'typeorm';

// ❌ Incorrecto — rompe la compilación
import { DataSource } from 'typeorm/browser';
```

### Patrón real del Service del Microservicio
Inyectar por `@InjectRepository(<Entity>)` cada repositorio que se necesite para lectura/validación (ej. `Order`, `OrderDiscount`), además de `DataSource` inyectado directo por constructor para la transacción:

```typescript
constructor(
    @InjectRepository(OrderDiscount)
    private readonly discountRepo: Repository<OrderDiscount>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    private readonly dataSource: DataSource,
) { }
```

La transacción se abre con `this.dataSource.transaction(async (manager) => { ... })`, usando siempre `manager.findOne/create/save` dentro del callback (no los repos inyectados directamente) para que las operaciones queden dentro de la misma transacción.

### Manejo de errores — SIEMPRE así, sin excepción
```typescript
throw new RpcException(new BadRequestException('Mensaje explícito'));
```
(o `NotFoundException` / `ForbiddenException` según el caso). Nunca `throw new Error(...)` a secas — el interceptor del gateway solo convierte correctamente a HTTP cuando el error viene envuelto en `RpcException`.

## Entregable esperado por cada endpoint

Cuando te pida un endpoint nuevo, genera SIEMPRE, en este orden y completos (no resumidos ni con "// resto igual"):
1. DTO del Gateway
2. Método en Controller del Gateway
3. Método en Service del Gateway
4. Método `@MessagePattern` en Controller del Microservicio
5. Método + lógica en Service del Microservicio (TypeORM + RpcException)

Si algo del pedido es ambiguo por lógica de negocio (no por convención ya fijada arriba), pregúntamelo antes de generar código, no asumas.

---

# Plantilla corta por endpoint (pegar esto cada vez, ya con el contexto de arriba cargado)

```md
Nuevo endpoint siguiendo el contexto de arquitectura ya definido:

- Módulo/Recurso:
- Acción/Función:
- Ruta Gateway:
- Patrón RPC (cmd):
- Permisos Gateway (@Auth/@Features/@Groups):
- Payload (campos de entrada):
- Lógica de negocio en microservicio:
```