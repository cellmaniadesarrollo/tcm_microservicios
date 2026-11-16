import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { CreateIssuerGatewayDto, UpdateIssuerGatewayDto } from './dto/create-issuer-gateway.dto';
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
}