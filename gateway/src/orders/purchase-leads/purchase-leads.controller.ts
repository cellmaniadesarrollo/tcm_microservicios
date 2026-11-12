import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Auth } from '../../common/auth/decorators/auth.decorator';
import { Features } from '../../common/auth/decorators/features.decorator';
import { User } from '../../common/auth/decorators/user.decorator';
import { parseMultipartRequest } from '../../common/helpers/multipart-request.helper';
import { PurchaseLeadsGatewayService } from './purchase-leads-gateway.service';
import { preparePurchaseLeadPhotos } from './helpers/purchase-lead-photos.helper';
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

  @Post(':id/photos')
  async uploadPhotos(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: FastifyRequest,
    @User() user: any,
  ) {
    const { files } = await parseMultipartRequest(request);
    const photos = await preparePurchaseLeadPhotos(files);
    return this.service.uploadPhotos(id, photos, this.ctx(user));
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