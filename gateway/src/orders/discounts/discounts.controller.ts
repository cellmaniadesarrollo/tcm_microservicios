import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';

import { Auth } from '../../common/auth/decorators/auth.decorator';
import { Features } from '../../common/auth/decorators/features.decorator';
import { User } from '../../common/auth/decorators/user.decorator';

import { DiscountsGatewayService } from './discounts-gateway.service';
import { CreateOrderDiscountGatewayDto } from './dto/create-order-discount-gateway.dto';

@Controller('orders/:orderId/discounts')
@Auth()
@Features('orders')
export class DiscountsController {
    constructor(private readonly discountsGatewayService: DiscountsGatewayService) { }

    // ─── Cualquier logueado ────────────────────────────────────────
    @Post()
    async registrarDescuento(
        @Param('orderId', ParseIntPipe) orderId: number,
        @Body() body: CreateOrderDiscountGatewayDto,
        @User() user: any,
    ) {
        return this.discountsGatewayService.registrarDescuento(
            orderId,
            body,
            { userId: user.sub, username: user.username, companyId: user.companyId },
        );
    }

    // ─── Cualquier logueado ────────────────────────────────────────
    @Get()
    async getDescuentos(
        @Param('orderId', ParseIntPipe) orderId: number,
        @User() user: any,
    ) {
        return this.discountsGatewayService.getDescuentos(orderId, {
            companyId: user.companyId,
        });
    }

    // ─── Cualquier logueado ────────────────────────────────────────
    @Delete(':discountId')
    async eliminarDescuento(
        @Param('discountId', ParseIntPipe) discountId: number,
        @User() user: any,
    ) {
        return this.discountsGatewayService.eliminarDescuento(discountId, {
            userId: user.sub,
            username: user.username,
            companyId: user.companyId,
        });
    }
}