import { Body, Controller, Get, Post } from '@nestjs/common';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { CreateReceiptGatewayDto } from './dto/create-receipt-gateway.dto';
import { ReceiptsService } from './receipts.service';

@Controller('sales/receipts')
@Auth()
export class ReceiptsController {
  constructor(private readonly service: ReceiptsService) {}

  private ctx(user: any) {
    return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
  }

  @Get()
  list(@User() user: any) {
    return this.service.list(this.ctx(user));
  }

  @Post()
  create(@Body() dto: CreateReceiptGatewayDto, @User() user: any) {
    return this.service.create(dto, this.ctx(user));
  }
}