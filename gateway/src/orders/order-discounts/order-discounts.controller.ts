// microservices/orders/src/order-discounts/order-discounts.controller.ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderDiscountsService } from './order-discounts.service';
import { CreateOrderDiscountGatewayDto } from '../discounts/dto/create-order-discount-gateway.dto';
import { Auth } from '../../common/auth/decorators/auth.decorator';
import { Features } from '../../common/auth/decorators/features.decorator';
import { CrearDescuentoOrdenGatewayDto } from './dto/crear-descuento-orden-gateway.dto';
import { User } from '../../common/auth/decorators/user.decorator';
import { CancelarDescuentoOrdenGatewayDto } from './dto/cancelar-descuento-orden-gateway.dto';
import { ListarDescuentosOrdenGatewayDto } from './dto/listar-descuentos-orden-gateway.dto';


@Auth()

@Controller('discounts')
@Features('orders')
export class OrderDiscountsController {
    constructor(private readonly orderDiscountsService: OrderDiscountsService) { }


    @Post()
    crearDescuento(
        @Body() dto: CrearDescuentoOrdenGatewayDto,
        @User() user: any,
    ) {
        return this.orderDiscountsService.crearDescuento(dto, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }
    @Delete(':discountId')
    cancelarDescuento(
        @Param('orderId', ParseIntPipe) orderId: number,
        @Param('discountId', ParseIntPipe) discountId: number,
        @Body() dto: CancelarDescuentoOrdenGatewayDto,
        @User() user: any,
    ) {
        dto.orderId = orderId;
        dto.discountId = discountId;

        return this.orderDiscountsService.cancelarDescuento(dto, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }
    @Get()
    listarDescuentos(
        @Query() query: ListarDescuentosOrdenGatewayDto,
        @User() user: any,
    ) {
        return this.orderDiscountsService.listarDescuentos(query, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }
}