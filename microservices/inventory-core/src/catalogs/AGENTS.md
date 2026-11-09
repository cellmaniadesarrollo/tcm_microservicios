# AGENTS.md — catalogs (seeds al arrancar)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual.
> Los marcadores `[ENTREGADO, SIN PROBAR]` y `(verificar)` se quitan solo con
> código visto o prueba ejecutada.

## 1. `CatalogsService`
Implementa `OnApplicationBootstrap`: siembra países (global) y, para **todas**
las empresas replicadas, tipos de documento (`ReceiptDocumentType`) y, desde
los vales, motivos de movimiento (`StockMovementReason`).

## 2. Patrón
- Transacción + `pg_advisory_xact_lock` (claves `730_100_2` tipos de
  documento, `730_100_3` motivos) + `insertMissing(...)` con `orIgnore()` en
  bloques de 500. **No pisa lo que un admin editó.**
- Para empresas nuevas hay un método individual por catálogo
  (`seedReceiptDocumentTypes(companyId)`, `seedStockMovementReasons(companyId)`)
  que debe llamarse **donde ya se llama la siembra de la empresa nueva**
  **(verificar dónde y que el de motivos esté enganchado)**.
- La entidad de motivos vive en `stock-vouchers/`, pero la siembra está aquí a
  propósito: evita dependencia circular entre módulos.

## 3. Seeds
- Tipos de documento: ver `receipts/AGENTS.md` sección 2.
- Motivos de movimiento: ver `stock-vouchers/AGENTS.md` sección 3
  (`seeds/stock-movement-reasons.seed.ts`).

## 4. Estado
Seed de motivos **ENTREGADO como parche**; falta enganchar
`seedStockMovementReasons(companyId)` al flujo de empresa nueva.

## 5. Errores y lecciones
- Cada claves de advisory lock debe ser única por catálogo; al agregar un
  catálogo nuevo, tomar una clave nueva.