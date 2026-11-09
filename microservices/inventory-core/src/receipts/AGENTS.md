# AGENTS.md — receipts (ingresos de mercadería)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**
> (`microservices/inventory-core/AGENTS.md`). No se duplican aquí.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual; los
> marcadores `[ENTREGADO, SIN PROBAR]` y `(verificar)` se quitan solo con
> código visto o prueba ejecutada.

Ingresos de mercadería: cabecera, líneas, adjuntos, pagos y códigos de
proveedor. Guardar un ingreso **mueve stock** a través de `StockService`
(ver `stock/AGENTS.md`). Incluye la importación por clave de acceso del SRI
(ver `sri/AGENTS.md`).

## 1. Archivos clave y dependencias

- `receipts.service.ts`: `create`, `list`, `getDetail`, `getNewData`, pagos
  (`add_receipt_payment`, `void_receipt_payment`, `list_receipt_payments`),
  `learnSupplierCodes`, uploads, `fetchSourceXml`.
- `receipts.controller.ts`: comandos `get_receipt_new_data`, `create_receipt`,
  `list_receipts`, `add_receipt_payment`, `void_receipt_payment`,
  `list_receipt_payments`, `get_receipt_detail`. Usa `run` solo en parte de los
  handlers (el resto trae su propio try/catch; mismo efecto).
- `entities/` (ver sección 2).
- `enums/receipt.enums.ts`: `ReceiptStatus`, `ReceiptSource`, `AttachmentKind`,
  `PaymentStatus`, `PaymentMethod`.
- Los comandos `search_products_for_receipt` y `search_suppliers` **no** están
  en `receipts.controller.ts`: viven en otros controllers **(verificar
  dónde)**.

**Módulos a importar en `ReceiptsModule`:** `CompaniesModule`
(`MainBranchService`), `StockModule`, `SequencesModule`, `AuditLogModule`,
`AwsS3Module`, `SriModule`, `LabelsModule` (impresión al registrar; sin
circularidad porque `labels` solo lee entidades).
## 2. Modelo de datos

| Entidad | Tabla | Notas clave |
|---|---|---|
| `Receipt` | `receipts` | Estados `REGISTERED / VERIFIED / VOIDED`; `source MANUAL / ACCESS_KEY`; `payment_status`, `paid_total` (CHECK `0 ≤ paid ≤ total`); `client_request_id`, `request_hash`; `access_key`, `authorization_number/date`, `xml_file_key`; trazabilidad `created/verified/voided_*`. Índices únicos: código (`uq_receipts_…`), `(empresa, proveedor, tipo, nº documento)` (`uq_receipts_supplier_document`), `(empresa, access_key)` (`uq_receipts_company_access_key`, excluye VOIDED) y `uq_receipts_company_client_request`. |
| `ReceiptLine` | `receipt_lines` | `affects_inventory`; `product_id`/`sale_price` nulos si no afecta inventario (CHECK `chk_receipt_lines_inventory`); lado compra (costo, descuento total, `purchase_tax_code/rate`); config del lote; `supplier_code/description/quantity` (lo que decía el documento); `supplier_product_code_id`; `lot_id`. Sin tabla de seriales. |
| `ReceiptAttachment` | `receipt_attachments` | `kind DOCUMENT / PHOTO`. `file_key` (S3), `original_name`, `mime_type`, `size_bytes`, `sort_order`, `created_by_id`, `company_id`. DOCUMENT: uno por ingreso (índice único parcial), sin línea. PHOTO: obligatoriamente ligada a una línea (`receipt_line_id`, CHECK `chk_receipt_attachments_line`). FK con `CASCADE`. |
| `ReceiptPayment` | `receipt_payments` | Pagos/cuotas: `amount > 0`, `paid_at`, `method`, `reference`, `note`, comprobante (`proof_key/name/mime/size`), `client_request_id` (`uq_receipt_payments_client_request`). **Nunca se borra, se anula** (`voided_at/by`, `void_reason`). |
| `SupplierProductCode` | `supplier_product_codes` | Código del proveedor → producto **o** `is_non_inventory`. Único `(empresa, proveedor, código)`. `unit_factor` = unidades nuestras por unidad del proveedor (se aprende solo). |
| `ReceiptDocumentType` | `receipt_document_types` | `forces_billable_lot`: fuerza `billableInSales = true` en todas las líneas. Seed: 01 FACTURA (fuerza), 03, 04, 05, 06, 07, S/N RECIBOS, S/NR DEVOLUCION DE PRODUCTOS (siembra en `catalogs/AGENTS.md`). |

`StockUnitSerial` (`stock_unit_serials`) se documenta en `stock/AGENTS.md`.

Eliminados: `ReceiptLineSerial`, `ReceiptPaymentEvent` (reemplazado por pagos
reales).

## 3. Reglas de negocio

1. **Guardar un ingreso ya mueve stock** (lotes, saldos, unidades
   serializadas, kardex `RECEIPT_IN`). No hay borrador. "Verificar"
   (`VERIFIED`) solo significa que alguien lo revisó contra el documento; no
   toca stock. Un usuario distinto o el mismo pueden verificar.
2. **Anular** = movimientos contrarios (`RECEIPT_VOID`), nunca borrar. Debe
   exigir que el lote no se haya consumido y que `paid_total = 0` (o anular
   antes los pagos). **Pendiente.** "Lote sin consumir" = `on_hand =
   quantity_received` **y** sin unidades `ISSUED`: una salida manual pendiente
   de retorno bloquea la anulación.
3. **`forcesBillableLot`:** si el tipo de documento lo tiene, el servidor
   fuerza `billableInSales = true`. `billableInRepairOrders` exige
   `billableInSales`.
4. **El front manda** `salePrice` y `warrantyDays` (decide quien ingresa); las
   banderas son opcionales y se completan desde el producto.
5. **Seriales/IMEI:** productos `SERIAL` (todo `DEVICE`): `quantity` = número
   de equipos; cada equipo (`units[].serials`) trae 1–4 IMEI. No se repiten
   dentro del ingreso ni contra stock existente. Productos por cantidad no
   llevan seriales. Unicidad hoy por `(empresa, producto, valor)`; **decisión
   pendiente** de hacerla global por empresa (pendiente 15 en `stock/`).
6. **Línea sin inventario** (`affectsInventory: false`): transporte,
   servicios, etc. Sin producto, lote, precio ni garantía; exige
   `description`. **Sí suma** a subtotal/descuento/impuesto/total (el total
   debe cuadrar con el documento y con los pagos). El transporte no se prorratea
   al costo (no hay *landed cost*).
7. **Pagos:** el estado de pago se **calcula** (`0` → UNPAID, parcial →
   PARTIAL, `= total` → PAID), nunca se marca a mano. Cuotas ilimitadas (hasta
   50 iniciales en `create`); la suma de pagos vigentes jamás supera el total
   (409 con saldo). Se bloquea la fila del ingreso al pagar. Comprobante
   opcional (PDF/imagen). Pagos iniciales pueden venir dentro de `POST /receipts`
   (`payments[]`, comprobantes `proof_<n>`), en la misma transacción. Límites:
   monto hasta 2 decimales, fecha no futura, referencia ≤ 100, nota ≤ 500.
8. **Archivos del ingreso:** fotos `photos_<n>` (n = índice de línea base 0),
   máx. 5 por línea; documento `document` (PDF o imagen, uno). Límites de
   servicio: documento 10 MB, foto 5 MB, comprobante 5 MB.
9. **Aprendizaje de códigos del proveedor:** al guardar, cada línea con
   `supplierCode` hace upsert `código → producto` (gana lo último; si cambia
   de destino se audita `before/after`). Si `supplierQuantity` difiere de
   `quantity`, se aprende `unitFactor = quantity / supplierQuantity` (cajas →
   unidades). Líneas sin inventario enseñan `is_non_inventory`. Mismo código con
   destinos distintos en el mismo ingreso → 400. Solo aprende si el ingreso se
   guarda (misma transacción).
10. **Clave de acceso es una ayuda, no una imposición:** nada de la factura se
    fuerza; el usuario edita cantidad, costo, proveedor, fecha. Si `accessKey`
    viene en `create`: `source = ACCESS_KEY`, se reconsulta al SRI, se guarda
    el XML en S3 + autorización. Si el SRI falla, el ingreso se guarda igual
    sin XML. Misma clave no se importa dos veces (índice único, excluye
    anulados).
11. **Auditoría del documento:** el XML guardado + `supplier_*` por línea
    permiten comparar después lo ingresado contra la factura real (comparador
    pendiente, pendiente 1).
12. **Costos:** descuento = monto TOTAL de la línea; costo del lote = costo
    neto por unidad `(cantidad × costo − descuento) / cantidad`, 4 decimales,
    sin impuesto (convenciones de dinero en la raíz, sección 4).
13. **Prefijos S3:** `receipts/{companyId}/{receiptId}/` (documento, fotos y
    XML) y `receipts/{companyId}/{receiptId}/payments/` (comprobantes). Ver
    `aws-s3/AGENTS.md`.
14. **Etiquetas al registrar [ENTREGADO, SIN PROBAR]:** `create_receipt` acepta `labels`
    (`{ printer, items: [{ lineIndex, cant }] }`) en la raíz del JSON `data`. `create()` lo
    separa del DTO antes de `normalizeInput` (no entra al hash). Se valida antes de tocar S3
    (`assertLabelRequest`: línea existente, con inventario y sin repetir) y se imprime
    **después del commit** con `printAfterCreate`, que nunca lanza. Con `replayed: true` no
    imprime. La respuesta añade `print` solo si se pidió. Contrato completo y lecciones en
    `labels/AGENTS.md`.
 ## 4. Gateway (repo aparte)

Ubicación: `gateway/src/inventory-core/receipts/` (`receipts.controller.ts`,
`receipts.service.ts`, `dto/`, `helpers/`). Ruta base `/receipts`, o
`/inventory-core/receipts` según RouterModule **(verificar)**.

### 4.1 Endpoints

| Método y ruta | Comando MS | Descripción |
|---|---|---|
| `GET new-data` | `get_receipt_new_data` | Formulario: sucursal principal, tipos de documento (con `forcesBillableLot`), `paymentMethods`, fecha por defecto, enums. Proveedores y productos van por sus buscadores. |
| `GET products/search` | `search_products_for_receipt` | Buscador de productos para ingreso (`search`, `limit`, `kind`, `supplierId`). Cada item: datos, `models`, `defaults`, `lastReceipt` y `supplierCodes`. |
| `GET suppliers/search` | `search_suppliers` | Buscador de proveedores. |
| `POST /` | `create_receipt` | **multipart**: `data` (JSON), `document`, `photos_<n>`, `proof_<n>`. Crea ingreso + stock + pagos + adjuntos. |
| `GET /` | `list_receipts` | Listado: búsqueda por proveedor, nº/tipo de documento, producto (nombre, SKU, marca, modelo, código técnico, **descripción de línea**, incluye líneas sin inventario), código de ingreso, IMEI (≥6 chars). Filtros: fechas, `status`, `paymentStatus`, `documentTypeId`, `productId`, orden. **No existe filtro `supplierId`**. `includeFilters=true`. Cada item trae `paymentStatus`, `paidTotal`, `balance`. |
| `GET :id` | `get_receipt_detail` | Detalle completo (líneas con `product` nulo si no afecta inventario, lote, existencias, equipos con IMEI, pagos con comprobantes firmados, documento y fotos firmadas, auditoría, `source/accessKey/hasSourceXml`). |
| `GET :id/payments` | `list_receipt_payments` | Pagos + totales + `paymentMethods`. **(verificar)** El handler del MS existe; en el gateway pegado no aparece ni la ruta ni el método del service. |
| `POST :id/payments` | `add_receipt_payment` | **multipart**: `data` + `proof`. Idempotente por `clientRequestId`. El payload al MS lleva `file` (no `files`). |
| `PATCH :id/payments/:paymentId/void` | `void_receipt_payment` | Anular pago con `reason` (3–500). Recalcula estado. |
| `POST /` | `create_receipt` | **multipart**: `data` (JSON, con `labels` opcional), `document`, `photos_<n>`, `proof_<n>`. Crea ingreso + stock + pagos + adjuntos y, si viene `labels`, imprime tras el commit (respuesta con `print`). |

Eliminados: `PATCH :id/payment-status`, `GET :id/payment-history`,
`GET filters`. Rutas literales (`new-data`, `products/search`,
`suppliers/search`) van **antes** de `:id`.

### 4.2 Helpers de archivos (gateway)

- `receipts/helpers/receipt-attachments.helper.ts` →
  `prepareReceiptFiles(files, lineCount, paymentCount)` / tipo
  `ReceiptFilesPayload`. Campos: `document` (PDF o imagen, 1), `photos_<n>`
  (n = línea base 0, máx. 5 por línea, solo imágenes), `proof_<n>` (n = pago
  base 0, 1 por pago). Límites ya procesado: documento 10 MB, foto 5 MB,
  comprobante 5 MB, **25 MB en total** (viaja en base64 por RabbitMQ).
- `receipts/helpers/receipt-payment-proof.helper.ts` →
  `preparePaymentProof(files)` (campo `proof`).
- El controller de ingresos aún trae copias locales (`flatten`,
  `buildReceiptDto`, `buildDto`) que deben migrarse a `parseJsonField`
  (raíz, pendiente 25).
- `create-receipt-gateway.dto.ts` declara `ReceiptLabelItemGatewayDto` y
  `ReceiptLabelsGatewayDto` (campo opcional `labels` al final de
  `CreateReceiptGatewayDto`). Reutiliza el enum `PrinterType` de
  `gateway/.../labels/dto/print-labels.dto.ts` **(verificar ruta del import)**. El controller y
  el service del gateway no cambiaron: el `dto` completo viaja al MS.

### 4.3 SRI
`POST /sri/access-key/preview`: contrato completo en `sri/AGENTS.md`.

## 5. Estado

| Componente | Estado |
|---|---|
| Ingresos, pagos, productos, proveedores | Construido y en uso (según el historial previo). |
| Búsqueda por descripción de línea (`lineProductSearchSql` con `LEFT JOIN`) | Ya aplicada. |
| `GET :id/payments` en el gateway | **(verificar)** ruta y método del service. |
| Verificar / anular ingreso, comparador de auditoría, edición | No construidos (ver pendientes). |
| Etiquetas al registrar (`labels` en `create_receipt`, `printAfterCreate`) | **ENTREGADO, SIN PROBAR.** **(verificar)** `this.logger`, constructor con `LabelsService`, tipo `CreateReceiptInput`. |
## 6. Pendientes (numeración conservada)

1. **Comparador de auditoría** `GET receipts/:id/source-document`: leer XML de
   S3 y comparar línea a línea (cantidad, costo, descuento, impuesto) contra
   lo ingresado.
2. **Verificar** (`REGISTERED → VERIFIED`) y **anular** ingreso
   (`RECEIPT_VOID`, exige lote sin consumir —`on_hand = quantity_received` y
   sin unidades `ISSUED`— y pagos en cero), auditados.
3. Edición de ingreso (solo si el lote no se ha movido): delicado, no
   iniciado.
4. Subir XML manualmente (reusa el parser) y crear proveedor desde la
   importación (el modal es del front; endpoint de proveedores existente).
5. Sugerencias por similitud para líneas `UNMAPPED`; aprender por descripción
   cuando no hay código.
6. Confirmar ruta/método gateway de `GET :id/payments`
   (`list_receipt_payments`).
21. Resolver **nombres de usuario** con `user_employee_cache` en **ingresos**
    (listado, detalle, pagos e historial); en vales ya se devuelven nombres.
7. **Etiquetas:** probar el flujo completo (ingreso con `labels`, fallo de impresora sin
   deshacer el ingreso, `replayed` sin imprimir). Pendientes propios en `labels/AGENTS.md`
   (L12 a L14).

Pendientes de la raíz que afectan a este módulo: 22 (permisos de pagos y
anulaciones), 25 (migrar a `parseJsonField`).

## 7. Errores y lecciones propios del módulo

- `data.files` no se pasaba al servicio en el controller del MS → adjuntos no
  se guardaban. El handler debe llamar
  `create(dto, companyId, userId, data.files ?? {})`.
- Firma del service del gateway desalineada (`create(dto, files, user)`) →
  error TS "esperaban 2 argumentos, se obtuvieron 3".
- Entidades nuevas sin registrar en `forFeature` → "no existe la relación …".
- `getPresignedUrl` devuelve la key cruda si falla la firma: el front debe
  comprobar que `url` empiece por `http`.
- No loguear base64 completo; solo resumen (nombre, tamaño, índice).
- No ejecutar nada que pueda lanzar dentro del `try` de `create()` después del commit: el
  `catch` hace `cleanupAll()` y borraría los adjuntos de un ingreso ya guardado. La impresión
  va en `printAfterCreate`, que captura todo.
  
## 8. Cómo actualizar este archivo
Al cambiar reglas, entidades, comandos o el contrato de ingresos: actualizar
las secciones 2–4. Si el cambio toca stock, `stock/AGENTS.md`; si toca la
importación SRI, `sri/AGENTS.md`. Reglas completas en la sección 0 de la raíz.   