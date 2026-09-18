// microservices/orders/src/order-part-requests/dto/encontrado-nacional.dto.ts

export interface EncontradoNacionalDto {
    id: number;

    // Proveedor: si viene providerId, se reutiliza (se ignora "proveedor").
    // Si no viene, "proveedor" es obligatorio y se crea uno nuevo.
    providerId?: number;
    proveedor?: string;

    precio: number;
    cantidad?: number;
    contactoProveedor?: string;
    linkCompra?: string;
    notas?: string;
    precioVenta?: number;
    precioTransporte?: number;

    // Cuenta bancaria: si viene providerAccountId, se reutiliza (se ignoran los 4 campos).
    // Si no viene, esos 4 campos son obligatorios y se crea una cuenta nueva bajo el provider.
    providerAccountId?: number;
    banco?: string;
    numeroCuenta?: string;
    tipoCuenta?: string;
    titularCuenta?: string;
}