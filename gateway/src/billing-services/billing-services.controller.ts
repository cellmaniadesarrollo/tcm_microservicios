import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { Groups } from '../common/auth/decorators/groups.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { BillingServicesService } from './billing-services.service';
import {
  CreateServiceGatewayDto, CreateServiceTypeGatewayDto, ListServiceTypesQueryDto,
  ListServicesQueryDto, SetActiveGatewayDto, UpdateServiceGatewayDto,
  UpdateServiceTypeGatewayDto,
} from './dto/billing-services.dto';

@Controller('billing-services')
@Auth()
export class BillingServicesController {
  constructor(private readonly service: BillingServicesService) {}

  private ctx(user: any) {
    return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
  }

  // ── Tipos (rutas fijas primero) ──
  @Get('types')
  listTypes(@Query() q: ListServiceTypesQueryDto, @User() user: any) {
    return this.service.listTypes(q.onlyActive, this.ctx(user));
  }

  @Post('types')
  @Groups()
  createType(@Body() dto: CreateServiceTypeGatewayDto, @User() user: any) {
    return this.service.createType(dto, this.ctx(user));
  }

  @Patch('types/:id')
  @Groups()
  updateType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceTypeGatewayDto,
    @User() user: any,
  ) {
    return this.service.updateType(id, dto, this.ctx(user));
  }

  @Patch('types/:id/active')
  @Groups()
  setTypeActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActiveGatewayDto,
    @User() user: any,
  ) {
    return this.service.setTypeActive(id, dto.isActive, this.ctx(user));
  }

  // ── Servicios ──
  /** Catálogo para el cajero. Cualquier usuario autenticado. */
  @Get()
  list(@Query() q: ListServicesQueryDto, @User() user: any) {
    return this.service.list(q, this.ctx(user));
  }

  @Post()
  @Groups()
  create(@Body() dto: CreateServiceGatewayDto, @User() user: any) {
    return this.service.create(dto, this.ctx(user));
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @User() user: any) {
    return this.service.get(id, this.ctx(user));
  }

  @Patch(':id')
  @Groups()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceGatewayDto,
    @User() user: any,
  ) {
    return this.service.update(id, dto, this.ctx(user));
  }

  @Patch(':id/active')
  @Groups()
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActiveGatewayDto,
    @User() user: any,
  ) {
    return this.service.setActive(id, dto.isActive, this.ctx(user));
  }
}