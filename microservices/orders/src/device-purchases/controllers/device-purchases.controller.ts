import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DevicePurchasesService } from '../services/device-purchases.service';
import { CreateDevicePurchaseDto, ListDevicePurchasesDto, SerializedFile } from '../dto/create-device-purchase.dto';
import { ListPurchasableOrdersDto } from '../dto/list-purchasable-orders.dto';

@Controller()
export class DevicePurchasesController {
    constructor(private readonly service: DevicePurchasesService) { }
    @MessagePattern({ cmd: 'device_purchase_create' })
    create(@Payload() p: {
        dto: any;
        files: SerializedFile[];
        user: { userId: string; companyId: string };
    }) {
        return this.service.purchaseDevice({
            ...p.dto,
            files: p.files,
            user: { userId: p.user.userId, companyId: p.user.companyId },
        });
    }

    @MessagePattern({ cmd: 'device_purchase_list' })
    list(@Payload() p: { dto: any; user: { companyId: string } }) {
        return this.service.list(p.user.companyId, {
            ...p.dto,
            page: p.dto?.page ?? 1,
            limit: p.dto?.limit ?? 20,
        });
    }

    @MessagePattern({ cmd: 'device_purchase_get' })
    get(@Payload() p: { id: number; user: { companyId: string } }) {
        return this.service.getById(p.id, p.user.companyId);
    }
    @MessagePattern({ cmd: 'device_purchase.get_by_order' })
    getByOrder(@Payload() p: { orderId: number; companyId: string }) {
        return this.service.getByOrderId(p.orderId, p.companyId);
    }
    @MessagePattern({ cmd: 'device_purchase_orders_list' })
    listOrders(@Payload() p: { dto: ListPurchasableOrdersDto; user: { companyId: string } }) {
        return this.service.listOrdersForPurchase(p.user.companyId, p.dto ?? {});
    }
}