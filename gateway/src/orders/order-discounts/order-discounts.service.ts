// gateway/src/orders/order-discounts/order-discounts.service.ts
import { Injectable } from '@nestjs/common';
import { CrearDescuentoOrdenGatewayDto } from './dto/crear-descuento-orden-gateway.dto';
import { OrderServiceClient } from '../../common/microservices/order-service-client';
import { CancelarDescuentoOrdenGatewayDto } from './dto/cancelar-descuento-orden-gateway.dto';
import { ListarDescuentosOrdenGatewayDto } from './dto/listar-descuentos-orden-gateway.dto';

interface RequestContext {
    userId: string;
    companyId: string;
    branchId: string;
}

@Injectable()
export class OrderDiscountsService {
    constructor(private readonly orderServiceClient: OrderServiceClient) { }


    crearDescuento(dto: CrearDescuentoOrdenGatewayDto, user: RequestContext) {
        return this.orderServiceClient.send('create_order_discount', { dto, user });
    }
    cancelarDescuento(dto: CancelarDescuentoOrdenGatewayDto, user: RequestContext) {
        return this.orderServiceClient.send('cancel_order_discount', { dto, user });
    }

    listarDescuentos(dto: ListarDescuentosOrdenGatewayDto, user: RequestContext) {
        return this.orderServiceClient.send('list_order_discounts', { dto, user });
    }
}