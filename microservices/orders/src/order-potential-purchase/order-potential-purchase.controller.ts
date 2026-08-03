// order-potential-purchase/order-potential-purchase.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { OrderPotentialPurchaseService } from './order-potential-purchase.service';
import { CreateOrderPotentialPurchaseDto } from './dto/create-order-potential-purchase.dto';
import { ListPotentialPurchasesDto } from './dto/list-potential-purchases.dto';

@Controller()
export class OrderPotentialPurchaseController {
    constructor(private readonly service: OrderPotentialPurchaseService) { }

    @MessagePattern({ cmd: 'mark_potential_purchase' })
    async markAsPotential(dto: CreateOrderPotentialPurchaseDto) {
        return this.service.markAsPotential(dto);
    }

    @MessagePattern({ cmd: 'unmark_potential_purchase' })
    async unmarkAsPotential(data: {
        order_id: number;
        user: any;
        internalToken: string;
    }) {
        return this.service.unmarkAsPotential(
            data.order_id,
            data.user,
            data.internalToken,
        );
    }

    @MessagePattern({ cmd: 'get_potential_purchase_by_order' })
    async getByOrderId(data: { order_id: number }) {
        return this.service.getByOrderId(data.order_id);
    }

    @MessagePattern({ cmd: 'list_potential_purchases' })
    async listPotentialPurchases(data: {
        companyId: string;
        dto: ListPotentialPurchasesDto;
        internalToken: string;
    }) {
        return this.service.listPotentialPurchases(data.companyId, data.dto);
    }
    @MessagePattern({ cmd: 'get_potential_purchase_full_data' })
    async getFullData(data: {
        id: number;
        companyId: string;
        internalToken: string;
    }) {
        return this.service.getPotentialPurchaseFullData(data.id, data.companyId);
    }
}