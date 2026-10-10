// microservices/orders/src/order-part-requests/part-request-travel-items.controller.ts

import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { PartRequestTravelItemsService } from './part-request-travel-items.service';

@Controller()
export class PartRequestTravelItemsController {
    constructor(private readonly travelItemsService: PartRequestTravelItemsService) { }

    @MessagePattern({ cmd: 'create_part_request_travel_item' })
    async createTravelItem(@Payload() data: any) {
        try {
            if (!data.dto || !data.user) throw new RpcException('Payload incompleto: falta dto o user');
            return await this.travelItemsService.createTravelItem(
                data.dto,
                data.files ?? [],
                data.user,
            );
        } catch (error: any) {
            console.error('🔥 Error en createTravelItem:', error);
            throw new RpcException({ status: 'error', message: error.message || 'Error interno en MS Órdenes', details: error.response || null });
        }
    }

    @MessagePattern({ cmd: 'list_part_request_travel_items' })
    async listTravelItems(@Payload() data: any) {
        try {
            if (!data.user) throw new RpcException('Payload incompleto: falta user');
            return await this.travelItemsService.listTravelItems(data.query ?? {}, data.user);
        } catch (error: any) {
            console.error('🔥 Error en listTravelItems:', error);
            throw new RpcException({ status: 'error', message: error.message || 'Error interno en MS Órdenes', details: error.response || null });
        }
    }
    @MessagePattern({ cmd: 'create_standalone_travel_item' })
    async createStandaloneTravelItem(@Payload() data: any) {
        try {
            if (!data.dto || !data.user) throw new RpcException('Payload incompleto: falta dto o user');
            return await this.travelItemsService.createStandaloneTravelItem(
                data.dto,
                data.files ?? [],
                data.user,
            );
        } catch (error: any) {
            console.error('🔥 Error en createStandaloneTravelItem:', error);
            throw new RpcException({ status: 'error', message: error.message || 'Error interno en MS Órdenes', details: error.response || null });
        }
    }

    @MessagePattern({ cmd: 'get_part_request_travel_item' })
    async getTravelItem(@Payload() data: any) {
        try {
            if (!data.id || !data.user) throw new RpcException('Payload incompleto: falta id o user');
            return await this.travelItemsService.getTravelItemFullData(Number(data.id), data.user);
        } catch (error: any) {
            console.error('🔥 Error en getTravelItem:', error);
            throw new RpcException({ status: 'error', message: error.message || 'Error interno en MS Órdenes', details: error.response || null });
        }
    }
    @MessagePattern({ cmd: 'resolve_part_request_travel_item' })
    async resolveTravelItem(@Payload() data: any) {
        try {
            if (!data.id || !data.dto || !data.user) throw new RpcException('Payload incompleto: falta id, dto o user');
            return await this.travelItemsService.resolveTravelItem(
                Number(data.id),
                data.dto,
                data.files ?? [],
                data.user,
            );
        } catch (error: any) {
            console.error('🔥 Error en resolveTravelItem:', error);
            throw new RpcException({ status: 'error', message: error.message || 'Error interno en MS Órdenes', details: error.response || null });
        }
    }
}