import { Body, Controller, Get, Post } from '@nestjs/common';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { CreateInvoiceGatewayDto } from './dto/create-invoice-gateway.dto';
import { SriDocumentsService } from './sri-documents.service';

@Controller('invoices')
@Auth()
export class SriDocumentsController {
  constructor(private readonly service: SriDocumentsService) {}

  private ctx(user: any) {
    return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
  }

  @Get()
  list(@User() user: any) {
    return this.service.list(this.ctx(user));
  }

  @Post()
  create(@Body() dto: CreateInvoiceGatewayDto, @User() user: any) {
    return this.service.createInvoice(dto, this.ctx(user));
  }
}