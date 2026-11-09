# AGENTS.md — sri (consulta SRI por clave de acceso)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual.
> Los marcadores `[ENTREGADO, SIN PROBAR]` y `(verificar)` se quitan solo con
> código visto o prueba ejecutada.

Importación de facturas electrónicas por clave de acceso. Alimenta el
formulario de ingresos (`receipts/AGENTS.md`).

## 1. Archivos y dependencias
- `access-key.helper.ts`, `sri-client.service.ts` (fetch SOAP +
  `fast-xml-parser`, sin XXE), `invoice-parser.ts`, `sri.service.ts`,
  `sri.controller.ts`, `sri.module.ts`.
- `ReceiptsModule` importa `SriModule` (exporta `SriClientService`).
  `SriModule` importa `ProductsModule` (exporta `ProductsService`).

## 2. Comportamiento
- Valida la clave localmente: 49 dígitos, módulo 11, fecha, tipo `01` factura.
- Comprueba duplicado (`canImport`, `existingReceipt`).
- Consulta al SRI (SOAP `AutorizacionComprobantesOffline`, 7 s × 2 intentos;
  ambiente TEST usa `celcer`), lee cabecera y líneas del XML.
- SRI caído: **no bloquea**; `sri.available=false`, líneas vacías.

## 3. Gateway (repo aparte): `POST /sri/access-key/preview`
Ubicación: `gateway/src/inventory-core/sri/`. Respuesta:
- `supplier`: forma idéntica al item de `suppliers/search` si el RUC existe; si
  no, `null` + `supplierDraft` (RUC, razón social, nombre comercial, dirección,
  país Ecuador, `source: SRI|ACCESS_KEY`) + `supplierForm` (tipos de
  identificación y países) para el modal del front.
- `lines[]`: datos de la factura + `match.status`:
  - `MAPPED`: con `product` **idéntico** a un item de `products/search` y
    `suggestion { quantity, unitCost }` convertidos por `unitFactor`.
  - `UNMAPPED`: `reason` ∈ `NO_MAPPING | NO_CODE | PRODUCT_INACTIVE`.
  - `NON_INVENTORY`.
- `documentTotals`, `sri { available, state, ... }`, `warnings`.

## 4. Estado
Construido y en uso (según el historial previo).

## 5. Pendientes
Relacionados (en `receipts/`): 4 (subir XML manual, crear proveedor desde la
importación) y 5 (sugerencias por similitud).

## 6. Errores y lecciones
- Ninguno propio registrado. La clave de acceso es ayuda, no imposición (ver
  `receipts/AGENTS.md`, regla 10).