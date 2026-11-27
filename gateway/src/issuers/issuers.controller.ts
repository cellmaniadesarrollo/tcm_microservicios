import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { CreateIssuerGatewayDto, UpdateIssuerGatewayDto } from './dto/create-issuer-gateway.dto';
import { CreateEmissionPointGatewayDto, SetEmissionPointUsersGatewayDto, UpdateEmissionPointGatewayDto } from './dto/emission-point-gateway.dto';
import { IssuersService } from './issuers.service';

@Controller('issuers')
@Auth()
export class IssuersController {
  constructor(private readonly service: IssuersService) {}

  private ctx(user: any) {
    return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
  }

  @Get()
  list(@User() user: any) {
    return this.service.list(this.ctx(user));
  }

  @Post()
  create(@Body() dto: CreateIssuerGatewayDto, @User() user: any) {
    return this.service.create(dto, this.ctx(user));
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIssuerGatewayDto,
    @User() user: any,
  ) {
    return this.service.update(id, dto, this.ctx(user));
  }

  @Get('branches/:branchId/emission-points')
  listEmissionPoints(@Param('branchId', ParseUUIDPipe) branchId: string, @User() user: any) {
    return this.service.listEmissionPoints(branchId, this.ctx(user));
  }

  @Post('branches/:branchId/emission-points')
  createEmissionPoint(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateEmissionPointGatewayDto,
    @User() user: any,
  ) {
    return this.service.createEmissionPoint(branchId, dto, this.ctx(user));
  }

  @Patch('emission-points/:id')
  updateEmissionPoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmissionPointGatewayDto,
    @User() user: any,
  ) {
    return this.service.updateEmissionPoint(id, dto, this.ctx(user));
  }

  @Get('branches/:branchId/emission-points/mine')
  listMine(@Param('branchId', ParseUUIDPipe) branchId: string, @User() user: any) {
    return this.service.listMyEmissionPoints(branchId, this.ctx(user));
  }

  @Get('emission-points/:id/users')
  getUsers(@Param('id', ParseUUIDPipe) id: string, @User() user: any) {
    return this.service.getEmissionPointUsers(id, this.ctx(user));
  }

  @Put('emission-points/:id/users')
  setUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetEmissionPointUsersGatewayDto,
    @User() user: any,
  ) {
    return this.service.setEmissionPointUsers(id, dto, this.ctx(user));
  }
}