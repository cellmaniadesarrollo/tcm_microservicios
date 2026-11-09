# AGENTS.md — labels
> Reglas de mantenimiento: ver la sección 0 del AGENTS.md raíz.
> Este archivo solo tiene lo específico del módulo; lo transversal está en la raíz.
> Estado: [ENTREGADO, SIN PROBAR].

Impresión de etiquetas de lote en Dymo o Zebra. Solo lee; nunca escribe inventario.

## Archivos
MS: `labels.module.ts` (exporta `LabelsService`), `labels.controller.ts` (helper `run`),
`labels.service.ts`, `labels.types.ts` (`PrinterType`, `LabelPayload`),
`printers/printer.client.ts`.
Gateway: `gateway/src/inventory-core/labels/` (`labels.controller.ts`, `labels.service.ts`,
`dto/print-labels.dto.ts`, que también declara el enum `PrinterType` del gateway).
Lee con `DataSource`; no necesita `forFeature`.
`ReceiptsModule` importa `LabelsModule` para imprimir al registrar un ingreso.

## Comandos
| Gateway | Comando MS | Payload al MS | Descripción |
|---|---|---|---|
| `POST /labels/print` | `print_labels` | `{ dto, user }` | Imprime `items[{ lotId, cant }]` en `printer`. |
| `GET /labels/receipts/:receiptId/lines` | `get_receipt_label_lines` | `{ receiptId, user }` | Líneas con inventario del ingreso + cantidad sugerida. |

Además, `create_receipt` acepta `labels` (ver sección "Impresión al registrar un ingreso").

## Reglas
1. El front manda `printer` (DYMO|ZEBRA) y `items[{lotId, cant}]`. El servidor arma toda la
   etiqueta desde la base. La cantidad la decide el usuario (el front precarga
   `ReceiptLine.quantity`; el MS no la limita a ese valor).
2. Sin respaldo: si la impresora elegida falla, se informa; no se usa la otra.
3. Un ítem fallido no cancela los siguientes (se imprime en serie, uno por ítem). Si algún
   lote no existe o es de otra empresa, no se imprime nada (400).
4. Sin idempotencia ni auditoría (no cambia estado). Cada llamada imprime; el front
   deshabilita el botón mientras espera.
5. Transporte: Dymo `POST {LABEL_DYMO_URL}/api/printtikets` (JSON); Zebra
   `GET {LABEL_ZEBRA_URL}/api/printtikets?...&key=` (solo GET).
   Env: `LABEL_DYMO_URL`, `LABEL_ZEBRA_URL`, `LABEL_ZEBRA_KEY`, `LABEL_PRINT_TIMEOUT_MS`
   (def. 20000). Dymo no usa token.
6. No loguear la URL de la Zebra (lleva el token). Solo código HTTP o tipo de error.
7. **El resultado se decide por código HTTP, no por el JSON del servidor de impresión.**
   2xx = impreso; otro código = fallo (mapeo en `messageForStatus`). El cuerpo se descarta.
   Los mensajes al front son del MS. Zebra confirmado con su controller
   (`imprimirEtiquetaDinamica`): 200 solo si imprimió, 500 si falló. Dymo: (sin confirmar).
8. Desde la lista de ingresos hay dos botones por fila (Dymo y Zebra); cada uno solo fija
   `printer`. El front llama a `get_receipt_label_lines` y luego a `print_labels`.
   Solo lectura. Ingreso anulado → 400; inexistente o de otra empresa → 404.
   La regla de bloquear anulados es (asumido).
9. **La impresión nunca va dentro de la transacción ni del `try` de
   `ReceiptsService.create()`**: se dispara después del commit (ver sección siguiente).
10. Límites en el MS: 50 ítems por solicitud y `cant` entre 1 y 999 (asumido; los límites
    reales los pone el servidor de impresión). No se recortan los textos.

## Impresión al registrar un ingreso
- El front manda `labels` en la raíz del JSON `data` de `POST /receipts`:
  `{ printer, items: [{ lineIndex, cant }] }`. Opcional; sin él, el ingreso no imprime.
- `lineIndex` = índice de la línea en `lines` (base 0, como `photos_<n>`); solo líneas con
  inventario; sin repetir. Una etiqueta inválida da 400 **antes** de subir nada a S3.
- `ReceiptsService.create()` separa `labels` del DTO **antes** de `normalizeInput`, así no
  entra al hash de idempotencia (el hash no cambia). El gateway lo declara en
  `CreateReceiptGatewayDto` (`ReceiptLabelsGatewayDto`), si no `forbidNonWhitelisted` da 400.
- Tras el commit, `printAfterCreate` resuelve `lineIndex → lotId` con `receipt_lines`
  (`lineNo = lineIndex + 1`) y llama a `LabelsService.print`. **Nunca lanza**: un fallo de
  impresión no deshace el ingreso.
- Con `replayed: true` nunca se imprime (un reintento no duplica etiquetas).
- Respuesta: la del ingreso + `print: { ok, printer, items: [{ lineIndex, lotId, cant, ok, message }] }`
  solo si se pidió. Si no se pudo ni preparar: `print: { ok: false, items: [], message }`.
- Reimpresión: `POST /labels/print` con los `lotId` que vienen en `print.items`.

## Mapeo de la etiqueta
| Campo | Fuente |
|---|---|
| `topText1` | primer `models.models_name` (alfabético) vía `product_models`; `-` si no hay (asumido) |
| `topText2` | `ProductName.name + ' ' + Quality.name` (calidad opcional) |
| `bottomText1` | `${Product.sku} - ${Lot.code}` |
| `cant` | del front |
| `price` | `Lot.salePrice` |
| `iva` | `Lot.priceIncludesTax` |
| `f` | `Lot.billableInSales ? 'C' : 'T'` (solo informa visualmente si el lote es facturable) |
| `qrText` | `S:{sku},BT:{lot.code},F:{Lot.createdAt en America/Guayaquil},P:{1ª letra de Supplier.businessName},B:true,U:{username de Lot.createdById},FA:{C\|T}` |

- Proveedor: `Lot.originId` → `receipt_lines` → `receipts` → `suppliers`. Vacío si el lote no
  viene de un ingreso (`ADJUSTMENT`, `OPENING`, `RETURN`).
- El QR es de formato libre: el lector solo detecta que es un QR. Ventas e inventario se
  adaptan a este formato, no al revés. El `O:` del legacy ya no existe.
- En serializados la etiqueta no lleva IMEI.

## Contrato
`POST /labels/print` → `{ "printer": "ZEBRA", "items": [{ "lotId": "uuid", "cant": 2 }] }`
Respuesta: `{ ok, printer, items: [{ lotId, cant, ok, message }] }`. `ok` global = todos los ítems ok.

`GET /labels/receipts/:receiptId/lines` →
`{ receiptId, receiptCode, lines: [{ lineId, lineNo, lotId, lotCode, sku, name, defaultQuantity }] }`
Solo líneas con inventario (las de transporte o servicios no tienen lote).

## Pendientes
L1. (sin confirmar) Qué imprime la plantilla con `iva = true` / `false`. El sentido cambió
    respecto al legacy (`!hasTax` → `priceIncludesTax`). Está en `generarZPL` del servidor de impresión.
L2. (sin confirmar) Límite real de `cant` en `generarZPL`; hoy 999 (asumido).
L3. Ya no aplica: el form de ingreso no depende de `summary()`; resuelve el lote por `receipt_lines`.
L4. (verificar) Rutas de import de `Lot`, `UserEmployeeCache`, `Receipt`, `ReceiptLine`,
    `ReceiptStatus` (¿existe `VOIDED` con ese nombre?) y columnas de `models` (`models_name`).
L5. (verificar) Nombre real de la propiedad `username` en `UserEmployeeCache`.
L6. (sin confirmar) Controller de la Dymo: que responda 200 solo cuando imprime.
L7. Registrar `LabelsModule` en `app.module.ts` (y en `ReceiptsModule`), y controller y service
    en el módulo del gateway que agrupa `inventory-core` (y en RouterModule si aplica).
L8. Rotar el token de nginx (estuvo en el código del front) y borrarlo del front al migrar.
L9. Roles/permisos de impresión: ver pendiente 22 de la raíz.
L10. Crear `.env.example` con las cuatro variables.
L11. [ENTREGADO, SIN PROBAR] Impresión en el formulario de registro de ingreso (ver sección arriba).
L12. Latencia: la impresión es en serie y dentro de la petición; con la impresora apagada cada
     ítem puede tardar hasta `LABEL_PRINT_TIMEOUT_MS` (20 s). Si molesta: bajar el timeout o
     imprimir en paralelo.
L13. (verificar) En `ReceiptsService`: que exista `this.logger`, cómo está declarado
     `CreateReceiptInput` y que el inyectado `LabelsService` compile. `normalizeInput` no se vio
     (por eso `labels` se separa antes de llamarlo).
L14. (verificar) Ruta relativa del import de `PrinterType` en
     `create-receipt-gateway.dto.ts` y que ambos enums `PrinterType` (MS y gateway) coincidan.

## Errores y lecciones
- No imprimir dentro del `try` de `ReceiptsService.create()`: su `catch` ejecuta
  `cleanupAll()` y borraría de S3 los adjuntos de un ingreso ya confirmado.
  `printAfterCreate` nunca lanza por esa razón.
- El MS no tiene `axios` ni `@nestjs/axios`: las llamadas HTTP salientes usan `fetch` nativo
  con `AbortController` (igual que `SriClientService`).
- `labels` no entra al hash de idempotencia de ingresos; `printer` y `cant` tampoco, porque
  se separan antes de normalizar.
- El mensaje de éxito que veía el front ("Etiqueta enviada a la impresora") venía del
  servidor de impresión; ahora los textos los pone el MS y el resultado se decide por HTTP.