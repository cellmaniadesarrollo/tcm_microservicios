/** Tipo de identificación del proveedor. FOREIGN_ID cubre proveedores internacionales sin RUC ni pasaporte. */
export enum IdentificationType {
    RUC = 'RUC',
    CEDULA = 'CEDULA',
    PASSPORT = 'PASSPORT',
    FOREIGN_ID = 'FOREIGN_ID',
}