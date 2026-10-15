export enum TrackingMode {
    QUANTITY = 'QUANTITY', // saldo por lote/sucursal/ubicación
    SERIAL = 'SERIAL',     // una fila por unidad física (IMEI/serial)
}

export enum BillingMode {
    YES = 'yes',
    NO = 'no',
    OPTIONAL = 'optional',
}