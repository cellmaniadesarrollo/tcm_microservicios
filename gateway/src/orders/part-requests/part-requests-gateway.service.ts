// gateway/src/orders/part-requests-gateway.service.ts

import { Injectable } from '@nestjs/common';
import { OrderServiceClient } from '../../common/microservices/order-service-client';
import { CreatePartRequestGatewayDto } from './dto/create-part-request-gateway.dto';
import { ListPartRequestsGatewayDto } from './dto/list-part-requests-gateway.dto';
import { EncontradoNacionalGatewayDto } from './dto/encontrado-nacional-gateway.dto';
import { CreatePartRequestPaymentGatewayDto } from './dto/create-part-request-payment-gateway.dto';
import { RegistrarEnvioGatewayDto } from './dto/registrar-envio-gateway.dto';
import { RegistrarLlegadaGatewayDto } from './dto/registrar-llegada.dto';
import { AprobarLlegadaGatewayDto } from './dto/aprobar-llegada.dto';
import { NoAprobarLlegadaGatewayDto } from './dto/no-aprobar-llegada-gateway.dto';
import { CompletarDatosPartRequestGatewayDto } from './dto/completar-datos-part-request-gateway.dto';

@Injectable()
export class PartRequestsGatewayService {
    constructor(private readonly orderServiceClient: OrderServiceClient) { }

    async createPartRequest(dto: CreatePartRequestGatewayDto, files: any[], user: any) {
        // el try/catch de mapeo de errores ya vive en send(), igual que en OrdersGatewayService
        return this.orderServiceClient.send('create_part_request', { dto, files, user });
    }
    async listByOrder(orderId: number, user: any) {
        return this.orderServiceClient.send('list_part_requests_by_order', { dto: { orderId }, user });
    }
    async listPartRequests(dto: ListPartRequestsGatewayDto, user: any) {
        return this.orderServiceClient.send('list_part_requests', { dto, user });
    }
    // gateway — part-requests-gateway.service.ts
    async getPartRequestFullData(id: number, user: any) {
        return this.orderServiceClient.send('get_part_request_full_data', { dto: { id }, user });
    }

    async encontradoNacional(dto: EncontradoNacionalGatewayDto, files: any[], user: any) {

        return this.orderServiceClient.send('encontrado_nacional_part_request', { dto, files, user });
    }
    async completarDatos(
        dto: CompletarDatosPartRequestGatewayDto,
        user: { userId: string; companyId: string }
    ) {
        return this.orderServiceClient.send('completar_datos_part_request', { dto, user });
    }
    async getDatosPrevios(id: number, user: { companyId: string }) {
        return this.orderServiceClient.send('get_part_request_datos_previos', { dto: { id }, user });
    }
    async listParaPago(dto: ListPartRequestsGatewayDto, user: any) {
        return this.orderServiceClient.send('list_part_requests_para_pago', { dto, user });
    }
    async createPartRequestPayment(dto: CreatePartRequestPaymentGatewayDto, files: any[], user: any) {
        return this.orderServiceClient.send('create_part_request_payment', { dto, files, user });
    }
    async registrarEnvio(dto: RegistrarEnvioGatewayDto, files: any[], user: any) {
        return this.orderServiceClient.send('registrar_envio_part_request', { dto, files, user });
    }
    async registrarLlegada(dto: RegistrarLlegadaGatewayDto, files: any[], user: any) {
        return this.orderServiceClient.send('registrar_llegada_part_request', { dto, files, user });
    }

    async aprobarLlegada(dto: AprobarLlegadaGatewayDto, files: any[], user: any) {
        return this.orderServiceClient.send('aprobar_llegada_part_request', { dto, files, user });
    }
    // gateway — service
    async noAprobarLlegada(dto: NoAprobarLlegadaGatewayDto, files: any[], user: any) {
        return this.orderServiceClient.send('no_aprobar_llegada_part_request', { dto, files, user });
    }

    async getDatosPago(id: number, user: { companyId: string }) {
        return this.orderServiceClient.send('get_part_request_datos_pago', { dto: { id }, user });
    }

    async getPartRequestCounts(user: any) {
        return this.orderServiceClient.send('get_part_request_counts', { user });
    }
} 