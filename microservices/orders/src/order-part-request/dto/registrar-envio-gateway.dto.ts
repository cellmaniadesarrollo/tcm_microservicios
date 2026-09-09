// gateway/src/orders/dto/registrar-envio-gateway.dto.ts

export class RegistrarEnvioGatewayDto {
    id: number;
    transportista: string;
    numeroGuia: string;
    fechaEstimadaLlegada?: string;
    notas?: string;
}