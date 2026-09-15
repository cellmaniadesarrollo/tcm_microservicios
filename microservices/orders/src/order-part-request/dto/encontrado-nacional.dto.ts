// microservices/orders/src/order-part-requests/dto/encontrado-nacional.dto.ts

export interface EncontradoNacionalDto {
    id: number;
    proveedor: string;
    precio: number;
    cantidad?: number;
    contactoProveedor?: string;
    linkCompra?: string;
    notas?: string;
    precioVenta?: number;
    banco?: string;
    numeroCuenta?: string;
    tipoCuenta?: string;
    titularCuenta?: string;
    precioTransporte?: number;
}