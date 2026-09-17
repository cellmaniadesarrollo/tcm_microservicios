// src/orders/invoices/invoices.controller.ts
import { Controller, Get, Post, Param, ParseIntPipe, Query } from '@nestjs/common';
import { InvoicesGatewayService } from './invoices-gateway.service';
import { ListInvoicesGatewayDto } from './dto/list-invoices-gateway.dto';
import { Groups } from '../../common/auth/decorators/groups.decorator';
import { User } from '../../common/auth/decorators/user.decorator';
import { Features } from '../../common/auth/decorators/features.decorator';
import { Auth } from '../../common/auth/decorators/auth.decorator';

@Controller('invoices')
@Auth()
@Features('orders')
export class InvoicesController {
    constructor(private readonly invoicesGatewayService: InvoicesGatewayService) { }

    // ─── FACTURACION / LOGISTICA ────────────────────────────────────
    //  @Groups('FACTURACION')
    @Get()
    async listInvoices(
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('search') search: string,
        @Query('status') status: string,
        @Query('from') from: string,
        @Query('to') to: string,
        @User() user: any,
    ) {
        console.log('asdasd')
        const dto: ListInvoicesGatewayDto = {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            search: search || undefined,
            status: status || undefined,
            from: from || undefined,
            to: to || undefined,
        };

        return this.invoicesGatewayService.listInvoices(dto, user);
    }

    @Groups('FACTURACION')
    @Post(':id/resend')
    async resendInvoice(
        @Param('id', ParseIntPipe) id: number,
        @User() user: any,
    ) {
        return this.invoicesGatewayService.resendInvoice(id, user);
    }
}