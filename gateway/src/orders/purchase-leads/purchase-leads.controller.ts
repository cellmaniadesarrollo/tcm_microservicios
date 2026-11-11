// purchase-leads.controller.ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Auth } from '../../common/auth/decorators/auth.decorator';
import { Features } from '../../common/auth/decorators/features.decorator';
import { User } from '../../common/auth/decorators/user.decorator';
import { PurchaseLeadsGatewayService } from './purchase-leads-gateway.service';
import { CreatePurchaseLeadGatewayDto } from './dto/create-purchase-lead-gateway.dto';
import { ListPurchaseLeadsGatewayDto } from './dto/list-purchase-leads-gateway.dto';
import { MarkContactedGatewayDto } from './dto/mark-contacted-gateway.dto';

@Controller('purchase-leads')
@Auth()
@Features('orders')
export class PurchaseLeadsController {
  constructor(private readonly service: PurchaseLeadsGatewayService) {}

  private ctx(user: any) {
    return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
  }

  @Post()
  create(@Body() dto: CreatePurchaseLeadGatewayDto, @User() user: any) {
    return this.service.create(dto, this.ctx(user));
  }

  @Get()
  list(@Query() query: ListPurchaseLeadsGatewayDto, @User() user: any) {
    return this.service.list(query, this.ctx(user));
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.service.getOne(id, this.ctx(user));
  }

  @Patch(':id/contact')
  markContacted(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkContactedGatewayDto,
    @User() user: any,
  ) {
    return this.service.markContacted(id, dto, this.ctx(user));
  }

  @Patch(':id/close')
  markClosed(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.service.markClosed(id, this.ctx(user));
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.service.remove(id, this.ctx(user));
  }
}