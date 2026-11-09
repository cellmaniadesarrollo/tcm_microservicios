# AGENTS.md — users-employees-events (réplica de usuarios + selects)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual.
> Los marcadores `[ENTREGADO, SIN PROBAR]` y `(verificar)` se quitan solo con
> código visto o prueba ejecutada.

## 1. Archivos
- `users-employees-events.service.ts`: `findAllEmployeesBasic`,
  `findTechniciansByOrderType`, sync de usuarios.
- `users-employees-events.controller.ts`: comandos `get_employees_basic`,
  `get_technicians`.

## 2. Modelo
- `UserEmployeeCache` (`user_employee_cache`): `id` uuid, `username`,
  `first_name`, `last_name`, `dni`, `email`, `phone`, relación `company` →
  `CompanyReplica` con join column `company_id`, `groups`, `createdAt`,
  `updatedAt`. `GroupCache` (`group_cache`).
- **Copiadas del MS orders** (mismo código y mismo origen). Cliente RMQ
  `USER_ASYNC` (cola `users_queue_sync`). Propiedades en snake_case.
- Consulta por empresa: `where: { id, company: { id: companyId } }` (no hay
  columna `companyId` en la entidad). En `QueryBuilder` de vales se une por
  `e.id = v.employee_id` y se filtra la empresa por el vale.
- Se usa para validar que el empleado existe en la empresa y para mostrar
  nombres (`first_name + ' ' + last_name`).
- Sin FK desde tablas de negocio (`created_by_id`, `employee_id` son uuid
  sueltos).

## 3. Selects de empleados  [ENTREGADO, SIN PROBAR (gateway)]
- `get_employees_basic` → `findAllEmployeesBasic(user)`: todos los empleados
  de la empresa como `{ id, username, name }`. **`name` usa solo el primer
  nombre y el primer apellido** (`firstToken`), así que dos empleados pueden
  verse iguales. Sin paginación.
- `get_technicians` → `findTechniciansByOrderType(user, orderTypeId)`:
  empleados de los grupos de `ORDER_TYPE_GROUPS[orderTypeId]`, con `name`
  completo (`CONCAT`). Lanza `RpcException` si el tipo no tiene grupos.
- Ambos filtran con `employee.company_id` en el QueryBuilder **(verificar)**:
  contradice la nota de que la entidad no tiene columna `companyId`; confirmar
  el nombre real de la propiedad.

### Gateway (repo aparte)
`gateway/src/inventory-core/employees/` (`employees.controller.ts`,
`employees.service.ts`), sin módulo propio (**falta registrarlos** en el
módulo del gateway que agrupa `inventory-core`).
`GET /employees/basic` → `get_employees_basic` con `{ user }`. Sin parámetros
ni paginación. Respuesta `[{ id, username, name }]`. El front usa `id` como
`employeeId` del vale; si hay nombres repetidos, mostrar `name (username)`.
Sin orden garantizado: ordenar en el front.

## 4. Estado
Servicio MS existente; gateway **ENTREGADO, SIN PROBAR**. Verificar
`employee.company_id` en el QueryBuilder.

## 5. Pendientes
28. **Nombre completo en el select de empleados:** evaluar cambiar a nombre
    completo (como `get_technicians`) o a `name (username)` en el front.
Relacionado: 21 (nombres de usuario en ingresos) en `receipts/`.

## 6. Errores y lecciones
- Confirmar el nombre real de la propiedad de empresa antes de filtrar en
  QueryBuilder (ver `(verificar)` arriba).