// gateway/src/orders/part-requests-gateway.service.ts

import { Injectable } from '@nestjs/common';
import { OrderServiceClient } from '../../common/microservices/order-service-client';
import { CreatePartRequestGatewayDto } from './dto/create-part-request-gateway.dto';
import { ListPartRequestsGatewayDto } from './dto/list-part-requests-gateway.dto';

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
    async getPartRequestFullData(id: number, user: any) {
        return this.orderServiceClient.send('get_part_request_full_data', { dto: { id }, user });
    }
    async tomarPartRequest(id: number, user: any) {
        return this.orderServiceClient.send('tomar_part_request', { dto: { id }, user });
    }
    async listMyAcceptedPartRequests(dto: ListPartRequestsGatewayDto, user: any) {
        return this.orderServiceClient.send('list_my_accepted_part_requests', { dto, user });
    }
}