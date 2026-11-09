# AGENTS.md — aws-s3 (almacenamiento de archivos)

> Reglas de mantenimiento: ver **sección 0 del AGENTS.md raíz del MS**.
> Solo se corrige lo verificado; lo no verificado se conserva tal cual.
> Los marcadores `[ENTREGADO, SIN PROBAR]` y `(verificar)` se quitan solo con
> código visto o prueba ejecutada.

## 1. Servicio
`AwsS3Service` (módulo `AwsS3Module`, **verificar path/nombre al importarlo**;
copiar el import de `ReceiptsModule`). Config por `ConfigService`:
`AWS_REGION`, `AWS_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

## 2. Métodos
- `uploadBuffer(buffer, originalName, mimeType, pathPrefix = '')` → devuelve la
  **key** `"{prefix}{uuid}-{originalName}"`. Lanza
  `InternalServerErrorException` si falla. Objeto privado (sin ACL pública).
- `getPresignedUrl(keyOrUrl, expiresIn = 1800)` → URL firmada **localmente**
  (30 min). Si falla **devuelve la entrada original** (no lanza): el front
  recibiría la key cruda y debe comprobar que `url` empiece por `http`.
- `deleteObject(key)` → **no lanza** (loguea). Por eso se usa libremente en
  limpiezas.

## 3. Reglas de uso
- En BD solo se guarda la key.
- Subir **antes** de la transacción; limpiar en `catch` y `replay`
  (convención en la raíz, sección 4).

## 4. Prefijos en uso
- `receipts/{companyId}/{receiptId}/` (documento, fotos y XML)
- `receipts/{companyId}/{receiptId}/payments/` (comprobantes)
- `stock-vouchers/{companyId}/{voucherId}/` (fotos de líneas de vales)

## 5. Pendientes
Barrer archivos huérfanos de S3 contra las tablas (raíz, pendiente 23).