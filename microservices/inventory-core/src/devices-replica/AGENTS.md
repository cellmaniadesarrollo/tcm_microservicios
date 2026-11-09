# AGENTS.md — devices-replica (marcas, modelos, códigos técnicos)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual.
> Los marcadores `[ENTREGADO, SIN PROBAR]` y `(verificar)` se quitan solo con
> código visto o prueba ejecutada.

## 1. Contenido
Réplica de `brand`, `model` y `model_technical_code`, con sync de modelos y de
códigos técnicos.

## 2. Tablas usadas en consultas crudas
- `brands (brands_id, brands_name)`
- `models (models_id, models_name, models_brands_id)`
- `model_technical_codes (mtc_models_id, mtc_code)`
- `product_models (product_id, model_id)` (pertenece a `products/`)

## 3. Uso
Búsqueda de productos por marca, modelo y código técnico (ingresos y
productos). Ver `products/AGENTS.md` y `receipts/AGENTS.md`.

## 4. Estado y pendientes
Sin más datos en el documento original; no verificado.