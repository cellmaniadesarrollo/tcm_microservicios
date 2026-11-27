// gateway/src/orders/device-purchases/device-purchases-gateway.service.ts
import { Injectable } from '@nestjs/common';
import { CreateDevicePurchaseGatewayDto } from './dto/create-device-purchase-gateway.dto';
import { CancelDevicePurchaseGatewayDto } from './dto/cancel-device-purchase-gateway.dto';
import { ListDevicePurchasesGatewayDto } from './dto/list-device-purchases-gateway.dto';
import { OrderServiceClient } from '../../common/microservices/order-service-client';
import { firstValueFrom, timeout } from 'rxjs';
import { ListPurchasableOrdersGatewayDto } from './dto/list-purchasable-orders-gateway.dto';
const LONG_MS = 60000;
export interface GatewayUser {
    userId: string;
    companyId: string;
    branchId?: string;
}

@Injectable()
export class DevicePurchasesGatewayService {
    constructor(private readonly orderServiceClient: OrderServiceClient) { }

    create(dto: CreateDevicePurchaseGatewayDto, files: any[], user: GatewayUser) {
        return this.orderServiceClient.send(
            'device_purchase_create',
            { dto, files, user },
            LONG_MS,
        );
    }
    cancel(purchaseId: number, dto: CancelDevicePurchaseGatewayDto, user: GatewayUser) {
        return this.orderServiceClient.send('device_purchase_cancel', { purchaseId, dto, user });
    }

    list(dto: ListDevicePurchasesGatewayDto, user: GatewayUser) {
        return this.orderServiceClient.send('device_purchase_list', { dto, user });
    }

    getById(id: number, user: GatewayUser) {
        return this.orderServiceClient.send('device_purchase_get', { id, user });
    }
    // device-purchases-gateway.service.ts
    getByOrderId(orderId: number, user: GatewayUser) {
        return this.orderServiceClient.send(
            'device_purchase.get_by_order',
            { orderId, companyId: user.companyId },
        );
    }
    // device-purchases-gateway.service.ts
    listOrders(dto: ListPurchasableOrdersGatewayDto, user: GatewayUser) {
        return this.orderServiceClient.send('device_purchase_orders_list', { dto, user });
    }
}