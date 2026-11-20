import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { Groups } from '../common/auth/decorators/groups.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { BillingDiscountsService } from './billing-discounts.service';
import { CreateDiscountGatewayDto } from './dto/create-discount-gateway.dto';
import { SearchDiscountsQueryDto } from './dto/search-discounts-query.dto';

@Controller('billing-discounts')
@Auth()
export class BillingDiscountsController {
  constructor(private readonly service: BillingDiscountsService) {}

  private ctx(user: any) {
    return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
  }

  /** Catálogo que ve el cajero al vender. Sin @Groups(): cualquier usuario autenticado. */
  @Get('available')
  available(@User() user: any) {
    return this.service.listAvailable(this.ctx(user));
  }

  /** Crea un descuento temporal (vence en 24 h). Solo administradores. */
  @Post()
  @Groups()
  create(@Body() dto: CreateDiscountGatewayDto, @User() user: any) {
    return this.service.create(dto, this.ctx(user));
  }

  /** Desactiva un descuento del catálogo. Solo administradores. */
  @Patch(':id/deactivate')
  @Groups()
  deactivate(@Param('id', ParseUUIDPipe) id: string, @User() user: any) {
    return this.service.deactivate(id, this.ctx(user));
  }

  /** Reporte de descuentos aplicados. Solo administradores. */
  @Get('report')
  @Groups()
  report(@Query() q: SearchDiscountsQueryDto, @User() user: any) {
    return this.service.report(q, this.ctx(user));
  }
}