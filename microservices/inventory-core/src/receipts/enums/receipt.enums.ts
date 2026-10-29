export enum ReceiptStatus {
    REGISTERED = 'REGISTERED', // guardado: el stock YA ingresó; falta que alguien lo verifique
    VERIFIED = 'VERIFIED',     // alguien lo revisó contra el documento físico
    VOIDED = 'VOIDED',         // anulado con movimientos contrarios; nunca se borra
}

export enum ReceiptSource {
    MANUAL = 'MANUAL',
    ACCESS_KEY = 'ACCESS_KEY', // importado con la clave de acceso (futuro)
}
export enum AttachmentKind {
    DOCUMENT = 'DOCUMENT', // factura/recibo escaneado o foto
    PHOTO = 'PHOTO',       // foto de la mercadería recibida
}

export enum PaymentStatus {
    UNPAID = 'UNPAID',   // nace así
    PARTIAL = 'PARTIAL', // abono parcial
    PAID = 'PAID',
}
export enum PaymentMethod {
    CASH = 'CASH',
    TRANSFER = 'TRANSFER',
    CHECK = 'CHECK',
    CARD = 'CARD',
    OTHER = 'OTHER',
}