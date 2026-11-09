# AGENTS.md — common (enums, helpers, sequences)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual.
> Los marcadores `[ENTREGADO, SIN PROBAR]` y `(verificar)` se quitan solo con
> código visto o prueba ejecutada.

## 1. Contenido
- `enums/product-kind.enum.ts`: `ProductKind`.
- `helpers/normalize-name.ts`.
- `helpers/search-sql.ts`: `norm`, `stripAccents`, `escapeLike`, `toTokens`.
- `sequences/`: `SequencesService`.

## 2. `SequencesService`
`reserve(em, companyId, key, count)`: UPSERT atómico de correlativos por
empresa. Claves en uso: `receipt_code`, `stock_voucher_code`. Uso:
`const code = await this.sequences.reserve(em, companyId, key)`.
Lotes y productos **no** lo usan (`MAX(code)+1` + advisory lock).
Error real: "no existe la relación company_sequences" → la entidad debe estar
en `forFeature`.

## 3. `search-sql.ts`
Búsqueda por palabras: cada palabra debe coincidir (AND) en algún campo (OR),
sin tildes ni mayúsculas, orden libre. Un entero puede coincidir con un `code`
exacto. **Aún no lo usan** el listado de vales ni el buscador de órdenes
(`stock-vouchers/` pendiente 10; `orders-relay/` pendiente 29). La firma
exacta no se ha visto en este hilo **(verificar)**.