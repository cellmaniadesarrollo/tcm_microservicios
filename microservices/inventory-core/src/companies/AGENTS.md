# AGENTS.md — companies (empresas y sucursales)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual.
> Los marcadores `[ENTREGADO, SIN PROBAR]` y `(verificar)` se quitan solo con
> código visto o prueba ejecutada.

## 1. Contenido
`CompanyReplica`, `BranchReplica`, `MainBranchService`, listener Kafka.
`CompaniesModule` **exporta** `MainBranchService`.

## 2. `MainBranchService`
- `getMainBranchId(companyId, em?)`: sucursal principal. **Solución
  temporal:** sucursal activa cuyo nombre empieza con "Matriz".
- La usan ingresos y salidas de vales. Un retorno usa la sucursal del vale
  original.
- Inconsistencia conocida con el selector de lotes: ver `stock-vouchers/`,
  pendiente 26.

## 3. Relaciones
- Las FK hacia `CompanyReplica` sí existen (p. ej. `StockMovementReason`).
- Al crear una empresa nueva, deben llamarse los seeds por empresa
  (`catalogs/AGENTS.md`).

## 4. Estado y pendientes
Sin datos de estado propios en el documento original; no verificado.
Pendiente 17 (stock por sucursal con transferencias) en `stock/`.